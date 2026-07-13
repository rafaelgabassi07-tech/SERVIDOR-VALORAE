import { classifyTicker, normalizeTicker } from '../core/tickers.js';
import { round } from '../core/numbers.js';
import { fetchYahooHistory, fetchYahooQuote, fetchYahooLogo } from '../market/yahoo.js';
import { fetchText, fetchJson } from '../sources/fetch.js';
import { getCdiAccumulatedSeries } from '../sources/cdi.js';
import { getIpcaSeries } from '../sources/ipca.js';
import { getAssetHistory } from '../sources/asset-details.js';
import { inspectRealHistoryIntegrity } from '../sources/history-integrity.js';
import { extractInvestidor10ChartIds, buildInvestidor10CanonicalCharts } from '../market/investidor10-chart-extractor.js';
import { RELEASE } from '../core/release.js';
import { settleFastModalSource, withAssetModalRuntime } from './asset-modal-runtime.js';
import { alignComparisonSeriesToSharedWindow } from './asset-index-comparison.js';

const FII_MODAL_VERSION = '26.asset-modal.fii.v24-data-truth';


const fiiIdResolutionCache = new Map();
const FII_ID_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const FII_REQUIRED_DEEP_SECTIONS = Object.freeze(['historicalIndicators', 'patrimonialInfo', 'indexComparison', 'announcements']);
const FII_RECOVERABLE_SECTIONS = Object.freeze([
  'quote',
  'chart',
  'metrics',
  ...FII_REQUIRED_DEEP_SECTIONS,
  'peerComparison',
  'checklist',
  'distributions12m',
  'dividendCharts',
  'aboutFund',
  'propertyPortfolio',
  'vacancyHistory',
  'information',
  'returns'
]);

function parseFiiSectionList(value) {
  if (Array.isArray(value)) return value.map(item => String(item || '').trim()).filter(Boolean);
  const text = String(value ?? '').trim();
  if (!text) return [];
  if (text.startsWith('[')) {
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) return parsed.map(item => String(item || '').trim()).filter(Boolean);
    } catch {
      // Query compacta separada por vírgulas continua suportada.
    }
  }
  return text.split(',').map(item => item.trim()).filter(Boolean);
}

function fiiSectionRecoveryTargets(payload = {}) {
  const recovery = payload.recovery === true
    || payload.sectionRecovery === true
    || /^(?:1|true|yes|on)$/i.test(String(payload.recovery ?? payload.sectionRecovery ?? ''));
  if (!recovery) return { targeted: false, sections: new Set(FII_REQUIRED_DEEP_SECTIONS) };
  const explicitlyMissing = [
    ...parseFiiSectionList(payload.knownMissingSections),
    ...parseFiiSectionList(payload.missingSections),
    ...parseFiiSectionList(payload.deferredSections)
  ];
  const requested = explicitlyMissing.length
    ? explicitlyMissing
    : parseFiiSectionList(payload.requiredSections);
  const allowed = new Set(FII_RECOVERABLE_SECTIONS);
  const filtered = requested.filter(section => allowed.has(section));
  return { targeted: true, sections: new Set(filtered.length ? filtered : FII_REQUIRED_DEEP_SECTIONS) };
}

function getCachedFiiId(ticker = '') {
  const key = String(ticker || '').toUpperCase();
  const cached = fiiIdResolutionCache.get(key);
  if (!cached || Date.now() - cached.storedAt > FII_ID_CACHE_TTL_MS) {
    if (cached) fiiIdResolutionCache.delete(key);
    return '';
  }
  return cached.fiiId;
}

function cacheFiiId(ticker = '', fiiId = '') {
  const key = String(ticker || '').toUpperCase();
  const id = String(fiiId || '').trim();
  if (!key || !/^\d+$/.test(id)) return '';
  fiiIdResolutionCache.set(key, { fiiId: id, storedAt: Date.now() });
  if (fiiIdResolutionCache.size > 256) fiiIdResolutionCache.delete(fiiIdResolutionCache.keys().next().value);
  return id;
}

function extractFiiIdFromJson(value, ticker = '', depth = 0) {
  if (value == null || depth > 8) return '';
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = extractFiiIdFromJson(item, ticker, depth + 1);
      if (found) return found;
    }
    return '';
  }
  if (typeof value !== 'object') return '';
  const symbol = String(ticker || '').toUpperCase();
  const objectTicker = String(value.ticker || value.symbol || value.codigo || value.code || '').toUpperCase();
  const preferredKeys = ['fiiId', 'fii_id', 'fundoId', 'fundo_id', 'fundId', 'fund_id', 'assetId', 'asset_id'];
  for (const key of preferredKeys) {
    const id = String(value[key] ?? '').trim();
    if (/^\d+$/.test(id) && (!symbol || !objectTicker || objectTicker === symbol)) return id;
  }
  if ((!symbol || !objectTicker || objectTicker === symbol) && /^\d+$/.test(String(value.id ?? '').trim())) {
    return String(value.id).trim();
  }
  for (const nested of Object.values(value)) {
    const found = extractFiiIdFromJson(nested, ticker, depth + 1);
    if (found) return found;
  }
  return '';
}

async function resolveInvestidor10FiiId({ ticker = '', html = '', timeoutMs = 6500 } = {}) {
  const symbol = String(ticker || '').toUpperCase();
  const htmlId = String(extractInvestidor10ChartIds(html || '')?.fiiId || '').trim();
  if (htmlId) return cacheFiiId(symbol, htmlId);
  const cached = getCachedFiiId(symbol);
  if (cached) return cached;
  const base = 'https://investidor10.com.br';
  const candidates = [
    `${base}/api/rest/assets/tickers/${encodeURIComponent(symbol)}`,
    `${base}/api/rest/assets/tickers/${encodeURIComponent(symbol)}/`,
    `${base}/api/fii/${encodeURIComponent(symbol.toLowerCase())}`,
    `${base}/api/fiis/${encodeURIComponent(symbol.toLowerCase())}`
  ];
  const responses = await Promise.all(candidates.map(url => fetchJson(url, {
    timeoutMs: Math.min(5200, Math.max(2600, Number(timeoutMs) || 4200)),
    ttlMs: 6 * 60 * 60 * 1000,
    staleMs: 24 * 60 * 60 * 1000,
    retries: 0,
    headers: { Accept: 'application/json, text/plain, */*', 'X-Requested-With': 'XMLHttpRequest' }
  }).catch(() => null)));
  for (const response of responses) {
    const id = extractFiiIdFromJson(response?.json, symbol);
    if (id) return cacheFiiId(symbol, id);
  }
  return '';
}

const RETURN_PERIODS = Object.freeze([
  { key: '1m', label: '1 mês', range: '1M', interval: '1d', months: 1 },
  { key: '3m', label: '3 meses', range: '3M', interval: '1d', months: 3 },
  { key: '1y', label: '1 ano', range: '1Y', interval: '1d', months: 12 },
  { key: '2y', label: '2 anos', range: '2Y', interval: '1wk', months: 24 },
  { key: '5y', label: '5 anos', range: '5Y', interval: '1wk', months: 60 },
  { key: '10y', label: '10 anos', range: '10Y', interval: '1mo', months: 120 }
]);

const FII_INDEX_BENCHMARKS = Object.freeze([
  { key: 'ifix', code: 'IFIX', label: 'IFIX', ticker: 'IFIX', yahooSymbol: 'IFIX.SA', yahooSymbols: ['IFIX.SA', '^IFIX'], kind: 'official_return_index', sourceLabel: 'Retorno/Proxy índice IFIX · Yahoo direto + faixas compatíveis' },
  { key: 'cdi', code: 'CDI', label: 'CDI', ticker: 'CDI', kind: 'bcb_cdi', sourceLabel: 'Banco Central SGS CDI' },
  { key: 'ipca', code: 'IPCA', label: 'IPCA', ticker: 'IPCA', kind: 'bcb_ipca', sourceLabel: 'Banco Central SGS IPCA' },
  { key: 'ibov', code: 'IBOV', label: 'IBOV', ticker: 'IBOV', yahooSymbol: '^BVSP', kind: 'official_return_index', sourceLabel: 'Retorno/Proxy índice IBOV · B3/Yahoo' },
  { key: 'smll', code: 'SMLL', label: 'SMLL', ticker: 'SMLL', yahooSymbol: 'SMLL.SA', yahooSymbols: ['SMLL.SA', '^SMLL'], kind: 'official_return_index', sourceLabel: 'Retorno/Proxy índice SMLL · Yahoo direto + faixas compatíveis' },
  { key: 'idiv', code: 'IDIV', label: 'IDIV', ticker: 'IDIV', yahooSymbol: 'IDIV.SA', yahooSymbols: ['IDIV.SA', '^IDIV'], kind: 'official_return_index', sourceLabel: 'Retorno/Proxy índice IDIV · Yahoo direto + faixas compatíveis' },
  { key: 'ivvb11', code: 'IVVB11', label: 'IVVB11', ticker: 'IVVB11', yahooSymbol: 'IVVB11.SA', kind: 'yahoo_etf', sourceLabel: 'Yahoo Finance Chart API IVVB11.SA' }
]);

const FII_COMPARISON_PERIODS = Object.freeze([
  { key: '2y', label: '2 A', range: '2Y', interval: '1wk', months: 24 },
  { key: '5y', label: '5 A', range: '5Y', interval: '1mo', months: 60 },
  { key: '10y', label: '10 A', range: '10Y', interval: '1mo', months: 120 }
]);

const FII_COMPARISON_BASE_INVESTMENT = 1000;


const INVESTIDOR10_FII_INFO_FIELDS = Object.freeze([
  { id: 'razao_social', label: 'Razão Social', group: 'Cadastro', variants: ['RAZÃO SOCIAL', 'RAZAO SOCIAL'] },
  { id: 'cnpj', label: 'CNPJ', group: 'Cadastro', variants: ['CNPJ'] },
  { id: 'publico_alvo', label: 'Público-alvo', group: 'Cadastro', variants: ['PÚBLICO-ALVO', 'PUBLICO-ALVO', 'PÚBLICO ALVO', 'PUBLICO ALVO'] },
  { id: 'mandato', label: 'Mandato', group: 'Estratégia', variants: ['MANDATO'] },
  { id: 'segmento', label: 'Segmento', group: 'Estratégia', variants: ['SEGMENTO'] },
  { id: 'tipo_fundo', label: 'Tipo de fundo', group: 'Estratégia', variants: ['TIPO DE FUNDO'] },
  { id: 'prazo_duracao', label: 'Prazo de duração', group: 'Cadastro', variants: ['PRAZO DE DURAÇÃO', 'PRAZO DE DURACAO'] },
  { id: 'tipo_gestao', label: 'Tipo de gestão', group: 'Gestão', variants: ['TIPO DE GESTÃO', 'TIPO DE GESTAO'] },
  { id: 'taxa_administracao', label: 'Taxa de administração', group: 'Custos', variants: ['TAXA DE ADMINISTRAÇÃO', 'TAXA DE ADMINISTRACAO'] },
  { id: 'vacancia', label: 'Vacância', group: 'Portfólio', variants: ['VACÂNCIA', 'VACANCIA'] },
  { id: 'numero_cotistas', label: 'Número de cotistas', group: 'Base de cotistas', variants: ['NÚMERO DE COTISTAS', 'NUMERO DE COTISTAS'] },
  { id: 'cotas_emitidas', label: 'Cotas emitidas', group: 'Base patrimonial', variants: ['COTAS EMITIDAS'] },
  { id: 'valor_patrimonial_cota', label: 'Valor patrimonial por cota', group: 'Patrimônio', variants: ['VAL. PATRIMONIAL P/ COTA', 'VAL PATRIMONIAL P/ COTA', 'VALOR PATRIMONIAL P/ COTA'] },
  { id: 'valor_patrimonial', label: 'Valor patrimonial', group: 'Patrimônio', variants: ['VALOR PATRIMONIAL'] },
  { id: 'ultimo_rendimento', label: 'Último rendimento', group: 'Rendimentos', variants: ['ÚLTIMO RENDIMENTO', 'ULTIMO RENDIMENTO'] }
]);

const FII_INFO_GROUP_ORDER = Object.freeze(['Cadastro', 'Estratégia', 'Gestão', 'Custos', 'Portfólio', 'Base de cotistas', 'Base patrimonial', 'Patrimônio', 'Rendimentos']);


const FII_BUY_HOLD_CHECKLIST_CRITERIA = Object.freeze([
  {
    id: 'listed_5y',
    label: 'FII com mais de 5 anos listado em Bolsa',
    variants: ['FII com mais de 5 anos listado em Bolsa', 'Fundo com mais de 5 anos listado em Bolsa'],
    help: 'Confere se o fundo tem histórico mínimo de listagem para análise de longo prazo.'
  },
  {
    id: 'dy_5y_above_8',
    label: 'Dividend Yield médio dos últimos 5 anos acima de 8%',
    variants: ['Dividend Yield médio dos últimos 5 anos acima de 8%', 'Dividend Yield medio dos ultimos 5 anos acima de 8%'],
    help: 'Mede a consistência média de distribuição em uma janela longa.'
  },
  {
    id: 'daily_liquidity_700k',
    label: 'Liquidez média diária acima de R$ 700 mil',
    variants: ['Liquidez média diária acima de R$ 700 mil', 'Liquidez media diaria acima de R$ 700 mil', 'Liquidez média diária acima de 700 mil'],
    help: 'Ajuda a evitar fundos com baixa negociação diária.'
  },
  {
    id: 'shareholders_20k',
    label: 'Número de cotistas acima de 20 mil',
    variants: ['Número de cotistas acima de 20 mil', 'Numero de cotistas acima de 20 mil'],
    help: 'Indica base de cotistas mais ampla.'
  },
  {
    id: 'equity_1b',
    label: 'Patrimônio líquido acima de R$ 1 bilhão',
    variants: ['Patrimônio líquido acima de R$ 1 bilhão', 'Patrimonio liquido acima de R$ 1 bilhao'],
    help: 'Critério de escala patrimonial do fundo.'
  },
  {
    id: 'properties_5_plus',
    label: '5 ou mais imóveis no portfólio',
    variants: ['5 ou mais imóveis no portfólio', '5 ou mais imoveis no portfolio'],
    help: 'Busca diversificação mínima do portfólio físico.'
  },
  {
    id: 'physical_vacancy_below_10',
    label: 'Vacância física média dos últimos 12 meses abaixo de 10%',
    variants: ['Vacância física média dos últimos 12 meses abaixo de 10%', 'Vacancia fisica media dos ultimos 12 meses abaixo de 10%'],
    help: 'Avalia ocupação física recente dos imóveis.'
  },
  {
    id: 'financial_vacancy_below_10',
    label: 'Vacância financeira média dos últimos 12 meses abaixo de 10%',
    variants: ['Vacância financeira média dos últimos 12 meses abaixo de 10%', 'Vacancia financeira media dos ultimos 12 meses abaixo de 10%'],
    help: 'Avalia perda financeira recente por vacância/inadimplência.'
  },
  {
    id: 'dy_24m_above_9',
    label: 'Dividend Yield médio dos últimos 24 meses acima de 9%',
    variants: ['Dividend Yield médio dos últimos 24 meses acima de 9%', 'Dividend Yield medio dos ultimos 24 meses acima de 9%'],
    help: 'Critério alternativo que aparece em algumas páginas do Investidor10.'
  },
  {
    id: 'daily_liquidity_1m',
    label: 'Liquidez média diária acima de R$ 1 milhão',
    variants: ['Liquidez média diária acima de R$ 1 milhão', 'Liquidez media diaria acima de R$ 1 milhao'],
    help: 'Critério alternativo de liquidez em algumas páginas do Investidor10.'
  },
  {
    id: 'equity_500m',
    label: 'Patrimônio líquido acima de R$ 500 milhões',
    variants: ['Patrimônio líquido acima de R$ 500 milhões', 'Patrimonio liquido acima de R$ 500 milhoes'],
    help: 'Critério alternativo de patrimônio em algumas páginas do Investidor10.'
  }
]);

function decodeHtmlEntities(value = '') {
  return String(value || '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#34;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

function htmlToPlainText(html = '') {
  return decodeHtmlEntities(String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(p|div|li|tr|td|th|section|article|h[1-6])>/gi, ' ')
    .replace(/<[^>]+>/g, ' '))
    .replace(/[ \t\r\n]+/g, ' ')
    .replace(/\s+([,.;:!?%])/g, '$1')
    .trim();
}

function escapeRegExp(value = '') {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function cleanInvestidor10InfoValue(value = '') {
  return htmlToPlainText(value)
    .replace(/\b(help_outline|info|open_in_new|content_copy|copiar|mais detalhes|ver detalhes)\b/gi, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[:–—•\s]+|[:–—•\s]+$/g, '')
    .trim();
}

function labelPattern(field) {
  return `(?:${field.variants.map(escapeRegExp).join('|')})`;
}


function normalizeLooseText(value = '') {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function emptyFiiBuyHoldChecklist(ticker = '', diagnostics = {}) {
  return {
    id: 'fii_buy_hold_checklist',
    title: ticker ? `Checklist do Investidor Buy and Hold sobre ${ticker}` : 'Checklist do Investidor Buy and Hold',
    subtitle: 'Critérios de qualidade exibidos pelo Investidor10 para leitura buy and hold do FII.',
    status: 'EMPTY',
    source: 'Investidor10',
    sourceUrl: ticker ? `https://investidor10.com.br/fiis/${ticker.toLowerCase()}/` : undefined,
    total: 0,
    passed: 0,
    failed: 0,
    unknown: 0,
    items: [],
    disclaimer: '',
    diagnostics
  };
}


function emptyFiiAboutFund(ticker = '', diagnostics = {}) {
  const symbol = String(ticker || '').toUpperCase();
  return {
    id: 'fii_about_fund',
    title: symbol ? `Sobre a ${symbol}` : 'Sobre o FII',
    status: 'EMPTY',
    source: 'Investidor10',
    sourceUrl: symbol ? `https://investidor10.com.br/fiis/${symbol.toLowerCase()}/` : undefined,
    ticker: symbol,
    fundName: '',
    summary: '',
    sections: [],
    diagnostics
  };
}


const BRAZIL_STATES = Object.freeze([
  ['AC', 'ACRE'], ['AL', 'ALAGOAS'], ['AP', 'AMAPÁ'], ['AM', 'AMAZONAS'], ['BA', 'BAHIA'], ['CE', 'CEARÁ'], ['DF', 'DISTRITO FEDERAL'], ['ES', 'ESPÍRITO SANTO'], ['GO', 'GOIÁS'], ['MA', 'MARANHÃO'], ['MT', 'MATO GROSSO'], ['MS', 'MATO GROSSO DO SUL'], ['MG', 'MINAS GERAIS'], ['PA', 'PARÁ'], ['PB', 'PARAÍBA'], ['PR', 'PARANÁ'], ['PE', 'PERNAMBUCO'], ['PI', 'PIAUÍ'], ['RJ', 'RIO DE JANEIRO'], ['RN', 'RIO GRANDE DO NORTE'], ['RS', 'RIO GRANDE DO SUL'], ['RO', 'RONDÔNIA'], ['RR', 'RORAIMA'], ['SC', 'SANTA CATARINA'], ['SP', 'SÃO PAULO'], ['SE', 'SERGIPE'], ['TO', 'TOCANTINS']
]);

const STATE_NAME_TO_UF = Object.freeze(Object.fromEntries(BRAZIL_STATES.map(([uf, name]) => [normalizeLooseText(name), uf])));
const STATE_ALTERNATION = BRAZIL_STATES
  .map(([, name]) => name)
  .sort((a, b) => b.length - a.length)
  .map(escapeRegExp)
  .join('|');

function emptyFiiPropertyPortfolio(ticker = '', diagnostics = {}) {
  const symbol = String(ticker || '').toUpperCase();
  return {
    id: 'fii_property_portfolio',
    title: 'Lista de imóveis',
    status: 'EMPTY',
    source: 'Investidor10',
    sourceUrl: symbol ? `https://investidor10.com.br/fiis/${symbol.toLowerCase()}/` : undefined,
    ticker: symbol,
    totalProperties: 0,
    totalStates: 0,
    states: [],
    properties: [],
    diagnostics
  };
}



function findAnnouncementsHtmlSection(html = '', ticker = '') {
  const source = String(html || '');
  if (!source) return '';
  const symbol = String(ticker || '').toUpperCase();
  const headingRe = symbol
    ? new RegExp(`COMUNICADOS\\s+DO\\s+${escapeRegExp(symbol)}|COMUNICADOS`, 'i')
    : /COMUNICADOS/i;
  const plain = htmlToPlainText(source);
  const plainStart = plain.search(headingRe);
  if (plainStart < 0) return '';
  const lower = source.toLowerCase();
  const headingCandidates = [
    lower.search(/comunicados\s+do\s+[a-z]{4}\d{2}/i),
    lower.indexOf('comunicados')
  ].filter(idx => idx >= 0);
  const htmlStart = headingCandidates.length ? Math.min(...headingCandidates) : 0;
  const tail = source.slice(htmlStart, htmlStart + 24000);
  const lowerTail = tail.toLowerCase();
  const stopPatterns = [
    /<h[1-6][^>]*>\s*(?:not[ií]cias|d[uú]vidas|fiis\s+relacionados|compare|avalie|ranking)/i,
    /not[ií]cias\s+sobre/i,
    /d[uú]vidas\s+comuns/i,
    /fiis\s+relacionados/i,
    /copyright/i
  ];
  let end = tail.length;
  for (const re of stopPatterns) {
    const match = lowerTail.match(re);
    if (match?.index && match.index > 80 && match.index < end) end = match.index;
  }
  return tail.slice(0, end);
}

function announcementFromRow({ rowText = '', href = '', anchorText = '', ticker = '', index = 0, baseUrl = '' } = {}) {
  const symbol = String(ticker || '').toUpperCase();
  const cleanAnchor = normalizeAnnouncementTitle(anchorText || '', '');
  const rawRow = cleanInvestidor10InfoValue(rowText || '');
  const cleanRow = normalizeAnnouncementTitle(rowText || '', '');
  const disclosureDateMatch = rawRow.match(/Data\s+de\s+Divulga(?:ç|c)[ãa]o\s*:?\s*(\d{2}\/\d{2}\/\d{4})/i);
  const anyDateMatch = rawRow.match(/\b\d{2}\/\d{2}\/\d{4}\b/);
  const dateDisplay = disclosureDateMatch?.[1] || anyDateMatch?.[0] || '';
  let titleCandidate = cleanAnchor && !/^abrir$/i.test(cleanAnchor) ? cleanAnchor : cleanRow;
  if (dateDisplay) {
    titleCandidate = titleCandidate
      .replace(new RegExp(`Data\\s+de\\s+Divulga(?:ç|c)[ãa]o\\s*:?\\s*${escapeRegExp(dateDisplay)}`, 'i'), ' ')
      .replace(dateDisplay, ' ');
  }
  titleCandidate = titleCandidate
    .replace(new RegExp(`^COMUNICADOS\\s+DO\\s+${escapeRegExp(symbol)}\\s*`, 'i'), '')
    .replace(/^COMUNICADOS\s*/i, '')
    .replace(/\s*ABRIR\s*$/i, '')
    .trim();
  const url = safeAbsoluteHttpUrl(href, baseUrl);
  const documentKind = announcementKindFromUrl(url);
  const title = normalizeAnnouncementTitle(titleCandidate, dateDisplay ? `Comunicado de ${dateDisplay}` : `Comunicado ${index + 1}`);
  const type = normalizeAnnouncementType(title);
  if (!title && !url) return null;
  return {
    id: `${symbol || 'FII'}_announcement_${index + 1}`.toLowerCase(),
    title,
    type,
    date: dateDisplay,
    dateDisplay: dateDisplay || '—',
    url: url || undefined,
    documentUrl: url || undefined,
    pdfUrl: documentKind === 'pdf' ? url : undefined,
    documentKind,
    buttonLabel: documentKind === 'pdf' ? 'Abrir PDF' : 'Abrir',
    source: 'Investidor10'
  };
}


function extractPdfUrlFromAnnouncementDocument(html = '', baseUrl = '') {
  const text = String(html || '');
  if (!text) return '';
  const patterns = [
    /href=["']([^"']+\.pdf(?:[^"']*)?)["']/i,
    /content=["']([^"']+\.pdf(?:[^"']*)?)["']/i,
    /data-(?:url|href|file)=["']([^"']+\.pdf(?:[^"']*)?)["']/i,
    /(https?:\/\/[^\s"'<>]+\.pdf(?:[^\s"'<>]*)?)/i
  ];
  for (const re of patterns) {
    const match = text.match(re);
    const resolved = match?.[1] ? safeAbsoluteHttpUrl(match[1], baseUrl) : '';
    if (resolved && /\.pdf(?:$|[?#])/i.test(resolved)) return resolved;
  }
  return '';
}

async function enrichInvestidor10FiiAnnouncementPdfLinks(payload, { timeoutMs = 4500 } = {}) {
  if (!payload?.items?.length) return payload;
  const items = payload.items.slice();
  const candidates = [];
  for (let index = 0; index < Math.min(items.length, 8); index += 1) {
    const item = items[index];
    const url = item?.url || item?.documentUrl;
    if (!url || item.pdfUrl || /\.pdf(?:$|[?#])/i.test(url)) continue;
    if (!/investidor10\.com\.br|fnet\.b3\.com\.br|cvm\.gov\.br|fundsexplorer|comdinheiro/i.test(url)) continue;
    candidates.push({ index, item, url });
  }
  const results = await Promise.all(candidates.map(async ({ index, item, url }) => {
    try {
      const response = await fetchText(url, {
        timeoutMs: Math.min(2200, Math.max(1000, Number(timeoutMs) || 2200)),
        ttlMs: 30 * 60 * 1000,
        staleMs: 24 * 60 * 60 * 1000,
        retries: 0,
        headers: {
          Accept: 'text/html,application/xhtml+xml,application/pdf;q=0.9,*/*;q=0.8',
          Referer: payload.sourceUrl || 'https://investidor10.com.br/'
        }
      });
      const finalUrl = response?.finalUrl || url;
      const contentType = String(response?.contentType || '').toLowerCase();
      const finalKind = announcementKindFromUrl(finalUrl);
      const isPdfResponse = finalKind === 'pdf' || /application\/pdf|octet-stream|documento|download/i.test(contentType);
      const pdfUrl = isPdfResponse
        ? safeAbsoluteHttpUrl(finalUrl, url)
        : extractPdfUrlFromAnnouncementDocument(response?.text || '', finalUrl || url);
      if (pdfUrl) {
        return {
          index,
          resolved: true,
          item: {
            ...item,
            pdfUrl,
            documentUrl: pdfUrl,
            documentKind: 'pdf',
            buttonLabel: 'Abrir PDF'
          }
        };
      }
      if (item.documentKind === 'pdf') {
        return {
          index,
          resolved: false,
          item: {
            ...item,
            pdfUrl: item.pdfUrl || item.documentUrl || item.url,
            documentUrl: item.documentUrl || item.url,
            buttonLabel: 'Abrir PDF'
          }
        };
      }
    } catch {
      // Mantém o link oficial se a página intermediária não puder ser resolvida dentro do orçamento do modal.
    }
    return { index, resolved: false, item };
  }));
  let resolved = 0;
  for (const result of results) {
    if (result?.item) items[result.index] = result.item;
    if (result?.resolved) resolved += 1;
  }
  return {
    ...payload,
    items,
    diagnostics: {
      ...(payload.diagnostics || {}),
      pdfResolvedFromIntermediatePages: resolved,
      pdfLinksFound: items.filter(item => item.pdfUrl).length,
      pdfResolutionStrategy: 'parallel_top_8_v300'
    }
  };
}

function extractInvestidor10FiiAnnouncements(html = '', ticker = '') {
  const symbol = String(ticker || '').toUpperCase();
  const baseUrl = symbol ? `https://investidor10.com.br/fiis/${symbol.toLowerCase()}/` : 'https://investidor10.com.br/';
  const foundSectionHtml = findAnnouncementsHtmlSection(html, symbol);
  const wholeDocumentLooksLikeAnnouncements = /Data\s+de\s+Divulga(?:ç|c)[ãa]o|link_comunicado|COMUNICADOS|Fatos\s+Relevantes|Aviso\s+aos\s+Acionistas/i.test(String(html || ''));
  const sectionHtml = foundSectionHtml || (wholeDocumentLooksLikeAnnouncements ? String(html || '') : '');
  if (!sectionHtml) return emptyFiiAnnouncements(symbol, { found: false, reason: 'section_not_found' });
  const items = [];
  const anchorRe = /<a\b([^>]*?)href=["']([^"']+)["']([^>]*)>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = anchorRe.exec(sectionHtml))) {
    const href = match[2] || '';
    const anchorText = htmlToPlainText(match[4] || '');
    const rowHtml = closestHtmlRowForAnchor(sectionHtml, match.index, anchorRe.lastIndex);
    const rowText = htmlToPlainText(rowHtml);
    if (!/abrir|pdf|comunicado|fato|aviso|relat[oó]rio|assembleia|distribui/i.test(`${anchorText} ${rowText} ${href}`)) continue;
    const item = announcementFromRow({ rowText, href, anchorText, ticker: symbol, index: items.length, baseUrl });
    if (item?.url && !items.some(existing => existing.url === item.url && existing.title === item.title && existing.dateDisplay === item.dateDisplay)) {
      items.push(item);
    }
  }

  if (!items.length) {
    const text = htmlToPlainText(sectionHtml);
    const rowRe = /([^\n\r]{4,160}?)\s+(\d{2}\/\d{2}\/\d{4})(?:\s+ABRIR)?/gi;
    let textMatch;
    while ((textMatch = rowRe.exec(text))) {
      const title = normalizeAnnouncementTitle(textMatch[1] || '', 'Comunicado');
      if (!title || /COMUNICADOS/i.test(title)) continue;
      const item = announcementFromRow({ rowText: `${title} ${textMatch[2]} ABRIR`, href: '', anchorText: title, ticker: symbol, index: items.length, baseUrl });
      if (item) items.push(item);
    }
  }

  return {
    id: 'fii_announcements',
    title: symbol ? `Comunicados do ${symbol}` : 'Comunicados do FII',
    status: items.length ? 'OK' : 'EMPTY',
    source: 'Investidor10',
    sourceUrl: baseUrl,
    ticker: symbol,
    items: items.slice(0, 50),
    pagination: {
      page: 1,
      pageSize: 5,
      hasPrevious: false,
      hasNext: items.length > 5
    },
    diagnostics: {
      found: true,
      linksFound: items.filter(item => item.url).length,
      pdfLinksFound: items.filter(item => item.pdfUrl).length,
      totalItems: items.length
    }
  };
}

function mergeFiiAnnouncementsPayloads(...payloads) {
  const validPayloads = payloads.filter(Boolean);
  const base = validPayloads.find(payload => payload?.ticker || payload?.sourceUrl) || {};
  const symbol = String(base?.ticker || '').toUpperCase();
  const merged = [];
  const seen = new Set();
  for (const payload of validPayloads) {
    for (const item of Array.isArray(payload?.items) ? payload.items : []) {
      const key = item?.url || item?.documentUrl || `${normalizeLooseText(item?.title)}|${item?.dateDisplay || item?.date || ''}`;
      if (!key || seen.has(key)) continue;
      seen.add(key);
      merged.push({ ...item, id: `${symbol || 'fii'}_announcement_${merged.length + 1}`.toLowerCase() });
    }
  }
  return {
    id: 'fii_announcements',
    title: symbol ? `Comunicados do ${symbol}` : 'Comunicados do FII',
    status: merged.length ? 'OK' : 'EMPTY',
    source: 'Investidor10',
    sourceUrl: base?.sourceUrl || (symbol ? `https://investidor10.com.br/fiis/${symbol.toLowerCase()}/` : undefined),
    ticker: symbol,
    items: merged.slice(0, 60),
    pagination: {
      page: 1,
      pageSize: 5,
      hasPrevious: false,
      hasNext: merged.length > 5
    },
    diagnostics: {
      mergedPayloads: validPayloads.length,
      totalItems: merged.length,
      linksFound: merged.filter(item => item.url).length,
      pdfLinksFound: merged.filter(item => item.pdfUrl).length,
      sources: validPayloads.map(payload => payload?.diagnostics?.parsedFrom || payload?.sourceUrl || payload?.diagnostics?.reason || 'main_page')
    }
  };
}

async function fetchInvestidor10FiiAnnouncementsPages(ticker, { timeoutMs = 4500, maxPages = 3 } = {}) {
  const symbol = String(ticker || '').toUpperCase();
  if (!symbol) return emptyFiiAnnouncements(symbol, { reason: 'ticker_missing' });
  const pages = Array.from({ length: Math.max(1, Math.min(5, Number(maxPages) || 3)) }, (_, index) => index + 1);
  const payloads = (await Promise.all(pages.map(async page => {
    const url = `https://investidor10.com.br/communications/fii/${symbol}/?page=${page}`;
    try {
      const response = await fetchText(url, {
        timeoutMs: Math.min(2600, Math.max(1100, Number(timeoutMs) || 2600)),
        ttlMs: 15 * 60 * 1000,
        staleMs: 24 * 60 * 60 * 1000,
        retries: 0,
        headers: {
          Accept: 'text/html,application/xhtml+xml,*/*;q=0.8',
          Referer: `https://investidor10.com.br/fiis/${symbol.toLowerCase()}/`
        }
      });
      const html = response?.text || '';
      if (!html) return null;
      const payload = extractInvestidor10FiiAnnouncements(html, symbol);
      if (payload?.items?.length) {
        return {
          ...payload,
          sourceUrl: url,
          diagnostics: { ...(payload.diagnostics || {}), parsedFrom: 'communications_route', page, status: response?.status, cacheStatus: response?.cacheStatus }
        };
      }
    } catch {
      // A rota de comunicados é complementar; a página principal segue sendo a fonte base do modal.
    }
    return null;
  }))).filter(Boolean);
  return payloads.length
    ? mergeFiiAnnouncementsPayloads(...payloads)
    : emptyFiiAnnouncements(symbol, { reason: 'communications_route_empty' });
}

function emptyFiiVacancyHistory(ticker = '', diagnostics = {}) {
  const symbol = String(ticker || '').toUpperCase();
  return {
    id: 'fii_vacancy_history',
    title: symbol ? `Histórico da taxa de vacância ${symbol}` : 'Histórico da taxa de vacância',
    status: 'EMPTY',
    source: 'Investidor10',
    sourceUrl: symbol ? `https://investidor10.com.br/fiis/${symbol.toLowerCase()}/` : undefined,
    ticker: symbol,
    defaultPeriod: '12m',
    periodOptions: [
      { key: '12m', label: '12m', months: 12 },
      { key: '2025', label: '2025' },
      { key: '2024', label: '2024' },
      { key: '2023', label: '2023' },
      { key: '2022', label: '2022' }
    ],
    points: [],
    diagnostics
  };
}


function emptyFiiPatrimonialInfo(ticker = '', diagnostics = {}) {
  const symbol = String(ticker || '').toUpperCase();
  return {
    id: 'fii_patrimonial_info',
    title: 'Informações sobre valor patrimonial',
    status: 'EMPTY',
    source: 'Investidor10',
    sourceUrl: symbol ? `https://investidor10.com.br/fiis/${symbol.toLowerCase()}/` : undefined,
    ticker: symbol,
    description: 'O valor patrimonial ajuda a comparar o preço negociado da cota com o valor contábil dos ativos do fundo.',
    bars: [],
    metrics: [],
    segmentAverage: {
      id: 'fii_type_segment_average',
      title: 'Média do tipo e segmento',
      subtitle: 'Mesmo tipo e segmento',
      filterLabel: 'Mesmo tipo e segmento',
      description: '',
      rows: []
    },
    diagnostics
  };
}


function emptyFiiAnnouncements(ticker = '', diagnostics = {}) {
  const symbol = String(ticker || '').toUpperCase();
  return {
    id: 'fii_announcements',
    title: symbol ? `Comunicados do ${symbol}` : 'Comunicados do FII',
    status: 'EMPTY',
    source: 'Investidor10',
    sourceUrl: symbol ? `https://investidor10.com.br/fiis/${symbol.toLowerCase()}/` : undefined,
    ticker: symbol,
    items: [],
    pagination: {
      page: 1,
      pageSize: 5,
      hasPrevious: false,
      hasNext: false
    },
    diagnostics
  };
}

function safeAbsoluteHttpUrl(href = '', base = '') {
  const raw = decodeHtmlEntities(String(href || '').trim());
  if (!raw || /^javascript:/i.test(raw) || /^mailto:/i.test(raw) || /^tel:/i.test(raw) || raw === '#') return '';
  try {
    const parsed = new URL(raw, base || 'https://investidor10.com.br/');
    if (!/^https?:$/i.test(parsed.protocol)) return '';
    return parsed.toString();
  } catch {
    return raw;
  }
}

function normalizeAnnouncementType(title = '', explicitType = '') {
  const cleanType = cleanInvestidor10InfoValue(explicitType);
  if (cleanType) return cleanType;
  const text = cleanInvestidor10InfoValue(title);
  const afterDash = text.match(/[-–—]\s*([^–—-]{3,80})$/)?.[1];
  if (afterDash) return cleanInvestidor10InfoValue(afterDash);
  if (/fato/i.test(text)) return 'Fatos Relevantes';
  if (/distribui/i.test(text)) return 'Distribuições';
  if (/relat[oó]rio/i.test(text)) return 'Relatórios';
  if (/assembleia|ata|agm|age/i.test(text)) return 'Assembleia';
  return 'Comunicado';
}

function normalizeAnnouncementTitle(value = '', fallback = 'Comunicado') {
  return cleanInvestidor10InfoValue(value)
    .replace(/Data\s+de\s+Divulga(?:ç|c)[ãa]o\s*:?\s*\d{2}\/\d{2}\/\d{4}/gi, ' ')
    .replace(/\bABRIR\b/gi, ' ')
    .replace(/\bopen_in_new\b/gi, ' ')
    .replace(/\bPDF\b\s*$/gi, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim() || fallback;
}

function announcementKindFromUrl(url = '') {
  const clean = String(url || '');
  return /\.pdf(?:$|[?#])/i.test(clean)
    || /\/link_comunicado\//i.test(clean)
    || /downloadDocumento|download-documento|arquivo=.*pdf|file=.*pdf|documento/i.test(clean)
    ? 'pdf'
    : 'external';
}

function closestHtmlRowForAnchor(sectionHtml = '', anchorStart = 0, anchorEnd = anchorStart) {
  const before = sectionHtml.slice(0, anchorStart);
  const candidates = ['<tr', '<li', '<article', '<div', '<p'];
  let rowStart = -1;
  for (const tag of candidates) {
    const idx = before.toLowerCase().lastIndexOf(tag);
    if (idx > rowStart && anchorStart - idx < 1800) rowStart = idx;
  }
  if (rowStart < 0) rowStart = Math.max(0, anchorStart - 900);
  const after = sectionHtml.slice(anchorEnd);
  const lowerAfter = after.toLowerCase();
  const closes = ['</tr>', '</li>', '</article>', '</div>', '</p>'];
  let closeOffset = -1;
  for (const tag of closes) {
    const idx = lowerAfter.indexOf(tag);
    if (idx >= 0 && (closeOffset < 0 || idx < closeOffset)) closeOffset = idx + tag.length;
  }
  const rowEnd = closeOffset >= 0 ? anchorEnd + closeOffset : Math.min(sectionHtml.length, anchorEnd + 420);
  return sectionHtml.slice(rowStart, rowEnd);
}

function compactDisplayValue(value = '') {
  return cleanInvestidor10InfoValue(value)
    .replace(/\s*:\s*/g, ': ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function parseScaledNumber(value = '') {
  return parseMoneyScale(value);
}

function pickSupplementaryValue(summary = {}, labels = []) {
  if (!summary || typeof summary !== 'object') return '';
  const normalizedLabels = labels.map(label => normalizeLooseText(label));
  for (const [key, value] of Object.entries(summary)) {
    if (normalizedLabels.includes(normalizeLooseText(key))) {
      const clean = compactDisplayValue(value);
      if (clean) return clean;
    }
  }
  return '';
}

function extractValueAfterLabel(section = '', labelPattern = '', stopPattern = '') {
  if (!section || !labelPattern) return '';
  const re = new RegExp(`${labelPattern}\\s*:?\\s*([\\s\\S]{0,140})`, 'i');
  const match = section.match(re);
  if (!match) return '';
  let chunk = match[1] || '';
  const stopRe = stopPattern
    ? new RegExp(stopPattern, 'i')
    : /(?:VALOR\s+PATRIMONIAL\s+POR\s+COTA|VALOR\s+DA\s+COTA|N[ÚU]MERO\s+DE\s+COTAS|P\s*\/\s*VP|VALOR\s+PATRIMONIAL|M[ÉE]DIA\s+DO\s+TIPO|COMPARA[ÇC][ÃA]O|NOT[ÍI]CIAS|D[ÚU]VIDAS|$)/i;
  const stop = chunk.search(stopRe);
  if (stop > 0) chunk = chunk.slice(0, stop);
  const money = chunk.match(/R\$\s*[\d.,]+\s*(?:Trilh[õo]es|Trilh[ãa]o|Bilhões|Bilhoes|Bilhão|Bilhao|Milhões|Milhoes|Milhão|Milhao|Mil|mi|bi|m|b)?/i)?.[0];
  if (money) return compactDisplayValue(money);
  const percent = chunk.match(/[+-]?\d{1,3}(?:[.,]\d+)?\s*%/)?.[0];
  if (percent) return compactDisplayValue(percent);
  const scaled = chunk.match(/[\d.,]+\s*(?:Trilh[õo]es|Trilh[ãa]o|Bilhões|Bilhoes|Bilhão|Bilhao|Milhões|Milhoes|Milhão|Milhao|Mil|mi|bi|m|b)\b/i)?.[0];
  if (scaled) return compactDisplayValue(scaled);
  const number = chunk.match(/[+-]?\d{1,3}(?:\.\d{3})*(?:,\d+)?|[+-]?\d+(?:\.\d+)?/)?.[0];
  return compactDisplayValue(number || '');
}

function findPatrimonialSection(html = '') {
  const plain = htmlToPlainText(html);
  const start = plain.search(/INFORMA[ÇC][ÕO]ES\s+SOBRE\s+VALOR\s+PATRIMONIAL/i);
  if (start < 0) return '';
  const raw = plain.slice(start, start + 4200);
  const endRel = raw.slice(60).search(/M[ÉE]DIA\s+DO\s+TIPO\s+E\s+SEGMENTO|NOT[ÍI]CIAS\s+SOBRE|D[ÚU]VIDAS\s+COMUNS|FIIS\s+RELACIONADOS|Copyright/i);
  return normalizePeerTableText(endRel >= 0 ? raw.slice(0, 60 + endRel) : raw);
}

function findTypeSegmentAverageSection(html = '') {
  const plain = htmlToPlainText(html);
  const start = plain.search(/M[ÉE]DIA\s+DO\s+TIPO\s+E\s+SEGMENTO/i);
  if (start < 0) return '';
  const raw = plain.slice(start, start + 5200);
  const endRel = raw.slice(60).search(/NOT[ÍI]CIAS\s+SOBRE|D[ÚU]VIDAS\s+COMUNS|FIIS\s+RELACIONADOS|Avalie\s+o\s+FII|Copyright/i);
  return normalizePeerTableText(endRel >= 0 ? raw.slice(0, 60 + endRel) : raw);
}

function extractComparisonValuePair(section = '', labelPattern = '') {
  if (!section || !labelPattern) return null;
  const re = new RegExp(`${labelPattern}\\s*:?\\s*([\\s\\S]{1,140}?)\\s+Compara[çc][ãa]o\\s*:?\\s*([\\s\\S]{1,140})`, 'i');
  const match = section.match(re);
  if (!match) return null;
  const cleanAsset = extractFirstDisplayToken(match[1]);
  const comparisonRaw = (match[2] || '').replace(/(?:GGRC\d{2}|[A-Z]{4}\d{2})\s+(?:P\s*\/\s*VP|DY\s*\(12M\))|Valor\s+Patrimonial\s*:|Val\.\s*Patrimonial|NOT[ÍI]CIAS|D[ÚU]VIDAS/ig, ' §STOP§ ');
  const cleanComparison = extractFirstDisplayToken(comparisonRaw.split('§STOP§')[0] || comparisonRaw);
  if (!cleanAsset && !cleanComparison) return null;
  return { assetDisplay: cleanAsset, comparisonDisplay: cleanComparison };
}

function extractFirstDisplayToken(raw = '') {
  const value = compactDisplayValue(raw);
  if (!value) return '';
  const money = value.match(/R\$\s*[\d.,]+\s*(?:Trilh[õo]es|Trilh[ãa]o|Bilhões|Bilhoes|Bilhão|Bilhao|Milhões|Milhoes|Milhão|Milhao|Mil|mi|bi|m|b)?/i)?.[0];
  if (money) return compactDisplayValue(money);
  const percent = value.match(/[+-]?\d{1,3}(?:[.,]\d+)?\s*%/)?.[0];
  if (percent) return compactDisplayValue(percent);
  const scaled = value.match(/[\d.,]+\s*(?:Trilh[õo]es|Trilh[ãa]o|Bilhões|Bilhoes|Bilhão|Bilhao|Milhões|Milhoes|Milhão|Milhao|Mil|mi|bi|m|b)\b/i)?.[0];
  if (scaled) return compactDisplayValue(scaled);
  const number = value.match(/[+-]?\d{1,3}(?:\.\d{3})*(?:,\d+)?|[+-]?\d+(?:\.\d+)?/)?.[0];
  return compactDisplayValue(number || '');
}

function displayToNumber(value = '', valueType = '') {
  const type = String(valueType || '').toLowerCase();
  if (type === 'money' || /r\$|bilh|milh|\bmil\b|\bmi\b|\bbi\b/i.test(String(value || ''))) return parseMoneyScale(value);
  return parseBrNumber(value);
}

function buildTypeSegmentAverageRows({ html = '', ticker = '', quickMetrics = {}, infoItems = [], peerComparison = null, patrimonial = {} } = {}) {
  const symbol = String(ticker || '').toUpperCase();
  const section = findTypeSegmentAverageSection(html);
  const rows = [];
  const fundType = firstInfoValue(infoItems, ['tipo_fundo']);
  const segment = firstInfoValue(infoItems, ['segmento']);
  const addRow = ({ id, label, assetDisplay, comparisonDisplay, valueType = 'number', help = '' } = {}) => {
    const cleanAsset = compactDisplayValue(assetDisplay || '');
    const cleanComparison = compactDisplayValue(comparisonDisplay || '');
    if (!cleanAsset && !cleanComparison) return;
    rows.push({
      id,
      label,
      assetLabel: id === 'pvp' ? `${symbol} P/VP` : id === 'dy12m' ? `${symbol} DY (12M)` : label,
      assetDisplay: cleanAsset || '—',
      assetValue: displayToNumber(cleanAsset, valueType),
      comparisonLabel: 'Comparação',
      comparisonDisplay: cleanComparison || '—',
      comparisonValue: displayToNumber(cleanComparison, valueType),
      valueType,
      help,
      source: section ? 'Investidor10 média do tipo e segmento' : 'Investidor10 dados relacionados'
    });
  };
  const pvpPair = extractComparisonValuePair(section, `${escapeRegExp(symbol)}\\s+P\\s*\\/\\s*VP`);
  const dyPair = extractComparisonValuePair(section, `${escapeRegExp(symbol)}\\s+DY\\s*\\(12M\\)`);
  const patrimonyPair = extractComparisonValuePair(section, 'Valor\\s+Patrimonial');
  const vpCotaPair = extractComparisonValuePair(section, 'Val\\.?\\s+Patrimonial\\s+p\\s*\\/\\s*Cota');

  const peerRows = Array.isArray(peerComparison?.rows) ? peerComparison.rows : [];
  const peerMode = String(peerComparison?.diagnostics?.mode || '').toLowerCase();
  // "FIIs relacionados" não prova que cada fundo pertence ao mesmo tipo/segmento.
  // Só usar médias calculadas quando a tabela comparativa da própria fonte declarou
  // o recorte de mesmo tipo e segmento.
  const peers = peerMode === 'related_fiis_real_source'
    ? []
    : peerRows.filter(row => !row?.isReference);
  const avg = (values) => {
    const nums = values.map(Number).filter(Number.isFinite);
    if (!nums.length) return null;
    return nums.reduce((acc, v) => acc + v, 0) / nums.length;
  };
  const avgPvp = avg(peers.map(row => row.pvp));
  const avgDy = avg(peers.map(row => row.dividendYield));
  const avgPatrimony = avg(peers.map(row => row.patrimonialValue));

  addRow({
    id: 'pvp',
    label: 'P/VP',
    assetDisplay: pvpPair?.assetDisplay || quickMetrics?.pvpDisplay || (finiteNumberOrNull(quickMetrics?.pvp) !== null ? String(round(Number(quickMetrics.pvp), 2)).replace('.', ',') : ''),
    comparisonDisplay: pvpPair?.comparisonDisplay || (Number.isFinite(avgPvp) ? String(round(avgPvp, 2)).replace('.', ',') : ''),
    valueType: 'number',
    help: 'Compara o P/VP do fundo com a média dos FIIs do mesmo tipo e segmento.'
  });
  addRow({
    id: 'dy12m',
    label: 'DY (12M)',
    assetDisplay: dyPair?.assetDisplay || quickMetrics?.dy12mDisplay || (finiteNumberOrNull(quickMetrics?.dy12m) !== null ? formatPercent(Number(quickMetrics.dy12m), false) : ''),
    comparisonDisplay: dyPair?.comparisonDisplay || (Number.isFinite(avgDy) ? formatPercent(avgDy, false) : ''),
    valueType: 'percent',
    help: 'Compara o dividend yield acumulado em 12 meses com a média do segmento.'
  });
  addRow({
    id: 'patrimonial_value',
    label: 'Valor Patrimonial',
    assetDisplay: patrimonyPair?.assetDisplay || patrimonial?.patrimonialValueDisplay || firstInfoValue(infoItems, ['valor_patrimonial']),
    comparisonDisplay: patrimonyPair?.comparisonDisplay || (Number.isFinite(avgPatrimony) ? formatCompactMoney(avgPatrimony) : ''),
    valueType: 'money',
    help: 'Compara o tamanho patrimonial do fundo com a média dos pares do mesmo recorte.'
  });
  addRow({
    id: 'patrimonial_value_per_share',
    label: 'Val. Patrimonial p/ Cota',
    assetDisplay: vpCotaPair?.assetDisplay || patrimonial?.patrimonialValuePerShareDisplay || firstInfoValue(infoItems, ['valor_patrimonial_cota']),
    comparisonDisplay: vpCotaPair?.comparisonDisplay || '',
    valueType: 'money',
    help: 'Compara o valor patrimonial por cota com a média do mesmo tipo e segmento.'
  });
  const description = section.match(/Comparando\s+o\s+[\s\S]{0,260}?\./i)?.[0]
    || (fundType || segment ? `Comparando o ${symbol} com a média dos indicadores dos FIIs de tipo (${fundType || '—'}) e do segmento (${segment || '—'}).` : 'Comparação com a média dos FIIs do mesmo tipo e segmento.');
  return {
    id: 'fii_type_segment_average',
    title: 'Média do tipo e segmento',
    subtitle: 'Mesmo tipo e segmento',
    filterLabel: 'Mesmo tipo e segmento',
    description: cleanInvestidor10InfoValue(description),
    rows,
    diagnostics: { parsedFrom: section ? 'investidor10_html_section' : 'peer_comparison_only_when_same_type_segment_is_proven', sectionFound: Boolean(section), peerRows: peerRows.length, peerMode, calculatedPeerRows: peers.length }
  };
}

function buildFiiPatrimonialInfoPayload({ html = '', ticker = '', quickMetrics = {}, infoItems = [], canonical = {}, peerComparison = null } = {}) {
  const symbol = String(ticker || '').toUpperCase();
  const section = findPatrimonialSection(html);
  const supplementary = canonical?.fii?.patrimonialSummary || canonical?.fii?.supplementaryInfo || canonical?.supplementaryInfo || {};
  const valuePerShareDisplay = extractValueAfterLabel(section, 'VALOR\\s+PATRIMONIAL\\s+POR\\s+COTA')
    || pickSupplementaryValue(supplementary, ['Valor patrimonial por cota', 'Val. Patrimonial p/ Cota'])
    || firstInfoValue(infoItems, ['valor_patrimonial_cota']);
  const sharePriceDisplay = extractValueAfterLabel(section, 'VALOR\\s+DA\\s+COTA')
    || pickSupplementaryValue(supplementary, ['Valor da cota'])
    || quickMetrics?.priceDisplay;
  const sharesDisplay = extractValueAfterLabel(section, 'N[ÚU]MERO\\s+DE\\s+COTAS')
    || pickSupplementaryValue(supplementary, ['Número de cotas'])
    || firstInfoValue(infoItems, ['cotas_emitidas']);
  const pvpDisplay = extractValueAfterLabel(section, 'P\\s*\\/\\s*VP')
    || pickSupplementaryValue(supplementary, ['P/VP'])
    || quickMetrics?.pvpDisplay;
  const patrimonialValueDisplay = (section.match(/VALOR\s+PATRIMONIAL\s+(?:TOTAL\s+)?(R\$\s*[\d.,]+\s*(?:Trilh[õo]es|Trilh[ãa]o|Bilhões|Bilhoes|Bilhão|Bilhao|Milhões|Milhoes|Milhão|Milhao|Mil|mi|bi|m|b)?)/i)?.[1] || '')
    || extractValueAfterLabel(section, 'VALOR\\s+PATRIMONIAL(?!\\s+POR\\s+COTA)')
    || pickSupplementaryValue(supplementary, ['Valor patrimonial'])
    || firstInfoValue(infoItems, ['valor_patrimonial']);
  const bars = [
    {
      id: 'patrimonial_value_per_share',
      label: 'Valor patrimonial por cota',
      value: parseMoneyScale(valuePerShareDisplay),
      valueDisplay: valuePerShareDisplay || '—',
      role: 'book_value',
      help: 'Representa o valor patrimonial contábil dividido pelo número de cotas do fundo.'
    },
    {
      id: 'share_price',
      label: 'Valor da cota',
      value: parseMoneyScale(sharePriceDisplay),
      valueDisplay: sharePriceDisplay || '—',
      role: 'market_price',
      help: 'Mostra o preço de mercado da cota, usado para comparar prêmio ou desconto em relação ao valor patrimonial.'
    }
  ].filter(item => item.valueDisplay && item.valueDisplay !== '—');
  const metrics = [
    {
      id: 'shares_count',
      label: 'Número de cotas',
      value: parseScaledNumber(sharesDisplay),
      valueDisplay: sharesDisplay || '—',
      help: 'Quantidade de cotas emitidas pelo fundo.'
    },
    {
      id: 'pvp',
      label: 'P/VP',
      value: parseBrNumber(pvpDisplay),
      valueDisplay: pvpDisplay || '—',
      help: 'Preço sobre valor patrimonial. Abaixo de 1 indica cotação menor que o valor patrimonial por cota.'
    },
    {
      id: 'patrimonial_value',
      label: 'Valor patrimonial',
      value: parseMoneyScale(patrimonialValueDisplay),
      valueDisplay: patrimonialValueDisplay || '—',
      help: 'Valor patrimonial total informado para o fundo.'
    }
  ].filter(item => item.valueDisplay && item.valueDisplay !== '—');
  const segmentAverage = buildTypeSegmentAverageRows({ html, ticker: symbol, quickMetrics, infoItems, peerComparison, patrimonial: {
    patrimonialValuePerShareDisplay: valuePerShareDisplay,
    patrimonialValueDisplay
  } });
  if (!bars.length && !metrics.length && !segmentAverage.rows.length) return emptyFiiPatrimonialInfo(symbol, { reason: 'patrimonial_info_not_found' });
  return {
    id: 'fii_patrimonial_info',
    title: 'Informações sobre valor patrimonial',
    status: 'OK',
    source: 'Investidor10',
    sourceUrl: symbol ? `https://investidor10.com.br/fiis/${symbol.toLowerCase()}/` : undefined,
    ticker: symbol,
    description: 'O valor patrimonial é um item determinante para ser analisado antes de adquirir qualquer fundo imobiliário. Através dos dados patrimoniais você pode saber qual o valor real dos ativos pertencentes ao FII.',
    bars,
    metrics,
    segmentAverage,
    diagnostics: {
      parsedFrom: section ? 'investidor10_html_section' : 'canonical_supplementary_source',
      sectionFound: Boolean(section),
      barCount: bars.length,
      metricCount: metrics.length,
      segmentRows: segmentAverage.rows.length
    }
  };
}


const VACANCY_MONTHS_PT = Object.freeze([
  ['janeiro', 1], ['jan', 1],
  ['fevereiro', 2], ['fev', 2],
  ['março', 3], ['marco', 3], ['mar', 3],
  ['abril', 4], ['abr', 4],
  ['maio', 5], ['mai', 5],
  ['junho', 6], ['jun', 6],
  ['julho', 7], ['jul', 7],
  ['agosto', 8], ['ago', 8],
  ['setembro', 9], ['set', 9],
  ['outubro', 10], ['out', 10],
  ['novembro', 11], ['nov', 11],
  ['dezembro', 12], ['dez', 12]
]);
const VACANCY_MONTH_TO_NUMBER = Object.freeze(Object.fromEntries(VACANCY_MONTHS_PT.map(([name, month]) => [normalizeLooseText(name), month])));

function vacancyPointLabel(year, month, fallback = '') {
  if (Number.isFinite(Number(year)) && Number.isFinite(Number(month)) && Number(month) >= 1 && Number(month) <= 12) {
    const months = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
    return `${months[Number(month) - 1]}/${year}`;
  }
  return cleanInvestidor10InfoValue(fallback || `${year || ''}`).trim();
}

function normalizeVacancyPeriodKey(value = '', fallback = '12m') {
  const raw = cleanInvestidor10InfoValue(value).toLowerCase();
  if (/^12\s*m/.test(raw)) return '12m';
  const y = raw.match(/\b(20\d{2}|19\d{2})\b/)?.[1];
  return y || fallback;
}

function vacancyPercentDisplay(value) {
  return formatPercent(value, false);
}

function vacancyPointFromParts({ label = '', year = null, month = null, vacancy = null, occupancy = null, periodKey = '12m', source = 'Investidor10' } = {}) {
  const vacancyNumber = Number(vacancy);
  if (!Number.isFinite(vacancyNumber) || vacancyNumber < 0 || vacancyNumber > 100) return null;
  const occupancyProvided = occupancy !== null && occupancy !== undefined && occupancy !== '' && Number.isFinite(Number(occupancy));
  const occupancyNumber = occupancyProvided ? Number(occupancy) : Math.max(0, 100 - vacancyNumber);
  const y = year !== null && year !== undefined && year !== '' && Number.isFinite(Number(year)) ? Number(year) : Number(String(label).match(/\b(20\d{2}|19\d{2})\b/)?.[1]);
  const normalizedLabel = vacancyPointLabel(y, month, label);
  const date = Number.isFinite(y) && Number.isFinite(Number(month)) ? `${y}-${String(Number(month)).padStart(2, '0')}-01` : '';
  return {
    period: date || normalizedLabel || String(label || ''),
    label: normalizedLabel || String(label || ''),
    date: date || undefined,
    year: Number.isFinite(y) ? y : undefined,
    month: Number.isFinite(Number(month)) ? Number(month) : undefined,
    periodKey,
    vacancyPercent: round(vacancyNumber, 4),
    vacancyDisplay: vacancyPercentDisplay(vacancyNumber),
    occupancyPercent: round(Math.max(0, Math.min(100, occupancyNumber)), 4),
    occupancyDisplay: vacancyPercentDisplay(Math.max(0, Math.min(100, occupancyNumber))),
    occupancyCalculated: !occupancyProvided,
    source
  };
}

function monthYearFromText(value = '') {
  const raw = cleanInvestidor10InfoValue(value);
  const m = raw.match(/\b([A-Za-zÀ-ÿ]{3,12})\s*[\/-]\s*(20\d{2}|19\d{2})\b/i);
  if (!m) return null;
  const month = VACANCY_MONTH_TO_NUMBER[normalizeLooseText(m[1])] || VACANCY_MONTH_TO_NUMBER[normalizeLooseText(m[1]).slice(0, 3)];
  if (!month) return null;
  return { label: `${m[1]}/${m[2]}`, year: Number(m[2]), month };
}

function normalizeFiiVacancyApiPoint(item, periodKey = '12m') {
  if (item == null) return null;
  if (Array.isArray(item)) {
    const labelInfo = monthYearFromText(item[0]) || { label: String(item[0] || '') };
    return vacancyPointFromParts({ ...labelInfo, vacancy: parseBrNumber(item[1]), occupancy: parseBrNumber(item[2]), periodKey, source: 'Investidor10 API taxa de vacância' });
  }
  if (typeof item !== 'object') return null;
  const labelRaw = item.label ?? item.period ?? item.periodo ?? item.date ?? item.data ?? item.name ?? item.mes ?? item.month ?? '';
  const labelInfo = monthYearFromText(labelRaw) || monthYearFromText(`${item.mes || item.month || ''}/${item.ano || item.year || ''}`) || { label: String(labelRaw || item.ano || item.year || '') };
  const vacancy = parseBrNumber(item.vacancyPercent ?? item.vacanciaPercent ?? item.vacancia ?? item.vacância ?? item.taxaVacancia ?? item.taxa_vacancia ?? item.value ?? item.valor ?? item.y);
  const occupancy = parseBrNumber(item.occupancyPercent ?? item.ocupacaoPercent ?? item.ocupacao ?? item.ocupação ?? item.occupied ?? item.ocupado);
  return vacancyPointFromParts({ ...labelInfo, vacancy, occupancy, periodKey: normalizeVacancyPeriodKey(item.periodKey || item.period || item.periodo || periodKey, periodKey), source: item.source || 'Investidor10 API taxa de vacância' });
}

function collectFiiVacancyApiPoints(node, periodKey = '12m', depth = 0) {
  if (node == null || depth > 6) return [];
  if (Array.isArray(node)) {
    const direct = node.map(item => normalizeFiiVacancyApiPoint(item, periodKey)).filter(Boolean);
    if (direct.length >= 2) return direct;
    return node.flatMap(item => collectFiiVacancyApiPoints(item, periodKey, depth + 1));
  }
  if (typeof node !== 'object') return [];
  const keys = Object.keys(node);
  const keyText = normalizeLooseText(keys.join(' '));
  const likelyVacancyContainer = /vacancia|vacancy|ocupacao|ocupancy|occupancy/.test(keyText);
  const candidateArrays = [];
  for (const [key, value] of Object.entries(node)) {
    if (Array.isArray(value)) candidateArrays.push({ key, value });
  }
  for (const { key, value } of candidateArrays) {
    if (likelyVacancyContainer || /vacancia|vacancy|ocupacao|occupancy|data|points|series|items|values|chart/.test(normalizeLooseText(key))) {
      const rows = collectFiiVacancyApiPoints(value, normalizeVacancyPeriodKey(key, periodKey), depth + 1);
      if (rows.length >= 2) return rows;
    }
  }
  for (const value of Object.values(node)) {
    const rows = collectFiiVacancyApiPoints(value, periodKey, depth + 1);
    if (rows.length >= 2) return rows;
  }
  return [];
}

function extractFiiVacancyHistoryFromHtml(html = '', ticker = '') {
  const plain = htmlToPlainText(html);
  const symbol = String(ticker || '').toUpperCase();
  const start = plain.search(new RegExp(`HIST[ÓO]RICO\\s+DA\\s+TAXA\\s+DE\\s+VAC[ÂA]NCIA\\s+${escapeRegExp(symbol)}`, 'i')) >= 0
    ? plain.search(new RegExp(`HIST[ÓO]RICO\\s+DA\\s+TAXA\\s+DE\\s+VAC[ÂA]NCIA\\s+${escapeRegExp(symbol)}`, 'i'))
    : plain.search(/HIST[ÓO]RICO\s+DA\s+TAXA\s+DE\s+VAC[ÂA]NCIA/i);
  if (start < 0) return [];
  const raw = plain.slice(start, start + 4200);
  const endRel = raw.slice(70).search(/(?:COMUNICADOS\s+DO|INFORMA[ÇC][ÕO]ES\s+SOBRE\s+VALOR\s+PATRIMONIAL|M[ÉE]DIA\s+DO\s+TIPO|D[ÚU]VIDAS\s+COMUNS|NOT[ÍI]CIAS\s+SOBRE|Copyright)/i);
  const section = normalizePeerTableText(endRel >= 0 ? raw.slice(0, 70 + endRel) : raw);
  const direct = [];
  const directRe = /\b([A-Za-zÀ-ÿ]{3,12}\s*[\/-]\s*(?:20\d{2}|19\d{2}))\b[^%]{0,80}?([+-]?\d{1,3}(?:[.,]\d+)?)\s*%/gi;
  let dm;
  while ((dm = directRe.exec(section)) !== null) {
    const info = monthYearFromText(dm[1]);
    const vacancy = parseBrNumber(dm[2]);
    const point = vacancyPointFromParts({ ...(info || { label: dm[1] }), vacancy, periodKey: '12m', source: 'Investidor10 HTML taxa de vacância' });
    if (point) direct.push(point);
  }
  if (direct.length >= 2) return direct;
  const labelMatches = [...section.matchAll(/\b([A-Za-zÀ-ÿ]{3,12}\s*[\/-]\s*(?:20\d{2}|19\d{2}))\b/gi)]
    .map(match => monthYearFromText(match[1]))
    .filter(Boolean);
  const percents = [...section.matchAll(/([+-]?\d{1,3}(?:[.,]\d+)?)\s*%/g)]
    .map(match => parseBrNumber(match[1]))
    .filter(value => Number.isFinite(value) && value >= 0 && value <= 50)
    .filter(value => ![20, 40, 60, 80, 100].includes(Number(value)));
  if (labelMatches.length >= 2 && percents.length >= labelMatches.length) {
    return labelMatches.map((info, index) => vacancyPointFromParts({ ...info, vacancy: percents[index], periodKey: '12m', source: 'Investidor10 HTML taxa de vacância' })).filter(Boolean);
  }
  return [];
}

function vacancyPointsFromHistoricalIndicators(historicalIndicators = null) {
  const rows = Array.isArray(historicalIndicators?.rows) ? historicalIndicators.rows : [];
  const row = rows.find(item => /vac[âa]ncia/i.test(String(item?.label || item?.id || '')));
  const values = row?.values && typeof row.values === 'object' ? row.values : null;
  if (!values) return [];
  return Object.entries(values)
    .map(([period, display]) => {
      const vacancy = parseBrNumber(display);
      return vacancyPointFromParts({ label: period, year: Number(period), vacancy, periodKey: String(period), source: 'Investidor10 histórico de indicadores' });
    })
    .filter(Boolean)
    .sort((a, b) => String(a.period).localeCompare(String(b.period), 'pt-BR', { numeric: true }));
}

function buildFiiVacancyHistoryPayload({ html = '', ticker = '', raw = null, historicalIndicators = null, quickMetrics = {} } = {}) {
  const symbol = String(ticker || '').toUpperCase();
  let points = collectFiiVacancyApiPoints(raw, '12m');
  let parsedFrom = 'investidor10_api';
  if (points.length < 2) {
    points = extractFiiVacancyHistoryFromHtml(html, symbol);
    parsedFrom = 'investidor10_html_section';
  }
  if (points.length < 2) {
    points = vacancyPointsFromHistoricalIndicators(historicalIndicators);
    parsedFrom = 'investidor10_historical_indicators';
  }
  if (points.length < 2 && Number.isFinite(Number(quickMetrics?.vacancy ?? quickMetrics?.vacancia))) {
    const vacancy = Number(quickMetrics.vacancy ?? quickMetrics.vacancia);
    const now = new Date();
    points = [vacancyPointFromParts({ label: `${now.getFullYear()}`, year: now.getFullYear(), vacancy, periodKey: '12m', source: 'Investidor10 informação cadastral' })].filter(Boolean);
    parsedFrom = 'investidor10_current_vacancy_only';
  }
  if (!points.length) return emptyFiiVacancyHistory(symbol, { reason: 'vacancy_history_not_found' });
  const deduped = [];
  const seen = new Set();
  for (const point of points) {
    const key = `${point.periodKey || ''}|${point.date || point.label || ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(point);
  }
  const optionMap = new Map();
  optionMap.set('12m', { key: '12m', label: '12m', months: 12 });
  for (const p of deduped) {
    if (Number.isFinite(Number(p.year))) optionMap.set(String(p.year), { key: String(p.year), label: String(p.year) });
  }
  const periodOptions = [...optionMap.values()].sort((a, b) => {
    if (a.key === '12m') return -1;
    if (b.key === '12m') return 1;
    return Number(b.key) - Number(a.key);
  });
  return {
    id: 'fii_vacancy_history',
    title: symbol ? `Histórico da taxa de vacância ${symbol}` : 'Histórico da taxa de vacância',
    status: deduped.length >= 2 ? 'OK' : 'PARTIAL',
    source: 'Investidor10',
    sourceUrl: symbol ? `https://investidor10.com.br/fiis/${symbol.toLowerCase()}/` : undefined,
    ticker: symbol,
    defaultPeriod: '12m',
    periodOptions,
    points: deduped,
    diagnostics: {
      parsedFrom,
      points: deduped.length
    }
  };
}

function propertyNameFromPrefix(prefix = '') {
  let clean = normalizePeerTableText(prefix)
    .replace(/LISTA\s+DE\s+IM[ÓO]VEIS/ig, ' ')
    .replace(new RegExp(`(?:${STATE_ALTERNATION})\\s+\\d+`, 'ig'), ' ')
    .replace(/\b(?:SC|SP|PR|RJ|MG|GO|BA|PE|MT|PB|RS|AC|AL|AP|AM|CE|DF|ES|MA|MS|PA|PI|RN|RO|RR|SE|TO)\b/g, ' ')
    .replace(/[•|]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
  const chunks = clean.split(/\s{2,}|\n|;/).map(x => x.trim()).filter(Boolean);
  clean = chunks.at(-1) || clean;
  const match = clean.match(/([A-ZÀ-Ú0-9][A-ZÀ-Ú0-9\s\/.'’&-]{2,80})$/i);
  return cleanInvestidor10InfoValue(match?.[1] || clean)
    .replace(/^[-–—:]+|[-–—:]+$/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function parseBrAreaM2(value = '') {
  const n = parseBrNumber(value);
  return Number.isFinite(n) ? n : null;
}

function extractFiiPropertyStates(section = '') {
  const firstProperty = section.search(/\bEstado\s*:/i);
  const stateBlock = firstProperty >= 0 ? section.slice(0, firstProperty) : section;
  const pattern = new RegExp(`\\b(${STATE_ALTERNATION})\\s+(\\d{1,4})\\b`, 'ig');
  const rows = [];
  const seen = new Set();
  let match;
  while ((match = pattern.exec(stateBlock)) !== null) {
    const state = cleanInvestidor10InfoValue(match[1]).toUpperCase();
    const count = Number(match[2]);
    const uf = STATE_NAME_TO_UF[normalizeLooseText(state)] || '';
    const key = uf || normalizeLooseText(state);
    if (!state || !Number.isFinite(count) || count <= 0 || seen.has(key)) continue;
    seen.add(key);
    rows.push({ uf, state, count, source: 'Investidor10' });
  }
  const total = rows.reduce((acc, row) => acc + Number(row.count || 0), 0);
  return rows.map(row => ({
    ...row,
    sharePercent: total > 0 ? round((Number(row.count || 0) / total) * 100, 4) : null,
    shareDisplay: total > 0 ? formatPercent((Number(row.count || 0) / total) * 100, false) : '—'
  }));
}

function extractFiiPropertyItems(section = '', ticker = '') {
  const normalized = normalizePeerTableText(section);
  const statePattern = `(?:${STATE_ALTERNATION})`;
  const regex = new RegExp(`\\s+Estado\\s*:\\s*(${statePattern})\\s+Área\\s+bruta\\s+loc[áa]vel\\s*:\\s*([\\d.,]+)\\s*m(?:²|2)?`, 'ig');
  const matches = [...normalized.matchAll(regex)];
  const rows = [];
  const seen = new Set();
  for (let i = 0; i < matches.length; i += 1) {
    const match = matches[i];
    const prefixStart = i === 0 ? 0 : (matches[i - 1].index || 0) + matches[i - 1][0].length;
    const prefix = normalized.slice(prefixStart, match.index || 0);
    const name = propertyNameFromPrefix(prefix);
    const state = cleanInvestidor10InfoValue(match[1]).toUpperCase();
    const areaText = cleanInvestidor10InfoValue(match[2]);
    const uf = STATE_NAME_TO_UF[normalizeLooseText(state)] || '';
    const areaM2 = parseBrAreaM2(areaText);
    if (!name || name.length < 2 || /^(?:lista de imóveis|estado)$/i.test(name)) continue;
    const key = `${normalizeLooseText(name)}|${uf}|${areaText}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({
      id: `${String(ticker || 'fii').toLowerCase()}_property_${rows.length + 1}`,
      name,
      state,
      uf,
      areaM2: Number.isFinite(areaM2) ? round(areaM2, 2) : null,
      areaDisplay: areaText ? `${areaText} m²` : '—',
      source: 'Investidor10'
    });
  }
  return rows;
}

function extractInvestidor10FiiPropertyPortfolio(html = '', ticker = '') {
  const plain = htmlToPlainText(html);
  const start = plain.search(/LISTA\s+DE\s+IM[ÓO]VEIS/i);
  if (start < 0) return emptyFiiPropertyPortfolio(ticker, { reason: 'section_not_found' });
  const raw = plain.slice(start, start + 9000);
  const endRel = raw.slice(80).search(/(?:COMUNICADOS\s+DO|HIST[ÓO]RICO\s+DA\s+TAXA|D[ÚU]VIDAS\s+COMUNS|NOT[ÍI]CIAS\s+SOBRE|DISCUSS[ÃA]O|Copyright|Avalie\s+o\s+FII)/i);
  const section = normalizePeerTableText(endRel >= 0 ? raw.slice(0, 80 + endRel) : raw);
  const states = extractFiiPropertyStates(section);
  const properties = extractFiiPropertyItems(section, ticker);
  const totalProperties = states.reduce((acc, row) => acc + Number(row.count || 0), 0) || properties.length;
  if (!states.length && !properties.length) return emptyFiiPropertyPortfolio(ticker, { reason: 'empty_after_parse' });
  return {
    id: 'fii_property_portfolio',
    title: 'Lista de imóveis',
    status: 'OK',
    source: 'Investidor10',
    sourceUrl: ticker ? `https://investidor10.com.br/fiis/${String(ticker).toLowerCase()}/` : undefined,
    ticker: String(ticker || '').toUpperCase(),
    totalProperties,
    totalStates: states.length,
    states,
    properties: properties.slice(0, 80),
    diagnostics: {
      states: states.length,
      properties: properties.length,
      parsedFrom: 'lista_de_imoveis_html_section'
    }
  };
}

function findAboutMarker(text = '', pattern, from = 0) {
  if (!text) return null;
  const source = String(text || '').slice(Math.max(0, from));
  const match = source.match(pattern);
  if (!match) return null;
  return {
    index: Math.max(0, from) + (match.index || 0),
    text: match[0],
    match
  };
}

function cleanFiiAboutText(value = '') {
  return cleanInvestidor10InfoValue(value)
    .replace(/\b(?:Avalie|Deixar de seguir|Seguir|Fechar Avaliar|Média de avaliações dos usuários)\b[\s\S]*$/i, ' ')
    .replace(/\bIsso não é uma recomendação de compra\s*\/\s*venda\.?\b/gi, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function splitFiiAboutParagraphs(value = '') {
  const clean = cleanFiiAboutText(value);
  if (!clean) return [];
  return clean
    .replace(/\s+(?=(?:O|A|Os|As|Alguns|Normalmente|Através|Por meio|Além disso)\b)/g, '\n')
    .split(/\n+/)
    .map(item => cleanFiiAboutText(item))
    .filter(item => item.length >= 18)
    .slice(0, 8);
}

function extractAboutBullets(raw = '') {
  const text = cleanFiiAboutText(raw);
  const intro = text.match(/Alguns dos ativos imobiliários que compõem ou já compuseram a exposição do fundo incluem:?\s*/i);
  if (!intro) return { paragraphsText: text, bullets: [] };
  const afterIntroStart = (intro.index || 0) + intro[0].length;
  const tail = text.slice(afterIntroStart);
  const endMatch = tail.match(/\bO objetivo é gerar\b/i);
  const bulletBlock = endMatch ? tail.slice(0, endMatch.index) : tail;
  const bullets = bulletBlock
    .split(/\.\s+/)
    .map(item => item.replace(/[.;]+$/g, '').trim())
    .filter(item => /[A-Za-zÀ-ÿ0-9]+\s+[–-]\s+/.test(item) || /\([A-Z]{2}\)/.test(item))
    .map(item => item.endsWith('.') ? item : `${item}.`)
    .slice(0, 24);
  const before = text.slice(0, afterIntroStart).trim();
  const after = endMatch ? tail.slice(endMatch.index).trim() : '';
  return {
    paragraphsText: [before, after].filter(Boolean).join(' '),
    bullets
  };
}

function sectionFromAboutBlock({ id, title, raw }) {
  if (!raw) return null;
  const bulletResult = extractAboutBullets(raw);
  const paragraphs = splitFiiAboutParagraphs(bulletResult.paragraphsText);
  const bullets = bulletResult.bullets;
  if (!paragraphs.length && !bullets.length) return null;
  return {
    id,
    title,
    paragraphs,
    bullets,
    source: 'Investidor10'
  };
}

function extractInvestidor10FiiAbout(html = '', ticker = '', infoItems = [], quickMetrics = {}) {
  const symbol = String(ticker || '').toUpperCase();
  const plain = htmlToPlainText(html);
  if (!plain) return emptyFiiAboutFund(symbol, { reason: 'no_html' });
  const main = findAboutMarker(plain, new RegExp(`\\bSOBRE\\s+A\\s+${escapeRegExp(symbol)}\\b`, 'i'))
    || findAboutMarker(plain, /\bSOBRE\s+A\s+[A-Z]{4}\d{2}\b/i)
    || findAboutMarker(plain, /\bSobre\s+a\s+[A-ZÀ-Ú0-9][A-ZÀ-Ú0-9\s.\-]{4,80}/i);
  if (!main) return emptyFiiAboutFund(symbol, { reason: 'section_not_found' });
  const next = findAboutMarker(plain, /\b(?:Lista de Imóveis|histórico da taxa de vacância|COMUNICADOS DO|Informações sobre valor patrimonial|Média do Tipo e Segmento|Avalie o FII)\b/i, main.index + main.text.length);
  let block = cleanFiiAboutText(plain.slice(main.index, next ? next.index : Math.min(plain.length, main.index + 8500)));
  block = block.replace(new RegExp(`^SOBRE\\s+A\\s+${escapeRegExp(symbol)}\\s*`, 'i'), '').trim();
  const overviewHeadingPattern = /\bSobre\s+a\s+[A-ZÀ-Ú0-9][A-ZÀ-Ú0-9\s.\-]{4,100}?(?=\s+(?:O|A|Os|As)\s+[A-ZÀ-Ú]|\s+Estratégia\b|$)/i;
  const overviewMarker = findAboutMarker(block, overviewHeadingPattern);
  if (!overviewMarker) return emptyFiiAboutFund(symbol, { reason: 'about_heading_not_found' });
  const overviewTitle = cleanFiiAboutText(overviewMarker.text).replace(/\s{2,}/g, ' ');
  const fundName = overviewTitle.replace(/^Sobre\s+a\s+/i, '').replace(/\s+O\s+[A-ZÀ-Ú][\s\S]*$/i, '').trim();

  const markers = [
    { id: 'overview', title: fundName ? `Sobre a ${fundName}` : overviewTitle, pattern: overviewHeadingPattern },
    { id: 'strategy_composition', title: 'Estratégia e composição', pattern: /\bEstratégia\s+e\s+composição\b/i },
    { id: 'diversification_exposure', title: 'Diversificação e exposição', pattern: /\bDiversificação\s+e\s+exposição\b/i },
    { id: 'fund_structure_fees', title: 'Estrutura do fundo e taxas', pattern: /\bEstrutura\s+do\s+fundo\s+e\s+taxas\b/i },
    { id: 'additional_information', title: 'Informações adicionais', pattern: /\bInformações\s+Adicionais\b/i }
  ];

  const found = markers
    .map(marker => {
      const item = findAboutMarker(block, marker.pattern);
      return item ? { ...marker, index: item.index, text: item.text } : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.index - b.index);

  const sections = [];
  for (let i = 0; i < found.length; i += 1) {
    const current = found[i];
    const endIndex = found[i + 1]?.index ?? block.length;
    const raw = block.slice(current.index + current.text.length, endIndex);
    const section = sectionFromAboutBlock({ id: current.id, title: current.title, raw });
    if (section) sections.push(section);
  }

  if (!sections.length) return emptyFiiAboutFund(symbol, { reason: 'empty_after_parse' });
  const infoValue = id => (Array.isArray(infoItems) ? infoItems : []).find(item => String(item?.id || '').toLowerCase() === id)?.value || '';
  const summary = sections[0]?.paragraphs?.[0] || '';
  const highlights = [
    infoValue('segmento') ? { label: 'Segmento', value: infoValue('segmento') } : null,
    infoValue('tipo_fundo') ? { label: 'Tipo', value: infoValue('tipo_fundo') } : null,
    infoValue('taxa_administracao') ? { label: 'Taxa de administração', value: infoValue('taxa_administracao') } : null,
    finiteNumberOrNull(quickMetrics?.pvp) !== null ? { label: 'P/VP', value: String(quickMetrics.pvp).replace('.', ',') } : null
  ].filter(Boolean);
  return {
    id: 'fii_about_fund',
    title: symbol ? `Sobre a ${symbol}` : 'Sobre o FII',
    status: 'OK',
    source: 'Investidor10',
    sourceUrl: symbol ? `https://investidor10.com.br/fiis/${symbol.toLowerCase()}/` : undefined,
    ticker: symbol,
    fundName,
    summary,
    highlights,
    sections,
    diagnostics: {
      sectionCount: sections.length,
      hasStrategy: sections.some(section => section.id === 'strategy_composition'),
      hasAdditionalInformation: sections.some(section => section.id === 'additional_information')
    }
  };
}


function fiiTickerIdentityOk(html = '', finalUrl = '', ticker = '') {
  const symbol = String(ticker || '').toUpperCase();
  if (!symbol) return false;
  const url = String(finalUrl || '');
  if (url && new RegExp(`/fiis/${escapeRegExp(symbol.toLowerCase())}(?:/|$|[?#])`, 'i').test(url)) return true;
  const plain = htmlToPlainText(html).slice(0, 9000);
  return new RegExp(`\\b${escapeRegExp(symbol)}\\b`, 'i').test(plain);
}

function fiiPageIdentityDiagnostics(html = '', finalUrl = '', ticker = '') {
  const symbol = String(ticker || '').toUpperCase();
  const plain = htmlToPlainText(html).slice(0, 3000);
  return {
    requestedTicker: symbol,
    finalUrl: finalUrl || '',
    symbolFoundInPageHead: symbol ? new RegExp(`\\b${escapeRegExp(symbol)}\\b`, 'i').test(plain) : false,
    urlMatchesTicker: Boolean(finalUrl && symbol && new RegExp(`/fiis/${escapeRegExp(symbol.toLowerCase())}(?:/|$|[?#])`, 'i').test(finalUrl))
  };
}


function detectChecklistPassed(section = '', labelStart = 0, labelLength = 0) {
  const rawWindow = String(section || '').slice(Math.max(0, labelStart - 220), Math.min(String(section || '').length, labelStart + labelLength + 260));
  const window = normalizeLooseText(rawWindow);
  const hasExplicitNegative = /\b(?:nao atende|não atende|reprovado|reprovada|falhou|negativo|cancel|close|unchecked|uncheck|xmark|times|false|disabled)\b/.test(window)
    || /(?:class|data-[a-z-]+|aria-label|title)\s*=\s*["'][^"']*(?:unchecked|uncheck|fail|failed|false|negative|danger|muted|gray|grey|times|xmark|close|cancel)[^"']*["']/i.test(rawWindow);
  if (hasExplicitNegative) return false;
  const hasExplicitPositive = /\b(?:check|check circle|check_circle|checked|check box|fa check|icon check|material icons check|is checked|status true|aprovado|aprovada|atende|positivo|success|done|true|sim)\b/.test(window)
    || /(?:class|data-[a-z-]+|aria-label|title)\s*=\s*["'][^"']*(?:checked|check-circle|check_circle|checkmark|check-mark|fa-check|icon-check|success|positive|passed|approved|true)[^"']*["']/i.test(rawWindow)
    || /✓|✔|☑/.test(rawWindow);
  if (hasExplicitPositive) return true;
  // Texto do critério sem marcador inequívoco não prova aprovação nem reprovação.
  return undefined;
}

function extractChecklistDisclaimer(section = '') {
  const normalized = normalizePeerTableText(section);
  const match = normalized.match(/Esta ferramenta de checklist[\s\S]{0,520}?(?:futuros\.|futuro\.|$)/i);
  return cleanInvestidor10InfoValue(match?.[0] || '')
    .replace(/\s{2,}/g, ' ')
    .slice(0, 520);
}

function extractInvestidor10FiiBuyHoldChecklist(html = '', ticker = '') {
  const plain = htmlToPlainText(html);
  const start = plain.search(/CHECKLIST\s+DO\s+INVESTIDOR\s+BUY\s+AND\s+HOLD/i);
  if (start < 0) return emptyFiiBuyHoldChecklist(ticker, { reason: 'section_not_found' });
  const raw = plain.slice(start, start + 6200);
  const endRel = raw.slice(120).search(/(?:COMPARANDO\s+COM\s+OUTROS\s+FIIS|FIIS\s+RELACIONAD[AO]S?|HIST[ÓO]RICO\s+DE|D[ÚU]VIDAS\s+COMUNS|NOT[ÍI]CIAS\s+SOBRE|DISCUSS[ÃA]O|Copyright)/i);
  const section = normalizePeerTableText(endRel >= 0 ? raw.slice(0, 120 + endRel) : raw);
  const normalizedSection = normalizeLooseText(section);
  const matches = [];
  const seen = new Set();
  for (const criterion of FII_BUY_HOLD_CHECKLIST_CRITERIA) {
    const variants = [criterion.label, ...(criterion.variants || [])];
    let bestIndex = -1;
    let bestText = criterion.label;
    for (const variant of variants) {
      const normalizedVariant = normalizeLooseText(variant);
      const idx = normalizedSection.indexOf(normalizedVariant);
      if (idx >= 0 && (bestIndex < 0 || idx < bestIndex)) {
        bestIndex = idx;
        bestText = variant;
      }
    }
    if (bestIndex < 0 || seen.has(criterion.id)) continue;
    seen.add(criterion.id);
    const passed = detectChecklistPassed(section, bestIndex, bestText.length);
    matches.push({ criterion, index: bestIndex, passed });
  }
  matches.sort((a, b) => a.index - b.index);
  const items = matches.map(({ criterion, passed }) => ({
    id: criterion.id,
    label: criterion.label,
    passed,
    status: passed === true ? 'PASSED' : (passed === false ? 'FAILED' : 'UNKNOWN'),
    statusLabel: passed === true ? 'Atende' : (passed === false ? 'Não atende' : 'Não informado'),
    help: criterion.help,
    source: 'Investidor10 checklist buy and hold',
    evidence: passed === true || passed === false ? 'marcação explícita no HTML' : 'marcação explícita ausente',
    dataNature: passed === true || passed === false ? 'DIRECT' : 'UNKNOWN',
    calculated: false,
    sourceUrl: ticker ? `https://investidor10.com.br/fiis/${ticker.toLowerCase()}/` : undefined
  }));
  const passedCount = items.filter(item => item.passed === true).length;
  const failedCount = items.filter(item => item.passed === false).length;
  const unknownCount = items.filter(item => item.passed !== true && item.passed !== false).length;
  return {
    id: 'fii_buy_hold_checklist',
    title: ticker ? `Checklist do Investidor Buy and Hold sobre ${ticker}` : 'Checklist do Investidor Buy and Hold',
    subtitle: 'Critérios de qualidade do Investidor10 para leitura buy and hold do fundo.',
    status: items.length ? 'OK' : 'EMPTY',
    source: 'Investidor10',
    sourceUrl: ticker ? `https://investidor10.com.br/fiis/${ticker.toLowerCase()}/` : undefined,
    total: items.length,
    passed: passedCount,
    failed: failedCount,
    unknown: unknownCount,
    items,
    disclaimer: extractChecklistDisclaimer(section) || 'Esta ferramenta de checklist é fornecida apenas para fins informativos e não constitui recomendação de investimento. A pontuação baseia-se em parâmetros de mercado, mas não garante resultados futuros.',
    diagnostics: { found: true, criteriaFound: items.length }
  };
}

function checklistItemFromMetric({ criterion, value = null, passed = null, valueDisplay = '', source = 'Investidor10 + métricas do modal' } = {}) {
  const known = passed === true || passed === false;
  return {
    id: criterion.id,
    label: criterion.label,
    passed: known ? passed : null,
    status: passed === true ? 'PASSED' : (passed === false ? 'FAILED' : 'UNKNOWN'),
    statusLabel: passed === true ? 'Atende' : (passed === false ? 'Não atende' : 'Não informado'),
    value,
    valueDisplay: valueDisplay || (finiteNumberOrNull(value) !== null ? String(value) : '—'),
    help: criterion.help,
    source,
    evidence: known ? `critério calculado a partir da métrica ${valueDisplay || value}` : 'métrica real insuficiente para calcular o critério',
    dataNature: known ? 'CALCULATED' : 'UNKNOWN',
    calculated: known,
    sourceUrl: undefined
  };
}

function fiiChecklistCriterion(id = '') {
  return FII_BUY_HOLD_CHECKLIST_CRITERIA.find(item => item.id === id) || { id, label: id, help: '' };
}

function firstListedYearFromHtml(html = '', dividendCharts = null) {
  const plain = htmlToPlainText(html);
  const yearCandidates = [];
  for (const match of plain.matchAll(/(?:constitu[ií]do|in[ií]cio|listad[oa]|criad[oa]|fundad[oa])\D{0,60}\b(19\d{2}|20\d{2})\b/gi)) {
    const year = Number(match[1]);
    if (Number.isFinite(year) && year >= 1990 && year <= new Date().getFullYear()) yearCandidates.push(year);
  }
  const eventYears = (Array.isArray(dividendCharts?.events) ? dividendCharts.events : [])
    .map(event => Number(String(event?.dataCom || event?.paymentDate || '').match(/^(\d{4})/)?.[1]))
    .filter(year => Number.isFinite(year) && year >= 1990);
  yearCandidates.push(...eventYears);
  return yearCandidates.length ? Math.min(...yearCandidates) : null;
}

function averageVacancyPercent(vacancyHistory = null) {
  const values = (Array.isArray(vacancyHistory?.points) ? vacancyHistory.points : [])
    .map(point => Number(point?.vacancyPercent ?? point?.value ?? point?.vacancy))
    .filter(value => Number.isFinite(value) && value >= 0 && value <= 100);
  if (!values.length) return null;
  const recent = values.slice(-12);
  return recent.reduce((sum, value) => sum + value, 0) / recent.length;
}

function countFiiProperties(propertyPortfolio = null) {
  const explicit = Number(propertyPortfolio?.totalProperties);
  if (Number.isFinite(explicit) && explicit > 0) return explicit;
  const list = Array.isArray(propertyPortfolio?.properties) ? propertyPortfolio.properties : [];
  return list.length || null;
}

function parseCountScale(value = '') {
  const text = cleanInvestidor10InfoValue(value);
  if (!text) return null;
  if (/milh|bilh|\bmi\b|\bbi\b|\bmil\b|\bk\b/i.test(text)) return parseMoneyScale(text);
  const normalized = text.includes(',')
    ? text.replace(/\./g, '').replace(',', '.')
    : text.replace(/\.(?=\d{3}(?:\D|$))/g, '');
  const n = Number(normalized.replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : null;
}

function ensureFiiBuyHoldChecklist({ checklist = null, ticker = '', html = '', quickMetrics = {}, infoItems = [], propertyPortfolio = null, vacancyHistory = null, patrimonialInfo = null, dividendCharts = null } = {}) {
  const symbol = String(ticker || '').toUpperCase();
  if (checklist?.items?.length) {
    return {
      ...checklist,
      subtitle: checklist.subtitle || 'Critérios públicos de qualidade do Investidor10 para leitura buy and hold do fundo.',
      source: checklist.source || 'Investidor10',
      diagnostics: { ...(checklist.diagnostics || {}), portfolioIndependent: true, derivation: 'html_public_checklist' }
    };
  }
  const currentYear = new Date().getFullYear();
  const listedYear = firstListedYearFromHtml(html, dividendCharts);
  const yearsListed = Number.isFinite(listedYear) ? currentYear - listedYear : null;
  const rawAverageDy5y = dividendCharts?.averageDy5y;
  const avgDy5y = rawAverageDy5y !== null && rawAverageDy5y !== undefined && rawAverageDy5y !== '' && Number.isFinite(Number(rawAverageDy5y))
    ? Number(rawAverageDy5y)
    : null;
  const rawDailyLiquidity = quickMetrics?.dailyLiquidity;
  const dailyLiquidity = rawDailyLiquidity !== null && rawDailyLiquidity !== undefined && rawDailyLiquidity !== '' && Number.isFinite(Number(rawDailyLiquidity))
    ? Number(rawDailyLiquidity)
    : parseMoneyScale(firstInfoValue(infoItems, ['liquidez_diaria', 'liquidez_media_diaria']));
  const shareholders = parseCountScale(firstInfoValue(infoItems, ['numero_cotistas']));
  const equityFromInfo = parseMoneyScale(firstInfoValue(infoItems, ['valor_patrimonial']));
  const equityFromMetric = (Array.isArray(patrimonialInfo?.metrics) ? patrimonialInfo.metrics : [])
    .map(metric => ({ label: normalizeLooseText(metric?.label || metric?.id || ''), value: parseMoneyScale(metric?.valueDisplay || metric?.value || '') }))
    .find(metric => /patrimonial|patrimonio|valor/.test(metric.label) && Number.isFinite(metric.value))?.value;
  const equity = Number.isFinite(equityFromInfo) ? equityFromInfo : equityFromMetric;
  const properties = countFiiProperties(propertyPortfolio);
  const vacancyAvg = averageVacancyPercent(vacancyHistory);
  const source = 'VALORAE — cálculo sobre dados reais do Investidor10';
  const items = [
    checklistItemFromMetric({ criterion: fiiChecklistCriterion('listed_5y'), value: yearsListed, valueDisplay: Number.isFinite(yearsListed) ? `${yearsListed} anos` : '—', passed: Number.isFinite(yearsListed) ? yearsListed >= 5 : null, source }),
    checklistItemFromMetric({ criterion: fiiChecklistCriterion('dy_5y_above_8'), value: Number.isFinite(avgDy5y) ? round(avgDy5y, 4) : null, valueDisplay: Number.isFinite(avgDy5y) ? formatPercent(avgDy5y, false) : '—', passed: Number.isFinite(avgDy5y) ? avgDy5y >= 8 : null, source }),
    checklistItemFromMetric({ criterion: fiiChecklistCriterion('daily_liquidity_700k'), value: Number.isFinite(dailyLiquidity) ? round(dailyLiquidity, 2) : null, valueDisplay: Number.isFinite(dailyLiquidity) ? formatCompactMoney(dailyLiquidity) : '—', passed: Number.isFinite(dailyLiquidity) ? dailyLiquidity >= 700_000 : null, source }),
    checklistItemFromMetric({ criterion: fiiChecklistCriterion('shareholders_20k'), value: Number.isFinite(shareholders) ? Math.round(shareholders) : null, valueDisplay: Number.isFinite(shareholders) ? Math.round(shareholders).toLocaleString('pt-BR') : '—', passed: Number.isFinite(shareholders) ? shareholders >= 20_000 : null, source }),
    checklistItemFromMetric({ criterion: fiiChecklistCriterion('equity_1b'), value: Number.isFinite(equity) ? round(equity, 2) : null, valueDisplay: Number.isFinite(equity) ? formatCompactMoney(equity) : '—', passed: Number.isFinite(equity) ? equity >= 1_000_000_000 : null, source }),
    checklistItemFromMetric({ criterion: fiiChecklistCriterion('properties_5_plus'), value: Number.isFinite(properties) ? properties : null, valueDisplay: Number.isFinite(properties) ? `${properties} imóveis` : '—', passed: Number.isFinite(properties) ? properties >= 5 : null, source }),
    checklistItemFromMetric({ criterion: fiiChecklistCriterion('physical_vacancy_below_10'), value: Number.isFinite(vacancyAvg) ? round(vacancyAvg, 4) : null, valueDisplay: Number.isFinite(vacancyAvg) ? formatPercent(vacancyAvg, false) : '—', passed: Number.isFinite(vacancyAvg) ? vacancyAvg < 10 : null, source }),
    checklistItemFromMetric({ criterion: fiiChecklistCriterion('financial_vacancy_below_10'), value: null, valueDisplay: '—', passed: null, source })
  ].map(item => ({ ...item, sourceUrl: symbol ? `https://investidor10.com.br/fiis/${symbol.toLowerCase()}/` : undefined }));
  const passedCount = items.filter(item => item.passed === true).length;
  const failedCount = items.filter(item => item.passed === false).length;
  const unknownCount = items.filter(item => item.passed !== true && item.passed !== false).length;
  return {
    id: 'fii_buy_hold_checklist',
    title: symbol ? `Checklist do Investidor Buy and Hold sobre ${symbol}` : 'Checklist do Investidor Buy and Hold',
    subtitle: 'Critérios calculados pelo VALORAE exclusivamente sobre métricas reais capturadas do Investidor10, sem depender da carteira do usuário; itens sem evidência permanecem como não informados.',
    status: passedCount + failedCount > 0 ? 'OK' : 'EMPTY',
    source,
    sourceUrl: symbol ? `https://investidor10.com.br/fiis/${symbol.toLowerCase()}/` : undefined,
    total: items.length,
    passed: passedCount,
    failed: failedCount,
    unknown: unknownCount,
    items,
    disclaimer: 'Esta leitura é informativa, independente da carteira do usuário, e não constitui recomendação de investimento.',
    diagnostics: {
      reason: checklist?.diagnostics?.reason || 'derived_from_modal_metrics',
      portfolioIndependent: true,
      derivation: 'calculated_by_valorae_from_investidor10_metrics',
      dataNature: 'CALCULATED',
      listedYear,
      yearsListed,
      hasAverageDy5y: Number.isFinite(avgDy5y),
      hasDailyLiquidity: Number.isFinite(dailyLiquidity),
      hasShareholders: Number.isFinite(shareholders),
      hasEquity: Number.isFinite(equity),
      hasProperties: Number.isFinite(properties),
      hasVacancy: Number.isFinite(vacancyAvg)
    }
  };
}

function extractInvestidor10FiiInformation(html = '', ticker = '') {
  const plain = htmlToPlainText(html);
  const sectionStart = plain.search(new RegExp(`INFORMA[ÇC][ÕO]ES\\s+SOBRE\\s+${escapeRegExp(ticker)}`, 'i'));
  if (sectionStart < 0) return { items: [], sections: [], diagnostics: { found: false } };
  const section = plain.slice(sectionStart, sectionStart + 2800);
  const items = [];
  const seen = new Set();
  for (let i = 0; i < INVESTIDOR10_FII_INFO_FIELDS.length; i++) {
    const field = INVESTIDOR10_FII_INFO_FIELDS[i];
    const nextPattern = INVESTIDOR10_FII_INFO_FIELDS.slice(i + 1).map(labelPattern).join('|') || 'HIST[ÓO]RICO';
    const re = new RegExp(`${labelPattern(field)}\\s+([\\s\\S]*?)(?=${nextPattern}|HIST[ÓO]RICO|COMPARA[ÇC][ÃA]O|D[ÚU]VIDAS\\s+COMUNS|FIIS\\s+RELACIONAD|$)`, 'i');
    const match = section.match(re);
    const value = cleanInvestidor10InfoValue(match?.[1] || '');
    if (!value || value === '—' || value === '-' || value.length > 180) continue;
    const key = `${field.id}|${value}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({
      id: field.id,
      label: field.label,
      value,
      group: field.group,
      source: 'Investidor10',
      sourceUrl: `https://investidor10.com.br/fiis/${ticker.toLowerCase()}/`
    });
  }
  const byGroup = new Map();
  for (const item of items) {
    const group = item.group || 'Informações';
    if (!byGroup.has(group)) byGroup.set(group, []);
    byGroup.get(group).push(item);
  }
  const sections = [...byGroup.entries()]
    .sort((a, b) => {
      const ia = FII_INFO_GROUP_ORDER.indexOf(a[0]);
      const ib = FII_INFO_GROUP_ORDER.indexOf(b[0]);
      return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib);
    })
    .map(([group, groupItems]) => ({
      id: group.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'informacoes',
      title: group,
      items: groupItems
    }));
  return { items, sections, diagnostics: { found: true, itemCount: items.length, sectionCount: sections.length } };
}


function parseBrNumber(value = '') {
  const raw = String(value || '')
    .replace(/R\$/gi, '')
    .replace(/%/g, '')
    .replace(/\b(?:Bilhões|Bilhoes|Bilhão|Bilhao|Milhões|Milhoes|Milhão|Milhao|mi|M|bi|B|mil|K)\b/gi, '')
    .replace(/\s+/g, '')
    .trim();
  if (!raw) return null;
  const normalized = raw.includes(',') ? raw.replace(/\./g, '').replace(',', '.') : raw;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

function finiteNumberOrNull(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' && !value.trim()) return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function parseMoneyScale(value = '') {
  const lower = String(value || '').toLowerCase();
  const base = parseBrNumber(value);
  if (!Number.isFinite(base)) return null;
  if (/bilh|\bbi\b|\bb\b/i.test(lower)) return base * 1_000_000_000;
  if (/milh|\bmi\b|\bm\b/i.test(lower)) return base * 1_000_000;
  if (/\bmil\b|\bk\b/i.test(lower)) return base * 1_000;
  return base;
}

function extractInvestidor10FiiQuickMetrics(html = '', ticker = '') {
  const plain = htmlToPlainText(html);
  const tk = escapeRegExp(String(ticker || '').toUpperCase());
  const tickerLabel = tk ? `${tk}\\s+` : '';
  const startPatterns = [
    tk ? `${tk}\\s+Cotação` : '',
    'Cotação\\s+R\\$',
    'DY\\s*\\(12M\\)',
    'P\\s*\\/\\s*VP'
  ].filter(Boolean);
  const start = startPatterns.reduce((best, pattern) => {
    const idx = plain.search(new RegExp(pattern, 'i'));
    if (idx < 0) return best;
    return best < 0 ? idx : Math.min(best, idx);
  }, -1);
  const section = plain.slice(Math.max(0, start), start >= 0 ? start + 2600 : Math.min(plain.length, 4200));
  const anyQuickMetric = [
    tickerLabel ? `${tickerLabel}Cotação` : 'Cotação',
    tickerLabel ? `${tickerLabel}DY\\s*\\(12M\\)` : 'DY\\s*\\(12M\\)',
    'P\\s*\\/\\s*VP',
    'Liquidez\\s+(?:M[ée]dia\\s+)?Di[áa]ria',
    'VARIA[ÇC][ÃA]O\\s*\\(12M?\\)',
    'Rentabilidade',
    'Indicadores',
    'Resumo'
  ].filter(Boolean).join('|');
  const pick = (labelPatterns, untilPattern = anyQuickMetric) => {
    const labels = Array.isArray(labelPatterns) ? labelPatterns : [labelPatterns];
    for (const labelPattern of labels.filter(Boolean)) {
      const re = new RegExp(`(?:${labelPattern})\\s*:?\\s*([\\s\\S]*?)(?=${untilPattern}|$)`, 'i');
      const value = cleanInvestidor10InfoValue(section.match(re)?.[1] || '');
      if (value) return value;
    }
    return '';
  };
  const priceChunk = pick([
    tickerLabel ? `${tickerLabel}Cotação` : '',
    'Cotação'
  ], `${tickerLabel ? `${tickerLabel}DY\\s*\\(12M\\)|` : ''}DY\\s*\\(12M\\)|P\\s*\\/\\s*VP|Liquidez\\s+(?:M[ée]dia\\s+)?Di[áa]ria|VARIA[ÇC][ÃA]O\\s*\\(12M?\\)|Resumo|Rentabilidade|Indicadores`);
  const priceMatch = priceChunk.match(/R\$\s*[\d.,]+/i)?.[0] || '';
  const changeMatch = priceChunk.replace(priceMatch, '').match(/[+-]?\s*\d{1,3}(?:[,.]\d+)?\s*%/)?.[0] || '';
  const dy = pick([
    tickerLabel ? `${tickerLabel}DY\\s*\\(12M\\)` : '',
    'DY\\s*\\(12M\\)',
    'Dividend\\s+Yield\\s*\\(12M\\)'
  ], 'P\\s*\\/\\s*VP|Liquidez\\s+(?:M[ée]dia\\s+)?Di[áa]ria|VARIA[ÇC][ÃA]O\\s*\\(12M?\\)|Resumo|Rentabilidade|Indicadores');
  const pvp = pick(['P\\s*\\/\\s*VP', 'PVP'], 'Liquidez\\s+(?:M[ée]dia\\s+)?Di[áa]ria|VARIA[ÇC][ÃA]O\\s*\\(12M?\\)|Resumo|Rentabilidade|Indicadores|COTAÇÃO');
  const liquidity = pick(['Liquidez\\s+Di[áa]ria', 'Liquidez\\s+M[ée]dia\\s+Di[áa]ria'], 'VARIA[ÇC][ÃA]O\\s*\\(12M?\\)|Resumo|Rentabilidade|Indicadores|COTAÇÃO');
  const variation = pick(['VARIA[ÇC][ÃA]O\\s*\\(12M?\\)', 'Varia[çc][ãa]o\\s+12M'], 'Resumo|Rentabilidade|Indicadores|COTAÇÃO|Dividendos|Proventos');
  const out = {
    priceDisplay: priceMatch,
    price: parseMoneyScale(priceMatch),
    changeDisplay: changeMatch.replace(/\s+/g, ''),
    changePercent: parseBrNumber(changeMatch),
    dy12mDisplay: dy,
    dy12m: parseBrNumber(dy),
    pvpDisplay: pvp,
    pvp: parseBrNumber(pvp),
    dailyLiquidityDisplay: liquidity,
    dailyLiquidity: parseMoneyScale(liquidity),
    variation12mDisplay: variation,
    variation12mPercent: parseBrNumber(variation)
  };
  return Object.fromEntries(Object.entries(out).filter(([, value]) => value !== null && value !== undefined && value !== ''));
}

function formatIndicatorHistoryValue(rawValue, rawType) {
  const n = Number(rawValue);
  if (!Number.isFinite(n)) return cleanInvestidor10InfoValue(String(rawValue || '-')) || '-';
  const type = String(rawType || '').toLowerCase();
  const dec = (v, d = 2) => v.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
  const abbr = (v, d = 2, space = true) => {
    const abs = Math.abs(v);
    if (abs >= 1_000_000_000) return `${dec(v / 1_000_000_000, d)}${space ? ' ' : ''}B`;
    if (abs >= 1_000_000) return `${dec(v / 1_000_000, d)}${space ? ' ' : ''}M`;
    if (abs >= 1_000) return `${dec(v / 1_000, d)}${space ? ' ' : ''}K`;
    return dec(v, 0);
  };
  if (type === 'money_abbr') return `R$ ${abbr(n, 2, true)}`;
  if (type === 'number_abbr') return abbr(n, 0, false);
  if (type === 'money') return `R$ ${dec(n, 2)}`;
  if (type === 'percent') return `${dec(n, 2)}%`;
  if (type === 'number') return dec(n, 0);
  return dec(n, 2);
}

const HISTORICAL_INDICATOR_LABELS = Object.freeze({
  market_value: 'Valor de Mercado',
  valor_mercado: 'Valor de Mercado',
  valor_de_mercado: 'Valor de Mercado',
  p_vp: 'P/VP',
  pvp: 'P/VP',
  dividend_yield: 'Dividend Yield',
  dy: 'Dividend Yield',
  liquidez_diaria: 'Liquidez Diária',
  daily_liquidity: 'Liquidez Diária',
  valor_patrimonial: 'Valor Patrimonial',
  patrimonio: 'Valor Patrimonial',
  valor_patrimonial_cota: 'Val. Patrimonial p/ Cota',
  vp_cota: 'Val. Patrimonial p/ Cota',
  vacancia: 'Vacância',
  numero_cotistas: 'Número de Cotistas',
  cotistas: 'Número de Cotistas',
  cotas_emitidas: 'Cotas Emitidas'
});

function canonicalIndicatorLabel(label = '') {
  const raw = String(label || '').trim();
  const key = raw.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  return HISTORICAL_INDICATOR_LABELS[key] || raw.replace(/_/g, ' ').replace(/\b\w/g, m => m.toUpperCase());
}

function normalizeFiiHistoricalIndicatorsApi(data) {
  if (!data || typeof data !== 'object') return { columns: [], rows: [], status: 'EMPTY' };
  let sourceEntries = [];
  if (Array.isArray(data)) {
    sourceEntries = data.map((item, index) => [item?.indicator || item?.indicador || item?.name || item?.label || item?.key || `Indicador ${index + 1}`, item?.values || item?.data || item?.series || item?.items || item]);
  } else {
    const root = data.data && typeof data.data === 'object' ? data.data : data;
    sourceEntries = Object.entries(root).filter(([, values]) => Array.isArray(values) && values.length > 0);
    if (!sourceEntries.length && Array.isArray(root.items)) sourceEntries = root.items.map((item, index) => [item?.indicator || item?.indicador || item?.name || item?.label || item?.key || `Indicador ${index + 1}`, item?.values || item?.data || item?.series || item?.items || []]);
  }
  const columns = [];
  const rows = [];
  for (const [indicator, values] of sourceEntries) {
    const arr = Array.isArray(values) ? values : [];
    if (!arr.length) continue;
    const rowValues = {};
    let valueType = '';
    for (const item of arr) {
      const col = String(item?.year ?? item?.ano ?? item?.period ?? item?.periodo ?? item?.label ?? item?.date ?? item?.data ?? '').trim();
      const finalCol = col || (item?.current || item?.atual ? 'Atual' : 'Atual');
      if (!columns.includes(finalCol)) columns.push(finalCol);
      const rawValue = item?.value ?? item?.valor ?? item?.amount ?? item?.total ?? item?.y ?? item?.current ?? item?.atual;
      const rawType = item?.type ?? item?.tipo ?? item?.format ?? item?.formatter ?? item?.unit;
      valueType = valueType || rawType || '';
      rowValues[finalCol] = formatIndicatorHistoryValue(rawValue, rawType);
    }
    const label = canonicalIndicatorLabel(indicator);
    if (Object.keys(rowValues).length) rows.push({ id: label.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_'), label, values: rowValues, valueType, source: 'Investidor10' });
  }
  const preferredOrder = ['Atual', '2026', '2025', '2024', '2023', '2022', '2021', '2020'];
  columns.sort((a, b) => {
    const ia = preferredOrder.indexOf(String(a));
    const ib = preferredOrder.indexOf(String(b));
    if (ia >= 0 || ib >= 0) return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib);
    const na = Number(a); const nb = Number(b);
    if (Number.isFinite(na) && Number.isFinite(nb)) return nb - na;
    return String(a).localeCompare(String(b), 'pt-BR', { numeric: true });
  });
  const rowOrder = ['Valor de Mercado', 'P/VP', 'Dividend Yield', 'Liquidez Diária', 'Valor Patrimonial', 'Val. Patrimonial p/ Cota', 'Vacância', 'Número de Cotistas', 'Cotas Emitidas'];
  rows.sort((a, b) => {
    const ia = rowOrder.indexOf(a.label);
    const ib = rowOrder.indexOf(b.label);
    return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib) || a.label.localeCompare(b.label, 'pt-BR');
  });
  return { title: 'Histórico de indicadores fundamentalistas', columns, rows, source: 'Investidor10', status: rows.length ? 'OK' : 'EMPTY' };
}


const FII_PEER_TYPE_PATTERN = /(FUNDO\s+DE\s+TIJOLO|FUNDO\s+DE\s+PAPEL|FUNDO\s+DE\s+FUNDOS|FUNDO\s+DE\s+DESENVOLVIMENTO|FUNDO\s+H[ÍI]BRIDO|FUNDO\s+MISTO|FUNDO\s+IMOBILI[ÁA]RIO|FIAGRO|FIP)/i;

function normalizePeerTableText(value = '') {
  return cleanInvestidor10InfoValue(value)
    .replace(/[★☆]/g, '')
    .replace(/\b(?:star|grade|arrow_upward|arrow_downward|unfold_more|keyboard_arrow_down)\b/gi, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function normalizeFiiPeerType(value = '') {
  const clean = normalizePeerTableText(value).toUpperCase();
  return clean
    .replace(/HIBRIDO/g, 'HÍBRIDO')
    .replace(/IMOBILIARIO/g, 'IMOBILIÁRIO')
    .trim();
}

function parseFiiPeerRowChunk(chunk = '', referenceTicker = '') {
  const ticker = String(chunk.match(/\b[A-Z]{4}\d{2}\b/i)?.[0] || '').toUpperCase();
  if (!ticker) return null;
  let rest = normalizePeerTableText(chunk.slice(chunk.toUpperCase().indexOf(ticker) + ticker.length));
  const dyMatch = rest.match(/[+-]?\d{1,3}(?:[.,]\d+)?\s*%|0\s*%/i);
  if (!dyMatch) return null;
  const dividendYieldDisplay = normalizePeerTableText(dyMatch[0]).replace(/\s+%/g, '%');
  const dividendYield = parseBrNumber(dividendYieldDisplay);
  rest = normalizePeerTableText(rest.slice(dyMatch.index + dyMatch[0].length));

  const pvpBeforePatrimony = rest.match(/^\s*([+-]?\d{1,3}(?:[.,]\d+)?)(?=\s+(?:R\$\s*)?[\d.,]+\s*(?:TRILH|BILH|MILH|MIL\b|K\b|M\b|B\b))/i)
    || rest.match(/^\s*([+-]?\d{1,3}(?:[.,]\d+)?)/i);
  if (!pvpBeforePatrimony) return null;
  const pvpDisplay = normalizePeerTableText(pvpBeforePatrimony[1]).replace('.', ',');
  const pvp = parseBrNumber(pvpDisplay);
  rest = normalizePeerTableText(rest.slice(pvpBeforePatrimony.index + pvpBeforePatrimony[0].length));

  const patrimonyMatch = rest.match(/(?:R\$\s*)?[\d.,]+\s*(?:TRILH[ÕO]ES|TRILH[ÃA]O|BILH[ÕO]ES|BILH[ÃA]O|MILH[ÕO]ES|MILH[ÃA]O|MIL|K|M|B)\b/i)
    || rest.match(/R\$\s*[\d.,]+/i);
  if (!patrimonyMatch) return null;
  const patrimonialValueDisplay = normalizePeerTableText(patrimonyMatch[0]).replace(/\bBILHOES\b/i, 'BILHÕES').replace(/\bMILHOES\b/i, 'MILHÕES');
  const patrimonialValue = parseMoneyScale(patrimonialValueDisplay);
  rest = normalizePeerTableText(rest.slice(patrimonyMatch.index + patrimonyMatch[0].length));

  const typeMatch = rest.match(FII_PEER_TYPE_PATTERN);
  const fundType = typeMatch ? normalizeFiiPeerType(typeMatch[0]) : '';
  const segment = typeMatch
    ? normalizePeerTableText(rest.slice(typeMatch.index + typeMatch[0].length)).replace(/^(?:\/|-)\s*/, '')
    : normalizePeerTableText(rest);
  if (!dividendYieldDisplay && !pvpDisplay && !patrimonialValueDisplay) return null;
  return {
    ticker,
    isReference: ticker === String(referenceTicker || '').toUpperCase(),
    dividendYield,
    dividendYieldDisplay: dividendYieldDisplay || '—',
    pvp,
    pvpDisplay: pvpDisplay || '—',
    patrimonialValue,
    patrimonialValueDisplay: patrimonialValueDisplay || '—',
    fundType: fundType || '—',
    segment: segment || '—',
    source: 'Investidor10'
  };
}

function markFiiPeerBestRows(rows = []) {
  const bestDividendYield = Math.max(...rows.map(row => Number(row.dividendYield)).filter(Number.isFinite));
  const pvpValues = rows.map(row => Number(row.pvp)).filter(value => Number.isFinite(value) && value > 0);
  const bestPvp = pvpValues.length ? Math.min(...pvpValues) : null;
  const bestPatrimonial = Math.max(...rows.map(row => Number(row.patrimonialValue)).filter(Number.isFinite));
  return rows.map(row => {
    const highlights = [];
    if (Number.isFinite(bestDividendYield) && Number(row.dividendYield) === bestDividendYield) highlights.push('dividendYield');
    if (Number.isFinite(bestPvp) && Number(row.pvp) === bestPvp) highlights.push('pvp');
    if (Number.isFinite(bestPatrimonial) && Number(row.patrimonialValue) === bestPatrimonial) highlights.push('patrimonialValue');
    return { ...row, highlights };
  });
}

function emptyFiiPeerComparison(ticker = '', diagnostics = {}) {
  return {
    id: 'fii_peer_comparison',
    title: 'Comparando com outros FIIs',
    subtitle: 'Mesmo tipo e segmento',
    filterLabel: 'Mesmo tipo e segmento',
    source: 'Investidor10',
    sourceUrl: ticker ? `https://investidor10.com.br/fiis/${ticker.toLowerCase()}/` : undefined,
    status: 'EMPTY',
    columns: [],
    rows: [],
    diagnostics
  };
}

function fiiPeerComparisonColumns() {
  return [
    { key: 'ticker', label: 'FII' },
    { key: 'dividendYield', label: 'Dividend Yield' },
    { key: 'pvp', label: 'P/VP' },
    { key: 'patrimonialValue', label: 'Valor patrimonial' },
    { key: 'fundType', label: 'Tipo' },
    { key: 'segment', label: 'Segmento' }
  ];
}

function buildFiiPeerComparisonPayload(rows = [], ticker = '', diagnostics = {}, source = 'Investidor10') {
  const finalRows = markFiiPeerBestRows(rows);
  const sourceMode = String(diagnostics?.mode || '').toLowerCase();
  const subtitle = sourceMode === 'related_fiis_real_source'
    ? 'FIIs relacionados publicados pelo Investidor10; tipo e segmento só aparecem quando informados para a própria linha.'
    : 'Tabela do Investidor10 filtrada por mesmo tipo e segmento do fundo.';
  return {
    id: 'fii_peer_comparison',
    title: 'Comparando com outros FIIs',
    subtitle,
    filterLabel: sourceMode === 'related_fiis_real_source' ? 'FIIs relacionados' : 'Mesmo tipo e segmento',
    source,
    sourceUrl: ticker ? `https://investidor10.com.br/fiis/${ticker.toLowerCase()}/` : undefined,
    status: finalRows.length ? 'OK' : 'EMPTY',
    columns: finalRows.length ? fiiPeerComparisonColumns() : [],
    rows: finalRows,
    diagnostics
  };
}

function firstInfoValue(items = [], ids = []) {
  const set = new Set(ids.map(id => String(id || '').toLowerCase()));
  const item = (Array.isArray(items) ? items : []).find(row => set.has(String(row?.id || '').toLowerCase()));
  return cleanInvestidor10InfoValue(item?.value || '');
}

function extractFiiReferenceTypeSegmentFromText(plain = '', ticker = '') {
  const symbol = String(ticker || '').toUpperCase();
  const section = normalizePeerTableText(plain);
  const targetPattern = symbol
    ? new RegExp(`Comparando\s+o\s+${escapeRegExp(symbol)}\s+com\s+a\s+m[eé]dia\s+dos\s+indicadores\s+dos\s+FIIs\s+de\s+tipo\s*\(([^)]+)\)\s+e\s+do\s+segmento\s*\(([^)]+)\)`, 'i')
    : /Comparando\s+o\s+[A-Z]{4}\d{2}\s+com\s+a\s+m[eé]dia\s+dos\s+indicadores\s+dos\s+FIIs\s+de\s+tipo\s*\(([^)]+)\)\s+e\s+do\s+segmento\s*\(([^)]+)\)/i;
  const match = section.match(targetPattern) || section.match(/FIIs\s+de\s+tipo\s*\(([^)]+)\)\s+e\s+do\s+segmento\s*\(([^)]+)\)/i);
  return {
    fundType: normalizeFiiPeerType(match?.[1] || ''),
    segment: normalizePeerTableText(match?.[2] || '')
  };
}

function parseFiiRelatedPeerRowChunk(chunk = '', referenceTicker = '', context = {}) {
  const ticker = String(chunk.match(/\b[A-Z]{4}\d{2}\b/i)?.[0] || '').toUpperCase();
  if (!ticker || ticker === String(referenceTicker || '').toUpperCase()) return null;
  const text = normalizePeerTableText(chunk);
  const dyDisplay = normalizePeerTableText(text.match(/DY\s*:?\s*([+-]?\d{1,3}(?:[.,]\d+)?\s*%|0\s*%)/i)?.[1] || '').replace(/\s+%/g, '%');
  const pvpDisplay = normalizePeerTableText(text.match(/P\s*\/\s*VP\s*:?\s*([+-]?\d{1,3}(?:[.,]\d+)?)/i)?.[1] || '').replace('.', ',');
  if (!dyDisplay && !pvpDisplay) return null;
  return {
    ticker,
    isReference: false,
    dividendYield: parseBrNumber(dyDisplay),
    dividendYieldDisplay: dyDisplay || '—',
    pvp: parseBrNumber(pvpDisplay),
    pvpDisplay: pvpDisplay || '—',
    patrimonialValue: null,
    patrimonialValueDisplay: '—',
    fundType: '—',
    segment: '—',
    source: 'Investidor10 FIIs Relacionados'
  };
}

function buildFiiReferencePeerRowFromQuickMetrics(ticker = '', quickMetrics = {}, context = {}) {
  const symbol = String(ticker || '').toUpperCase();
  if (!symbol) return null;
  const dyDisplay = normalizePeerTableText(quickMetrics?.dy12mDisplay || quickMetrics?.dividendYieldDisplay || quickMetrics?.dyDisplay || '');
  const pvpDisplay = normalizePeerTableText(quickMetrics?.pvpDisplay || quickMetrics?.priceToBookDisplay || '');
  if (!dyDisplay && !pvpDisplay) return null;
  return {
    ticker: symbol,
    isReference: true,
    dividendYield: finiteNumberOrNull(quickMetrics?.dy12m) ?? parseBrNumber(dyDisplay),
    dividendYieldDisplay: dyDisplay || '—',
    pvp: finiteNumberOrNull(quickMetrics?.pvp) ?? parseBrNumber(pvpDisplay),
    pvpDisplay: pvpDisplay || '—',
    patrimonialValue: null,
    patrimonialValueDisplay: '—',
    fundType: context.fundType || '—',
    segment: context.segment || '—',
    source: 'Investidor10'
  };
}

function extractInvestidor10FiiRelatedPeerComparison(html = '', ticker = '', quickMetrics = {}) {
  const plain = htmlToPlainText(String(html || '').replace(/<\/?(?:table|thead|tbody|tr|th|td|h[1-6]|p|div|span|li)[^>]*>/gi, ' '));
  const start = plain.search(/FIIs\s+Relacionad[ao]s/i);
  if (start < 0) return emptyFiiPeerComparison(ticker, { mode: 'related_fiis_real_source', reason: 'related_section_not_found' });
  const rawSection = plain.slice(start, start + 5200);
  const endRel = rawSection.slice(60).search(/(?:Comparar\s+Fiis|D[ÚU]VIDAS\s+COMUNS|NOT[ÍI]CIAS\s+SOBRE|Copyright|Pol[íi]tica\s+de\s+Privacidade|Termos\s+de\s+Uso|Mais\s+FIIs)/i);
  const section = normalizePeerTableText(endRel >= 0 ? rawSection.slice(0, 60 + endRel) : rawSection);
  const context = extractFiiReferenceTypeSegmentFromText(plain, ticker);
  const matches = [...section.matchAll(/\b[A-Z]{4}\d{2}\b/g)];
  const rows = [];
  const seen = new Set();
  const reference = buildFiiReferencePeerRowFromQuickMetrics(ticker, quickMetrics, context);
  if (reference) {
    rows.push(reference);
    seen.add(reference.ticker);
  }
  for (let index = 0; index < matches.length; index++) {
    const startIdx = matches[index].index ?? 0;
    const endIdx = index + 1 < matches.length ? (matches[index + 1].index ?? section.length) : section.length;
    const chunk = section.slice(startIdx, endIdx);
    const row = parseFiiRelatedPeerRowChunk(chunk, ticker, context);
    if (!row || seen.has(row.ticker)) continue;
    seen.add(row.ticker);
    rows.push(row);
    if (rows.length >= 24) break;
  }
  return buildFiiPeerComparisonPayload(rows, ticker, {
    mode: 'related_fiis_real_source',
    reason: 'rendered_comparison_table_has_headers_but_no_rows',
    rowCandidates: matches.length,
    parsedRows: rows.length,
    fundType: context.fundType || undefined,
    segment: context.segment || undefined,
    policy: 'source_only_no_static_substitution_no_mock'
  }, 'Investidor10');
}


function fiiPeerPatrimonialValueFromHtml(html = '', ticker = '') {
  const symbol = String(ticker || '').toUpperCase();
  if (!html || !symbol) return null;
  const info = extractInvestidor10FiiInformation(html, symbol);
  const quickMetrics = extractInvestidor10FiiQuickMetrics(html, symbol);
  const patrimonial = buildFiiPatrimonialInfoPayload({
    html,
    ticker: symbol,
    quickMetrics,
    infoItems: info.items || [],
    canonical: {},
    peerComparison: null
  });
  const metric = (patrimonial?.metrics || []).find(item => item?.id === 'patrimonial_value');
  const value = finiteNumberOrNull(metric?.value);
  const valueDisplay = cleanInvestidor10InfoValue(metric?.valueDisplay || '');
  if (value === null && (!valueDisplay || valueDisplay === '—')) return null;
  return {
    value,
    valueDisplay: valueDisplay || (value !== null ? formatCompactMoney(value) : '—'),
    source: 'Investidor10 página individual do FII'
  };
}

function applyFiiPeerPatrimonialValue(row = {}, parsed = null) {
  if (!parsed) return row;
  return {
    ...row,
    patrimonialValue: parsed.value,
    patrimonialValueDisplay: parsed.valueDisplay || '—',
    patrimonialSource: parsed.source,
    source: row.source || parsed.source
  };
}

async function enrichFiiPeerComparisonPatrimonialValues(peerComparison = {}, {
  referenceTicker = '',
  referenceHtml = '',
  timeoutMs = 6500,
  maxRemoteRows = 8,
  concurrency = 4
} = {}) {
  const rows = Array.isArray(peerComparison?.rows) ? peerComparison.rows : [];
  if (!rows.length) return peerComparison;
  const symbol = String(referenceTicker || '').toUpperCase();
  const output = rows.map(row => ({ ...row }));
  const referenceParsed = fiiPeerPatrimonialValueFromHtml(referenceHtml, symbol);
  for (let index = 0; index < output.length; index++) {
    if (String(output[index]?.ticker || '').toUpperCase() === symbol && referenceParsed) {
      output[index] = applyFiiPeerPatrimonialValue(output[index], referenceParsed);
    }
  }

  const pending = output
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => String(row?.ticker || '').toUpperCase() !== symbol)
    .filter(({ row }) => finiteNumberOrNull(row?.patrimonialValue) === null)
    .slice(0, Math.max(0, Number(maxRemoteRows) || 0));
  let cursor = 0;
  const failures = [];
  async function worker() {
    while (cursor < pending.length) {
      const current = pending[cursor++];
      const peerTicker = String(current.row?.ticker || '').toUpperCase();
      if (!/^[A-Z]{4}\d{2}$/.test(peerTicker)) continue;
      const url = `https://investidor10.com.br/fiis/${peerTicker.toLowerCase()}/`;
      const response = await fetchText(url, {
        timeoutMs: Math.min(3500, Math.max(1800, Number(timeoutMs) || 3200)),
        ttlMs: 30 * 60_000,
        staleMs: 24 * 60 * 60_000,
        retries: 0,
        headers: { Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' }
      }).catch(error => ({ text: '', status: 0, error: error?.message || String(error) }));
      const parsed = fiiPeerPatrimonialValueFromHtml(response?.text || '', peerTicker);
      if (parsed) output[current.index] = applyFiiPeerPatrimonialValue(output[current.index], parsed);
      else failures.push({ ticker: peerTicker, status: response?.status || 0, error: response?.error || 'patrimonial_value_not_found' });
    }
  }
  await Promise.all(Array.from({ length: Math.min(Math.max(1, Number(concurrency) || 1), Math.max(1, pending.length)) }, worker));
  const finalRows = markFiiPeerBestRows(output);
  const enriched = finalRows.filter(row => finiteNumberOrNull(row?.patrimonialValue) !== null).length;
  return {
    ...peerComparison,
    rows: finalRows,
    diagnostics: {
      ...(peerComparison?.diagnostics || {}),
      patrimonialEnrichment: {
        requested: pending.length + (referenceParsed ? 1 : 0),
        enriched,
        missing: finalRows.length - enriched,
        failures: failures.slice(0, 20),
        policy: 'individual_investidor10_fii_pages_no_inference_no_mock'
      }
    }
  };
}

function extractInvestidor10FiiPeerComparison(html = '', ticker = '', quickMetrics = {}) {
  const plain = htmlToPlainText(String(html || '').replace(/<\/?(?:table|thead|tbody|tr|th|td)[^>]*>/gi, ' '));
  const start = plain.search(/COMPARANDO\s+COM\s+OUTROS\s+FIIS/i);
  if (start < 0) return extractInvestidor10FiiRelatedPeerComparison(html, ticker, quickMetrics);
  const rawSection = plain.slice(start, start + 7600);
  const endRel = rawSection.slice(80).search(/(?:FIIS\s+RELACIONADOS|D[ÚU]VIDAS\s+COMUNS|NOT[ÍI]CIAS\s+SOBRE|LISTA\s+DE\s+IM[ÓO]VEIS|INFORMA[ÇC][ÕO]ES\s+SOBRE\s+VALOR\s+PATRIMONIAL|M[ÉE]DIA\s+DO\s+TIPO)/i);
  const section = normalizePeerTableText(endRel >= 0 ? rawSection.slice(0, 80 + endRel) : rawSection);
  const matches = [...section.matchAll(/\b[A-Z]{4}\d{2}\b/g)];
  const rows = [];
  const seen = new Set();
  for (let index = 0; index < matches.length; index++) {
    const startIdx = matches[index].index ?? 0;
    const endIdx = index + 1 < matches.length ? (matches[index + 1].index ?? section.length) : section.length;
    const chunk = section.slice(startIdx, endIdx);
    const row = parseFiiPeerRowChunk(chunk, ticker);
    if (!row || seen.has(row.ticker)) continue;
    seen.add(row.ticker);
    rows.push(row);
    if (rows.length >= 40) break;
  }
  if (rows.length) {
    return buildFiiPeerComparisonPayload(rows, ticker, {
      mode: 'rendered_table',
      rowCandidates: matches.length,
      parsedRows: rows.length,
      policy: 'no_static_substitution'
    }, 'Investidor10');
  }
  return extractInvestidor10FiiRelatedPeerComparison(html, ticker, quickMetrics);
}

function returnsRowsFromInvestidor10(canonical = {}) {
  const profitability = canonical?.profitability || {};
  const periods = Array.isArray(profitability.periods) && profitability.periods.length
    ? profitability.periods
    : ['1 mês', '3 meses', '1 ano', '2 anos', '5 anos', '10 anos'];
  const nominalByPeriod = new Map((profitability.nominal || []).map(item => [item.period || item.label, item]));
  const realByPeriod = new Map((profitability.real || []).map(item => [item.period || item.label, item]));
  return periods.map(label => {
    const nominal = nominalByPeriod.get(label);
    const real = realByPeriod.get(label);
    const key = label.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_');
    return {
      key,
      label,
      returnPercent: Number.isFinite(Number(nominal?.valuePercent)) ? round(Number(nominal.valuePercent), 4) : null,
      returnDisplay: nominal?.raw || (Number.isFinite(Number(nominal?.valuePercent)) ? formatPercent(Number(nominal.valuePercent)) : '—'),
      realReturnPercent: Number.isFinite(Number(real?.valuePercent)) ? round(Number(real.valuePercent), 4) : null,
      realReturnDisplay: real?.raw || (Number.isFinite(Number(real?.valuePercent)) ? formatPercent(Number(real.valuePercent)) : '—'),
      source: 'Investidor10'
    };
  }).filter(row => row.returnPercent !== null || row.realReturnPercent !== null);
}

function emptyFiiDistributions12m(ticker = '', diagnostics = {}) {
  return {
    id: 'fii_distributions_12m',
    title: 'Distribuições nos últimos 12 meses',
    subtitle: ticker ? `Rendimentos recentes de ${String(ticker).toUpperCase()} por janela acumulada.` : 'Rendimentos recentes do FII por janela acumulada.',
    description: ticker
      ? `Mostra o rendimento FII ${String(ticker).toUpperCase()} nos últimos 1, 3, 6 e 12 meses. Um maior Yield sugere maior retorno. O valor em reais é referente ao valor pago por cota do ativo.`
      : 'Mostra o rendimento do FII nos últimos 1, 3, 6 e 12 meses. Um maior Yield sugere maior retorno. O valor em reais é referente ao valor pago por cota do ativo.',
    status: 'EMPTY',
    source: 'Investidor10',
    items: [],
    diagnostics
  };
}

function distributionPeriodKey(period = '') {
  const key = normalizeLooseText(period).replace(/\s+/g, ' ');
  if (/^1\s*(?:mes|m\b)/i.test(key)) return '1m';
  if (/^3\s*(?:meses|m\b)/i.test(key)) return '3m';
  if (/^6\s*(?:meses|m\b)/i.test(key)) return '6m';
  if (/^12\s*(?:meses|m\b)|1\s*ano/i.test(key)) return '12m';
  return key.replace(/[^a-z0-9]+/g, '_') || 'periodo';
}

function distributionLabelForKey(key = '', fallback = '') {
  if (key === '1m') return 'Yield 1 mês';
  if (key === '3m') return 'Yield 3 meses';
  if (key === '6m') return 'Yield 6 meses';
  if (key === '12m') return 'Yield 12 meses';
  return fallback ? `Yield ${fallback}` : 'Yield';
}

function normalizeFiiDistributionItem(item = {}, index = 0) {
  const periodRaw = cleanInvestidor10InfoValue(item.period || item.label || item.name || item.window || item.key || '');
  const key = distributionPeriodKey(periodRaw || `${index + 1}`);
  const yieldValue = Number(item.yieldPercent ?? item.dividendYield ?? item.dy ?? item.valuePercent ?? item.percent ?? item.percentage ?? item.yield);
  const amountValue = Number(item.amount ?? item.valuePerShare ?? item.price ?? item.payout ?? item.valor ?? item.value);
  const hasYield = Number.isFinite(yieldValue);
  const hasAmount = Number.isFinite(amountValue);
  if (!hasYield && !hasAmount) return null;
  return {
    key,
    label: distributionLabelForKey(key, periodRaw),
    period: periodRaw || key.toUpperCase(),
    yieldPercent: hasYield ? round(yieldValue, 4) : null,
    yieldDisplay: hasYield ? formatPercent(yieldValue, false) : '—',
    amount: hasAmount ? round(amountValue, 4) : null,
    amountDisplay: hasAmount ? `R$ ${amountValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—',
    source: item.source || 'Investidor10'
  };
}

function extractFiiDistributions12mFromHtml(html = '') {
  const plain = htmlToPlainText(html);
  const idx = plain.search(/Distribui[çc][õo]es\s+nos\s+[úu]ltimos\s+12\s+meses/i);
  if (idx < 0) return [];
  const section = plain.slice(idx, idx + 1200);
  const out = [];
  const re = /YIELD\s+(1\s*M[ÊE]S|3\s*MESES|6\s*MESES|12\s*MESES)\s+([+-]?\d{1,3}(?:\.\d{3})*(?:,\d+)?|[+-]?\d+(?:\.\d+)?)\s*%\s+R\$\s*([\d.,]+)/gi;
  let match;
  while ((match = re.exec(section)) && out.length < 8) {
    out.push({ period: match[1].replace(/\s+/g, ' '), yieldPercent: parseBrNumber(`${match[2]}%`), amount: parseMoneyScale(`R$ ${match[3]}`), source: 'Investidor10 HTML' });
  }
  return out;
}

function buildFiiDistributions12mPayload({ canonical = {}, html = '', ticker = '' } = {}) {
  const canonicalRows = Array.isArray(canonical?.fii?.distribution12m) ? canonical.fii.distribution12m : [];
  const htmlRows = canonicalRows.length ? [] : extractFiiDistributions12mFromHtml(html);
  const rows = (canonicalRows.length ? canonicalRows : htmlRows)
    .map(normalizeFiiDistributionItem)
    .filter(Boolean);
  const order = ['1m', '3m', '6m', '12m'];
  const deduped = [];
  const seen = new Set();
  for (const key of order) {
    const item = rows.find(row => row.key === key);
    if (item && !seen.has(item.key)) { deduped.push(item); seen.add(item.key); }
  }
  for (const item of rows) {
    if (!seen.has(item.key)) { deduped.push(item); seen.add(item.key); }
  }
  if (!deduped.length) return emptyFiiDistributions12m(ticker, { reason: 'section_not_found_or_empty' });
  return {
    id: 'fii_distributions_12m',
    title: 'Distribuições nos últimos 12 meses',
    subtitle: `Rendimentos recentes de ${String(ticker || '').toUpperCase()} por janela acumulada.`,
    description: `Mostra o rendimento FII ${String(ticker || '').toUpperCase()} nos últimos 1, 3, 6 e 12 meses. Um maior Yield sugere maior retorno. O valor em reais é referente ao valor pago por cota do ativo.`,
    status: 'OK',
    source: 'Investidor10',
    sourceUrl: ticker ? `https://investidor10.com.br/fiis/${String(ticker).toLowerCase()}/` : undefined,
    items: deduped,
    diagnostics: {
      canonicalRows: canonicalRows.length,
      htmlRows: htmlRows.length,
      returnedRows: deduped.length
    }
  };
}



function emptyFiiDividendCharts(ticker = '', diagnostics = {}) {
  const symbol = String(ticker || '').toUpperCase();
  return {
    id: 'fii_dividend_yield_and_dividends',
    title: symbol ? `Dividend Yield ${symbol}` : 'Dividend Yield',
    dividendsTitle: symbol ? `${symbol} Dividendos` : 'Dividendos',
    status: 'EMPTY',
    source: 'Investidor10',
    sourceUrl: symbol ? `https://investidor10.com.br/fiis/${symbol.toLowerCase()}/` : undefined,
    defaultFrequency: 'monthly',
    defaultPeriod: '1y',
    frequencyOptions: [
      { key: 'monthly', label: 'Mensal' },
      { key: 'yearly', label: 'Anual' }
    ],
    periodOptions: [
      { key: '1y', label: '1A', months: 12 },
      { key: '5y', label: '5A', months: 60 },
      { key: 'max', label: 'MAX' }
    ],
    currentDy: null,
    currentDyDisplay: '—',
    averageDy5y: null,
    averageDy5yDisplay: '—',
    total12m: null,
    total12mDisplay: '—',
    summary: symbol ? `${symbol} ainda não retornou histórico de dividendos suficiente no Investidor10.` : 'Histórico de dividendos ainda indisponível.',
    yieldSeriesByFrequency: { monthly: [], yearly: [] },
    dividendSeriesByFrequency: { monthly: [], yearly: [] },
    events: [],
    diagnostics
  };
}


function extractFiiDividendChartsFromHtml(html = '', ticker = '', { referencePrice = null, quickMetrics = {}, distributions12m = null } = {}) {
  const symbol = String(ticker || '').toUpperCase();
  const plain = htmlToPlainText(html);
  if (!plain || !symbol) return emptyFiiDividendCharts(symbol, { reason: 'html_missing' });

  const dyStart = plain.search(new RegExp(`DIVIDEND\\s+YIELD\\s+${escapeRegExp(symbol)}`, 'i'));
  const dividendsStart = plain.search(new RegExp(`${escapeRegExp(symbol)}\\s+DIVIDENDOS`, 'i'));
  const dySection = dyStart >= 0
    ? plain.slice(dyStart, dividendsStart > dyStart ? dividendsStart : dyStart + 2500)
    : '';
  const afterDividends = dividendsStart >= 0 ? plain.slice(dividendsStart) : '';
  const divEndRel = afterDividends.slice(120).search(/\b(?:LISTA\s+DE\s+IM[ÓO]VEIS|HIST[ÓO]RICO\s+DA\s+TAXA\s+DE\s+VAC[ÂA]NCIA|COMUNICADOS|D[ÚU]VIDAS\s+COMUNS|FIIS\s+RELACIONADAS|SOBRE\s+A\s+|INFORMA[ÇC][ÕO]ES\s+SOBRE)\b/i);
  const divSection = afterDividends
    ? afterDividends.slice(0, divEndRel >= 0 ? 120 + divEndRel : 18000)
    : '';
  const total12mMatch = divSection.match(/pagou\s+o\s+total\s+de\s+R\$\s*([\d.,]+)\s+nos\s+[úu]ltimos\s+12\s+meses/i);
  const currentDy = parseBrNumber(dySection.match(/DY\s+atual\s*:?\s*([+-]?\d{1,3}(?:\.\d{3})*(?:,\d+)?|[+-]?\d+(?:\.\d+)?)\s*%/i)?.[1])
    ?? finiteNumberOrNull(quickMetrics?.dy12m)
    ?? finiteNumberOrNull(distributions12m?.items?.find?.(item => item?.key === '12m')?.yieldPercent);
  const averageDy5y = parseBrNumber(dySection.match(/DY\s+m[eé]dio\s+em\s+5\s+anos\s*:?\s*([+-]?\d{1,3}(?:\.\d{3})*(?:,\d+)?|[+-]?\d+(?:\.\d+)?)\s*%/i)?.[1]);
  const total12m = parseMoneyScale(total12mMatch ? `R$ ${total12mMatch[1]}` : '')
    ?? finiteNumberOrNull(distributions12m?.items?.find?.(item => item?.key === '12m')?.amount);

  const eventRows = [];
  if (divSection) {
    const rowPattern = /(Dividendos?|Rendimentos?|JCP|JSCP|Amortiza(?:ç|c)[aã]o|Red\.?\s*Cap\.?)\s+(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4})\s+(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}|A\s+definir|N[ãa]o\s+informado|Provisionad[oa]|-)\s+([0-9]{1,3}(?:\.[0-9]{3})*,[0-9]+|[0-9]+,[0-9]+|[0-9]+\.[0-9]+)/gi;
    let match;
    while ((match = rowPattern.exec(divSection)) && eventRows.length < 600) {
      const value = parseBrNumber(match[4]);
      const dataCom = parseIsoDateLoose(match[2]);
      const paymentDate = parseIsoDateLoose(match[3]);
      if (!dataCom || !Number.isFinite(Number(value))) continue;
      eventRows.push({
        ticker: symbol,
        type: cleanInvestidor10InfoValue(match[1]) || 'Dividendos',
        dataCom: dataCom.iso,
        dataComDisplay: `${String(dataCom.day).padStart(2, '0')}/${String(dataCom.month).padStart(2, '0')}/${dataCom.year}`,
        paymentDate: paymentDate?.iso || '',
        paymentDateDisplay: paymentDate ? `${String(paymentDate.day).padStart(2, '0')}/${String(paymentDate.month).padStart(2, '0')}/${paymentDate.year}` : cleanInvestidor10InfoValue(match[3]),
        value: round(Number(value), 8),
        valueDisplay: Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 8, maximumFractionDigits: 8 }),
        source: 'Investidor10 HTML dividendos visíveis'
      });
    }
  }

  const dedupedEvents = [];
  const seenEvents = new Set();
  for (const event of eventRows.sort((a, b) => String(b.paymentDate || b.dataCom).localeCompare(String(a.paymentDate || a.dataCom)))) {
    const key = `${event.type}|${event.dataCom}|${event.paymentDate}|${event.value}`;
    if (seenEvents.has(key)) continue;
    seenEvents.add(key);
    dedupedEvents.push(event);
  }

  const aggregates = aggregateDividendEvents(dedupedEvents);
  const monthlyDividends = aggregates.monthly;
  const yearlyDividends = aggregates.yearly;
  // Não reconstruir Dividend Yield histórico com a cotação atual ou com uma cotação
  // implícita derivada do DY de 12 meses. Sem percentuais históricos publicados pela fonte,
  // o gráfico percentual permanece indisponível e somente os dividendos reais são exibidos.
  const monthlyYield = [];
  const yearlyYield = [];
  const hasData = Boolean(dedupedEvents.length || monthlyDividends.length || monthlyYield.length || finiteNumberOrNull(currentDy) !== null || finiteNumberOrNull(total12m) !== null);
  if (!hasData) return emptyFiiDividendCharts(symbol, { reason: 'html_dividend_section_not_found_or_empty', dyStart, dividendsStart });

  return {
    id: 'fii_dividend_yield_and_dividends',
    title: `Dividend Yield ${symbol}`,
    dividendsTitle: `${symbol} Dividendos`,
    status: 'OK',
    source: 'Investidor10',
    sourceUrl: symbol ? `https://investidor10.com.br/fiis/${symbol.toLowerCase()}/` : undefined,
    defaultFrequency: 'monthly',
    defaultPeriod: '1y',
    frequencyOptions: [
      { key: 'monthly', label: 'Mensal' },
      { key: 'yearly', label: 'Anual' }
    ],
    periodOptions: [
      { key: '1y', label: '1A', months: 12 },
      { key: '5y', label: '5A', months: 60 },
      { key: 'max', label: 'MAX' }
    ],
    currentDy: finiteNumberOrNull(currentDy) === null ? null : round(Number(currentDy), 4),
    currentDyDisplay: finiteNumberOrNull(currentDy) === null ? '—' : formatPercent(Number(currentDy), false),
    averageDy5y: finiteNumberOrNull(averageDy5y) === null ? null : round(Number(averageDy5y), 4),
    averageDy5yDisplay: finiteNumberOrNull(averageDy5y) === null ? '—' : formatPercent(Number(averageDy5y), false),
    total12m: finiteNumberOrNull(total12m) === null ? null : round(Number(total12m), 8),
    total12mDisplay: finiteNumberOrNull(total12m) === null ? '—' : `R$ ${Number(total12m).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 8 })}`,
    summary: finiteNumberOrNull(total12m) !== null
      ? `${symbol} pagou o total de R$ ${Number(total12m).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} nos últimos 12 meses.`
      : `Histórico de dividendos de ${symbol} retornado pelo Investidor10.`,
    yieldSeriesByFrequency: { monthly: monthlyYield, yearly: yearlyYield },
    dividendSeriesByFrequency: { monthly: monthlyDividends, yearly: yearlyDividends },
    events: dedupedEvents.slice(0, 240),
    diagnostics: {
      sourcePolicy: 'parsed_from_investidor10_visible_html_dividend_sections',
      dyStart,
      dividendsStart,
      visibleEvents: dedupedEvents.length,
      dividendMonthly: monthlyDividends.length,
      dividendYearly: yearlyDividends.length,
      dividendYieldMonthly: monthlyYield.length,
      dividendYieldYearly: yearlyYield.length,
      dyDerivedFromDividends: false,
      dataNature: { dividendSeries: 'DIRECT', yieldSeries: 'EMPTY_UNLESS_SOURCE_PUBLISHES_HISTORY' }
    }
  };
}

function parseIsoDateLoose(value = '') {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return { year: Number(iso[1]), month: Number(iso[2]), day: Number(iso[3]), iso: `${iso[1]}-${iso[2]}-${iso[3]}` };
  const br = raw.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (br) {
    let year = Number(br[3]);
    if (br[3].length === 2) year = year >= 70 ? 1900 + year : 2000 + year;
    const month = Number(br[2]);
    const day = Number(br[1]);
    if (year > 1900 && month >= 1 && month <= 12 && day >= 1 && day <= 31) return { year, month, day, iso: `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}` };
  }
  const ts = Date.parse(raw);
  if (Number.isFinite(ts)) {
    const d = new Date(ts);
    return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate(), iso: d.toISOString().slice(0, 10) };
  }
  return null;
}

function monthLabelPt(year, month) {
  return `${String(month).padStart(2, '0')}/${String(year).padStart(4, '0')}`;
}

function monthKeyFromParts(year, month) {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}`;
}

function dividendPointFromAggregate(item = {}, fallbackFrequency = 'monthly') {
  const rawPeriod = cleanInvestidor10InfoValue(item.period || item.label || item.date || item.data || item.month || item.year || '');
  const rawYear = Number(item.year || item.ano);
  let year = Number.isFinite(rawYear) && rawYear > 1900 ? rawYear : null;
  let month = null;
  const iso = parseIsoDateLoose(item.date || item.data || item.paymentDate || item.payDate || '');
  if (iso) { year = iso.year; month = iso.month; }
  if (!year && /^\d{4}$/.test(rawPeriod)) year = Number(rawPeriod);
  const brMonth = rawPeriod.match(/^(\d{1,2})[\/\-.](\d{4})$/);
  if (brMonth) { month = Number(brMonth[1]); year = Number(brMonth[2]); }
  const isoMonth = rawPeriod.match(/^(\d{4})-(\d{1,2})$/);
  if (isoMonth) { year = Number(isoMonth[1]); month = Number(isoMonth[2]); }
  const value = Number(item.value ?? item.total ?? item.amount ?? item.valuePerShare ?? item.valor ?? item.y ?? item.close);
  if (!Number.isFinite(value)) return null;
  const frequency = month ? 'monthly' : fallbackFrequency;
  const period = frequency === 'monthly' && year && month ? monthKeyFromParts(year, month) : (year ? String(year) : rawPeriod);
  const label = frequency === 'monthly' && year && month ? monthLabelPt(year, month) : (year ? String(year) : rawPeriod || 'Período');
  return {
    period,
    label,
    date: year && month ? `${period}-01` : undefined,
    year,
    month,
    value: round(value, 8),
    valueDisplay: `R$ ${Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 8 })}`,
    source: item.source || 'Investidor10'
  };
}

function normalizeFiiDividendEvent(item = {}, ticker = '') {
  const type = cleanInvestidor10InfoValue(item.type || item.kind || item.tipo || 'Dividendos') || 'Dividendos';
  const dataCom = parseIsoDateLoose(item.dataCom || item.dateCom || item.comDate || item.recordDate || item.date || item.data || '');
  const payment = parseIsoDateLoose(item.paymentDate || item.payDate || item.pagamento || item.payment || '');
  const value = Number(item.valuePerShare ?? item.amountPerShare ?? item.value ?? item.amount ?? item.valor);
  if (!Number.isFinite(value) || !dataCom) return null;
  return {
    ticker: String(item.ticker || item.asset || ticker || '').toUpperCase(),
    type,
    dataCom: dataCom.iso,
    dataComDisplay: `${String(dataCom.day).padStart(2, '0')}/${String(dataCom.month).padStart(2, '0')}/${dataCom.year}`,
    paymentDate: payment?.iso || '',
    paymentDateDisplay: payment ? `${String(payment.day).padStart(2, '0')}/${String(payment.month).padStart(2, '0')}/${payment.year}` : cleanInvestidor10InfoValue(item.paymentRaw || ''),
    value: round(value, 8),
    valueDisplay: Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 8, maximumFractionDigits: 8 }),
    source: item.source || 'Investidor10'
  };
}

function aggregateDividendEvents(events = []) {
  const byMonth = new Map();
  const byYear = new Map();
  for (const event of events) {
    const d = parseIsoDateLoose(event.paymentDate || event.dataCom || '');
    const value = Number(event.value);
    if (!d || !Number.isFinite(value)) continue;
    const monthKey = monthKeyFromParts(d.year, d.month);
    byMonth.set(monthKey, (byMonth.get(monthKey) || 0) + value);
    byYear.set(String(d.year), (byYear.get(String(d.year)) || 0) + value);
  }
  const monthly = [...byMonth.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([period, value]) => {
    const [year, month] = period.split('-').map(Number);
    return { period, label: monthLabelPt(year, month), date: `${period}-01`, year, month, value: round(value, 8), valueDisplay: `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 8 })}`, source: 'Investidor10 eventos agregados' };
  });
  const yearly = [...byYear.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([year, value]) => ({ period: year, label: year, year: Number(year), value: round(value, 8), valueDisplay: `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 8 })}`, source: 'Investidor10 eventos agregados' }));
  return { monthly, yearly };
}

export function enrichFiiDividendChartsWithHistoricalYield(dividendCharts = {}, history = {}) {
  const existingMonthly = dividendCharts?.yieldSeriesByFrequency?.monthly;
  if (dividendCharts?.status !== 'OK' || (Array.isArray(existingMonthly) && existingMonthly.length)) return dividendCharts;
  const dividends = Array.isArray(dividendCharts?.dividendSeriesByFrequency?.monthly)
    ? dividendCharts.dividendSeriesByFrequency.monthly
    : [];
  const historyPoints = Array.isArray(history?.points) ? history.points : [];
  if (!dividends.length || !historyPoints.length) return dividendCharts;

  const closesByMonth = new Map();
  const firstCloseByYear = new Map();
  const sortedHistory = historyPoints.map(point => {
    const rawDate = point?.date || point?.datetime || point?.time || point?.timestamp;
    const date = typeof rawDate === 'number'
      ? new Date(rawDate > 10_000_000_000 ? rawDate : rawDate * 1000)
      : new Date(rawDate || '');
    const close = finiteNumberOrNull(point?.close ?? point?.adjustedClose ?? point?.adjClose);
    return Number.isFinite(date.getTime()) && close !== null && close > 0 ? { date, close } : null;
  }).filter(Boolean).sort((a, b) => a.date.getTime() - b.date.getTime());

  for (const point of sortedHistory) {
    const year = point.date.getUTCFullYear();
    const month = point.date.getUTCMonth() + 1;
    closesByMonth.set(monthKeyFromParts(year, month), point.close);
    if (!firstCloseByYear.has(String(year))) firstCloseByYear.set(String(year), point.close);
  }

  const monthly = dividends.map(dividend => {
    const period = String(dividend?.period || '');
    const year = Number(dividend?.year || period.slice(0, 4));
    const month = Number(dividend?.month || period.slice(5, 7));
    const historicalClose = closesByMonth.get(monthKeyFromParts(year, month));
    const amount = finiteNumberOrNull(dividend?.value);
    if (!Number.isFinite(year) || !Number.isFinite(month) || amount === null || !Number.isFinite(historicalClose) || historicalClose <= 0) return null;
    const yieldPercent = round((amount / historicalClose) * 100, 4);
    return {
      period: monthKeyFromParts(year, month),
      label: dividend?.label || monthLabelPt(year, month),
      date: dividend?.date || `${monthKeyFromParts(year, month)}-01`,
      year,
      month,
      value: yieldPercent,
      valueDisplay: formatPercent(yieldPercent, false),
      yieldPercent,
      yieldDisplay: formatPercent(yieldPercent, false),
      historicalClose: round(historicalClose, 4),
      calculated: true,
      source: 'Cálculo Proxy: dividendo Investidor10 / fechamento histórico Yahoo Finance'
    };
  }).filter(Boolean);
  if (!monthly.length) return dividendCharts;

  const dividendsByYear = new Map();
  for (const dividend of dividends) {
    const year = String(dividend?.year || String(dividend?.period || '').slice(0, 4));
    const amount = finiteNumberOrNull(dividend?.value);
    if (/^\d{4}$/.test(year) && amount !== null) dividendsByYear.set(year, (dividendsByYear.get(year) || 0) + amount);
  }
  const yearly = [...dividendsByYear.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([year, amount]) => {
    const historicalClose = firstCloseByYear.get(year);
    if (!Number.isFinite(historicalClose) || historicalClose <= 0) return null;
    const yieldPercent = round((amount / historicalClose) * 100, 4);
    return {
      period: year,
      label: year,
      year: Number(year),
      value: yieldPercent,
      valueDisplay: formatPercent(yieldPercent, false),
      yieldPercent,
      yieldDisplay: formatPercent(yieldPercent, false),
      historicalClose: round(historicalClose, 4),
      calculated: true,
      source: 'Cálculo Proxy: dividendos anuais Investidor10 / primeiro fechamento histórico Yahoo Finance do ano'
    };
  }).filter(Boolean);

  const averageDy5y = averageLastYears(yearly.length ? yearly : monthly, 5);
  return {
    ...dividendCharts,
    source: `${dividendCharts.source || 'Investidor10'} + Yahoo Finance histórico`,
    averageDy5y: Number.isFinite(averageDy5y) ? round(averageDy5y, 4) : dividendCharts.averageDy5y,
    averageDy5yDisplay: Number.isFinite(averageDy5y) ? formatPercent(averageDy5y, false) : dividendCharts.averageDy5yDisplay,
    yieldSeriesByFrequency: { monthly, yearly },
    diagnostics: {
      ...(dividendCharts.diagnostics || {}),
      dividendYieldMonthly: monthly.length,
      dividendYieldYearly: yearly.length,
      dyDerivedFromDividends: true,
      dyDerivedFromCurrentPrice: false,
      sourcePolicy: 'historical_dividends_over_historical_yahoo_closes',
      yieldCalculation: 'Dividend Yield calculado com dividendos reais e fechamento histórico do mesmo período; a cotação atual nunca é usada para reconstruir o histórico.',
      dataNature: { ...(dividendCharts.diagnostics?.dataNature || {}), yieldSeries: 'CALCULATED_FROM_DIRECT_HISTORICAL_SERIES' }
    }
  };
}

function normalizeDividendYieldPoint(item = {}, fallbackFrequency = 'monthly') {
  const base = dividendPointFromAggregate(item, fallbackFrequency);
  if (!base) return null;
  const rawYield = Number(item.yieldPercent ?? item.dividendYield ?? item.dy ?? item.valuePercent ?? item.percent ?? item.percentage ?? item.value ?? item.y);
  if (!Number.isFinite(rawYield)) return null;
  return {
    ...base,
    value: round(rawYield, 4),
    valueDisplay: formatPercent(rawYield, false),
    yieldPercent: round(rawYield, 4),
    yieldDisplay: formatPercent(rawYield, false),
    source: item.source || 'Investidor10 histórico de Dividend Yield'
  };
}

function averageLastYears(points = [], years = 5) {
  const valid = points.filter(point => Number.isFinite(Number(point.value)) && Number.isFinite(Number(point.year)));
  if (!valid.length) return null;
  const maxYear = Math.max(...valid.map(point => Number(point.year)));
  const filtered = valid.filter(point => Number(point.year) >= maxYear - years + 1);
  if (!filtered.length) return null;
  const yearly = new Map();
  for (const p of filtered) {
    if (!yearly.has(p.year)) yearly.set(p.year, []);
    yearly.get(p.year).push(Number(p.value));
  }
  const yearlyAverages = [...yearly.values()].map(values => values.reduce((a, b) => a + b, 0) / values.length);
  return yearlyAverages.length ? yearlyAverages.reduce((a, b) => a + b, 0) / yearlyAverages.length : null;
}

function totalLastMonths(points = [], months = 12) {
  const valid = points.filter(point => Number.isFinite(Number(point.value)) && Number.isFinite(Number(point.year)) && Number.isFinite(Number(point.month)));
  if (!valid.length) return null;
  const maxIndex = Math.max(...valid.map(point => Number(point.year) * 12 + Number(point.month)));
  const minIndex = maxIndex - months + 1;
  return valid.filter(point => Number(point.year) * 12 + Number(point.month) >= minIndex).reduce((sum, point) => sum + Number(point.value), 0);
}

function yearlyFromMonthly(points = [], mode = 'sum') {
  const byYear = new Map();
  for (const point of points) {
    if (!Number.isFinite(Number(point.year)) || !Number.isFinite(Number(point.value))) continue;
    if (!byYear.has(point.year)) byYear.set(point.year, []);
    byYear.get(point.year).push(Number(point.value));
  }
  return [...byYear.entries()].sort(([a], [b]) => Number(a) - Number(b)).map(([year, values]) => {
    const value = mode === 'average' ? values.reduce((a, b) => a + b, 0) / values.length : values.reduce((a, b) => a + b, 0);
    return {
      period: String(year),
      label: String(year),
      year: Number(year),
      value: round(value, mode === 'average' ? 4 : 8),
      valueDisplay: mode === 'average' ? formatPercent(value, false) : `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 8 })}`,
      yieldPercent: mode === 'average' ? round(value, 4) : undefined,
      yieldDisplay: mode === 'average' ? formatPercent(value, false) : undefined,
      source: mode === 'average' ? 'Investidor10 histórico de Dividend Yield anualizado por média mensal' : 'Investidor10 dividendos anualizados'
    };
  });
}

function buildFiiDividendChartsPayload({ canonical = {}, html = '', ticker = '', quickMetrics = {}, distributions12m = null, referencePrice = null } = {}) {
  const symbol = String(ticker || '').toUpperCase();
  const fii = canonical?.fii || {};
  const rawEvents = Array.isArray(fii.dividendHistory) ? fii.dividendHistory : (Array.isArray(canonical?.dividendHistory) ? canonical.dividendHistory : []);
  const events = rawEvents.map(item => normalizeFiiDividendEvent(item, symbol)).filter(Boolean).sort((a, b) => String(b.paymentDate || b.dataCom).localeCompare(String(a.paymentDate || a.dataCom)));
  const aggregatesFromEvents = aggregateDividendEvents(events);
  const rawMonthly = Array.isArray(fii.dividendMonthly) && fii.dividendMonthly.length ? fii.dividendMonthly : (Array.isArray(canonical?.dividendMonthly) ? canonical.dividendMonthly : []);
  const rawYearly = Array.isArray(fii.dividendYearly) && fii.dividendYearly.length ? fii.dividendYearly : (Array.isArray(canonical?.dividendYearly) ? canonical.dividendYearly : []);
  const dividendMonthly = rawMonthly.map(item => dividendPointFromAggregate(item, 'monthly')).filter(Boolean);
  const dividendYearly = rawYearly.map(item => dividendPointFromAggregate(item, 'yearly')).filter(Boolean);
  const finalDividendMonthly = dividendMonthly.length ? dividendMonthly : aggregatesFromEvents.monthly;
  const finalDividendYearly = dividendYearly.length ? dividendYearly : (dividendMonthly.length ? yearlyFromMonthly(dividendMonthly, 'sum') : aggregatesFromEvents.yearly);
  const rawDy = Array.isArray(fii.dividendYieldHistory) && fii.dividendYieldHistory.length ? fii.dividendYieldHistory : (Array.isArray(canonical?.dividendYieldHistory) ? canonical.dividendYieldHistory : []);
  const yieldMonthly = rawDy.map(item => normalizeDividendYieldPoint(item, 'monthly')).filter(Boolean);
  const yieldYearly = yieldMonthly.length ? yearlyFromMonthly(yieldMonthly, 'average') : [];
  const currentDy = finiteNumberOrNull(quickMetrics?.dy12m)
    ?? finiteNumberOrNull(distributions12m?.items?.find?.(item => item?.key === '12m')?.yieldPercent);
  const avg5y = averageLastYears(yieldMonthly, 5) ?? averageLastYears(yieldYearly, 5);
  const total12m = totalLastMonths(finalDividendMonthly, 12)
    ?? finiteNumberOrNull(distributions12m?.items?.find?.(item => item?.key === '12m')?.amount);
  const hasData = yieldMonthly.length || yieldYearly.length || finalDividendMonthly.length || finalDividendYearly.length || events.length;
  if (!hasData && html) {
    return extractFiiDividendChartsFromHtml(html, symbol, { referencePrice, quickMetrics, distributions12m });
  }
  if (!hasData) return emptyFiiDividendCharts(symbol, { reason: 'dividend_history_not_found' });
  return {
    id: 'fii_dividend_yield_and_dividends',
    title: `Dividend Yield ${symbol}`,
    dividendsTitle: `${symbol} Dividendos`,
    status: 'OK',
    source: 'Investidor10',
    sourceUrl: symbol ? `https://investidor10.com.br/fiis/${symbol.toLowerCase()}/` : undefined,
    defaultFrequency: 'monthly',
    defaultPeriod: '1y',
    frequencyOptions: [
      { key: 'monthly', label: 'Mensal' },
      { key: 'yearly', label: 'Anual' }
    ],
    periodOptions: [
      { key: '1y', label: '1A', months: 12 },
      { key: '5y', label: '5A', months: 60 },
      { key: 'max', label: 'MAX' }
    ],
    currentDy: Number.isFinite(currentDy) ? round(currentDy, 4) : null,
    currentDyDisplay: Number.isFinite(currentDy) ? formatPercent(currentDy, false) : '—',
    averageDy5y: Number.isFinite(avg5y) ? round(avg5y, 4) : null,
    averageDy5yDisplay: Number.isFinite(avg5y) ? formatPercent(avg5y, false) : '—',
    total12m: Number.isFinite(total12m) ? round(total12m, 8) : null,
    total12mDisplay: Number.isFinite(total12m) ? `R$ ${Number(total12m).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 8 })}` : '—',
    summary: Number.isFinite(total12m)
      ? `${symbol} pagou o total de R$ ${Number(total12m).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} nos últimos 12 meses.`
      : `Histórico de dividendos de ${symbol} retornado pelo Investidor10.`,
    yieldSeriesByFrequency: {
      monthly: yieldMonthly,
      yearly: yieldYearly
    },
    dividendSeriesByFrequency: {
      monthly: finalDividendMonthly,
      yearly: finalDividendYearly
    },
    events: events.slice(0, 240),
    diagnostics: {
      events: events.length,
      dividendMonthly: finalDividendMonthly.length,
      dividendYearly: finalDividendYearly.length,
      dividendYieldMonthly: yieldMonthly.length,
      dividendYieldYearly: yieldYearly.length,
      dyDerivedFromDividends: false,
      sourcePolicy: rawDy.length ? 'investidor10_dividend_yield_history' : 'yield_history_absent_no_current_price_reconstruction',
      dataNature: { dividendSeries: 'DIRECT', yieldSeries: rawDy.length ? 'DIRECT' : 'EMPTY' }
    }
  };
}


async function fetchFiiHistoricalIndicatorsRaw({ ids = {}, ticker = '', html = '', url = '', timeoutMs = 6500 } = {}) {
  const symbol = String(ticker || '').toUpperCase();
  const resolvedFiiId = String(ids?.fiiId || await resolveInvestidor10FiiId({ ticker: symbol, html, timeoutMs }) || '').trim();
  const base = 'https://investidor10.com.br';
  const candidates = [
    ...(resolvedFiiId ? [
      `${base}/api/fii/historico-indicadores/${resolvedFiiId}/10`,
      `${base}/api/fii/historico-indicadores/${resolvedFiiId}/10/`,
      `${base}/api/fii/historico-indicadores/${resolvedFiiId}/20`,
      `${base}/api/fiis/historico-indicadores/${resolvedFiiId}/10`
    ] : []),
    ...(symbol ? [
      `${base}/api/fii/historico-indicadores/${symbol.toLowerCase()}/10`,
      `${base}/api/fiis/historico-indicadores/${symbol.toLowerCase()}/10`
    ] : [])
  ];
  if (!candidates.length) return { raw: null, resolvedFiiId: '', status: { status: 0, cacheStatus: '', error: 'fii_id_unavailable', skipped: true } };

  const attempts = await Promise.all(candidates.map(histUrl => fetchJson(histUrl, {
    timeoutMs: Math.min(7500, Math.max(3600, timeoutMs)),
    ttlMs: 15 * 60 * 1000,
    staleMs: 8 * 60 * 60 * 1000,
    retries: 1,
    headers: {
      Accept: 'application/json, text/plain, */*',
      'X-Requested-With': 'XMLHttpRequest',
      Referer: url
    }
  }).then(response => ({ url: histUrl, response })).catch(error => ({ url: histUrl, response: null, error: error?.message || String(error) }))));

  let fallback = null;
  for (const attempt of attempts) {
    const raw = attempt.response?.json;
    if (raw && fallback == null) fallback = attempt;
    const normalized = normalizeFiiHistoricalIndicatorsApi(raw || {});
    if ((normalized?.rows || []).length || Object.keys(normalized?.tablesByPeriod || {}).length) {
      return {
        raw,
        resolvedFiiId,
        status: {
          status: attempt.response?.status || 0,
          cacheStatus: attempt.response?.cacheStatus,
          error: attempt.response?.error || (attempt.response?.parseError ? 'parse-error' : ''),
          url: attempt.url,
          attempts: attempts.map(item => ({ url: item.url, status: item.response?.status || 0, ok: Boolean(item.response?.json) }))
        }
      };
    }
  }
  const selected = fallback || attempts[0];
  return {
    raw: selected?.response?.json || null,
    resolvedFiiId,
    status: {
      status: selected?.response?.status || 0,
      cacheStatus: selected?.response?.cacheStatus || 'EMPTY',
      error: selected?.error || selected?.response?.error || 'historical_indicators_empty',
      url: selected?.url || '',
      attempts: attempts.map(item => ({ url: item.url, status: item.response?.status || 0, ok: Boolean(item.response?.json) }))
    }
  };
}
async function fetchFiiVacancyRaw({ ids = {}, url = '', timeoutMs = 6500 } = {}) {
  if (!ids?.fiiId) return { raw: null, status: { status: 0, cacheStatus: '', error: '', skipped: true } };
  const vacancyCandidates = [
    `https://investidor10.com.br/api/fii/vacancia-chart/${ids.fiiId}/12`,
    `https://investidor10.com.br/api/fii/taxa-vacancia-chart/${ids.fiiId}/12`,
    `https://investidor10.com.br/api/fii/historico-vacancia/${ids.fiiId}/12`,
    `https://investidor10.com.br/api/fii/vacancia/${ids.fiiId}/12`,
    `https://investidor10.com.br/api/fii/historico-taxa-vacancia/${ids.fiiId}/12`
  ];
  const responses = await Promise.all(vacancyCandidates.map(async vacancyUrl => {
    const vacancyResponse = await fetchJson(vacancyUrl, {
      timeoutMs: Math.min(3600, Math.max(1600, Number(timeoutMs) || 3600)),
      ttlMs: 15 * 60 * 1000,
      staleMs: 24 * 60 * 60 * 1000,
      retries: 0,
      headers: {
        Accept: 'application/json, text/plain, */*',
        'X-Requested-With': 'XMLHttpRequest',
        Referer: url
      }
    }).catch(error => ({ json: null, status: 0, cacheStatus: 'ERROR', error: error?.message || String(error) }));
    const candidateRows = collectFiiVacancyApiPoints(vacancyResponse?.json, '12m');
    return {
      raw: vacancyResponse?.json,
      rows: candidateRows.length,
      status: {
        status: vacancyResponse?.status || 0,
        cacheStatus: vacancyResponse?.cacheStatus,
        error: vacancyResponse?.error || (vacancyResponse?.parseError ? 'parse-error' : ''),
        url: vacancyUrl,
        strategy: 'parallel_v300'
      }
    };
  }));
  const best = responses.find(item => item.rows >= 2) || responses.find(item => item.status.status && item.status.status < 500) || responses[0];
  return { raw: best?.raw || null, status: best?.status || { status: 0, cacheStatus: '', error: '' } };
}

async function fetchFiiAnnouncementsBundle({ ticker = '', html = '', timeoutMs = 6500 } = {}) {
  const mainAnnouncements = html ? extractInvestidor10FiiAnnouncements(html, ticker) : emptyFiiAnnouncements(ticker, { reason: 'no_html' });
  const directAnnouncements = await fetchInvestidor10FiiAnnouncementsPages(ticker, { timeoutMs, maxPages: 3 });
  return enrichInvestidor10FiiAnnouncementPdfLinks(mergeFiiAnnouncementsPayloads(mainAnnouncements, directAnnouncements), { timeoutMs });
}

async function fetchInvestidor10FiiBundle(ticker, timeoutMs = 6500, options = {}) {
  const url = `https://investidor10.com.br/fiis/${ticker.toLowerCase()}/`;
  const fastMode = String(options.mode || options.stage || '').toLowerCase() === 'fast';
  const recoveryTarget = fiiSectionRecoveryTargets(options);
  const targetedRecovery = !fastMode && recoveryTarget.targeted;
  // O fast pode ser o primeiro assinante da captura coalescida usada também pelo full.
  // Mantemos orçamento de fonte suficiente e deixamos o deadline curto da rota fast
  // devolver o payload inicial sem encurtar a tentativa completa que está em paralelo.
  const sourceTimeoutMs = fastMode ? Math.max(Number(timeoutMs) || 0, 6500) : timeoutMs;
  const response = await fetchText(url, {
    timeoutMs: sourceTimeoutMs,
    ttlMs: 10 * 60_000,
    staleMs: 8 * 60 * 60 * 1000,
    retries: 1,
    headers: { Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' }
  });
  const rawHtml = response?.text || '';
  const identityOk = rawHtml ? fiiTickerIdentityOk(rawHtml, response?.finalUrl || url, ticker) : false;
  const identityDiagnostics = rawHtml
    ? fiiPageIdentityDiagnostics(rawHtml, response?.finalUrl || url, ticker)
    : { requestedTicker: String(ticker || '').toUpperCase(), finalUrl: response?.finalUrl || url, symbolFoundInPageHead: false, urlMatchesTicker: false };
  const html = identityOk ? rawHtml : '';
  const info = html ? extractInvestidor10FiiInformation(html, ticker) : { items: [], sections: [], diagnostics: { found: false } };
  const quickMetrics = html ? extractInvestidor10FiiQuickMetrics(html, ticker) : {};
  const rawChecklist = html ? extractInvestidor10FiiBuyHoldChecklist(html, ticker) : emptyFiiBuyHoldChecklist(ticker, { reason: 'no_html' });
  const aboutFund = html ? extractInvestidor10FiiAbout(html, ticker, info.items || [], quickMetrics) : emptyFiiAboutFund(ticker, { reason: 'no_html' });
  const propertyPortfolio = html ? extractInvestidor10FiiPropertyPortfolio(html, ticker) : emptyFiiPropertyPortfolio(ticker, { reason: 'no_html' });
  let peerComparison = html ? extractInvestidor10FiiPeerComparison(html, ticker, quickMetrics) : extractInvestidor10FiiPeerComparison('', ticker, quickMetrics);
  // O fundo de referência pode ser enriquecido imediatamente com a própria página já carregada.
  peerComparison = await enrichFiiPeerComparisonPatrimonialValues(peerComparison, {
    referenceTicker: ticker,
    referenceHtml: html,
    timeoutMs,
    maxRemoteRows: 0
  });
  const htmlIds = html ? extractInvestidor10ChartIds(html) : {};
  const resolvedFiiId = fastMode ? String(htmlIds?.fiiId || '') : await resolveInvestidor10FiiId({ ticker, html, timeoutMs }).catch(() => String(htmlIds?.fiiId || ''));
  const ids = { ...htmlIds, fiiId: resolvedFiiId || htmlIds?.fiiId || '' };
  const wantsHistorical = !targetedRecovery || recoveryTarget.sections.has('historicalIndicators');
  const wantsPeerComparison = !targetedRecovery || recoveryTarget.sections.has('peerComparison');
  const [historicalFetch, vacancyFetch, announcementsFetch, enrichedPeerComparison] = fastMode
    ? [
      { raw: null, status: { status: 204, cacheStatus: 'DEFERRED', stage: 'fast', deferred: true } },
      { raw: null, status: { status: 204, cacheStatus: 'DEFERRED', stage: 'fast', deferred: true } },
      emptyFiiAnnouncements(ticker, { reason: 'fast_stage_deferred' }),
      peerComparison
    ]
    : await Promise.all([
      wantsHistorical
        ? fetchFiiHistoricalIndicatorsRaw({ ids, ticker, html, url, timeoutMs }).catch(error => ({ raw: null, status: { status: 0, cacheStatus: 'ERROR', error: error?.message || String(error) } }))
        : Promise.resolve({ raw: null, status: { status: 204, cacheStatus: 'SKIPPED', skipped: true, reason: 'section_not_requested' } }),
      targetedRecovery && !recoveryTarget.sections.has('vacancyHistory')
        ? Promise.resolve({ raw: null, status: { status: 204, cacheStatus: 'SKIPPED', skipped: true, reason: 'section_recovery_not_requested' } })
        : fetchFiiVacancyRaw({ ids, url, timeoutMs }).catch(error => ({ raw: null, status: { status: 0, cacheStatus: 'ERROR', error: error?.message || String(error) } })),
      targetedRecovery && !recoveryTarget.sections.has('announcements')
        ? Promise.resolve(emptyFiiAnnouncements(ticker, { reason: 'section_recovery_not_requested' }))
        : fetchFiiAnnouncementsBundle({ ticker, html, timeoutMs }).catch(error => emptyFiiAnnouncements(ticker, { reason: 'announcements_parallel_fetch_failed', error: error?.message || String(error) })),
      wantsPeerComparison
        ? enrichFiiPeerComparisonPatrimonialValues(peerComparison, { referenceTicker: ticker, referenceHtml: html, timeoutMs, maxRemoteRows: 8, concurrency: 4 })
          .catch(error => ({ ...peerComparison, diagnostics: { ...(peerComparison?.diagnostics || {}), patrimonialEnrichment: { error: error?.message || String(error), policy: 'no_inference_no_mock' } } }))
        : Promise.resolve(peerComparison)
    ]);
  peerComparison = enrichedPeerComparison || peerComparison;
  const historicalRaw = historicalFetch.raw;
  const historicalStatus = historicalFetch.status;
  const vacancyRaw = vacancyFetch.raw;
  const vacancyStatus = vacancyFetch.status;
  const canonical = buildInvestidor10CanonicalCharts({
    ticker,
    type: 'FII',
    html,
    apiExtras: { historicoIndicadoresFii: historicalRaw, rawJson: { historicoIndicadoresFii: historicalRaw, vacancyHistory: vacancyRaw }, apiStatus: [] }
  });
  const historicalIndicators = normalizeFiiHistoricalIndicatorsApi(historicalRaw || canonical?.fii?.fundamentalIndicatorHistory || {});
  const distributions12m = buildFiiDistributions12mPayload({ canonical, html, ticker });
  const dividendCharts = buildFiiDividendChartsPayload({
    canonical,
    html,
    ticker,
    quickMetrics,
    distributions12m,
    referencePrice: finiteNumberOrNull(quickMetrics?.price)
  });
  const vacancyHistory = buildFiiVacancyHistoryPayload({ html, ticker, raw: vacancyRaw || canonical?.fii?.vacancyHistory || canonical?.vacancyHistory, historicalIndicators, quickMetrics });
  const patrimonialInfo = buildFiiPatrimonialInfoPayload({ html, ticker, quickMetrics, infoItems: info.items || [], canonical, peerComparison });
  const checklist = ensureFiiBuyHoldChecklist({ checklist: rawChecklist, ticker, html, quickMetrics, infoItems: info.items || [], propertyPortfolio, vacancyHistory, patrimonialInfo, dividendCharts });
  const announcements = announcementsFetch;
  return {
    ok: Boolean(html),
    url: response?.finalUrl || url,
    status: response?.status || 0,
    cacheStatus: response?.cacheStatus,
    error: identityOk ? response?.error : (rawHtml ? 'fii_ticker_identity_mismatch' : response?.error),
    identityOk,
    identityDiagnostics,
    html,
    ids,
    quickMetrics,
    peerComparison,
    checklist,
    aboutFund,
    propertyPortfolio,
    returnsRows: returnsRowsFromInvestidor10(canonical),
    distributions12m,
    vacancyHistory,
    patrimonialInfo,
    announcements,
    dividendCharts,
    canonical,
    html,
    historicalIndicators,
    historicalStatus,
    vacancyStatus,
    ...info,
    recoveryDiagnostics: { targetedRecovery, requestedSections: [...recoveryTarget.sections], resolvedFiiId: ids.fiiId || '' }
  };
}

function formatCurrency(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 'Atualizando';
  return `R$ ${n.toFixed(2).replace('.', ',')}`;
}

function formatPercent(value, signed = false) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  const sign = signed && n > 0 ? '+' : '';
  return `${sign}${n.toFixed(2).replace('.', ',')}%`;
}

function formatCompactMoney(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return '—';
  if (n >= 1_000_000_000) return `R$ ${(n / 1_000_000_000).toFixed(2).replace('.', ',')} bi`;
  if (n >= 1_000_000) return `R$ ${(n / 1_000_000).toFixed(2).replace('.', ',')} mi`;
  if (n >= 1_000) return `R$ ${(n / 1_000).toFixed(2).replace('.', ',')} mil`;
  return `R$ ${Math.round(n).toLocaleString('pt-BR')}`;
}

function chartPointFromYahoo(point, index = 0) {
  const close = Number(point?.close ?? point?.price ?? point?.value);
  if (!Number.isFinite(close) || close <= 0) return null;
  const iso = String(point?.date || point?.timestamp || point?.time || '');
  const time = Date.parse(iso);
  return {
    date: Number.isFinite(time) ? new Date(time).toISOString().slice(0, 10) : iso.slice(0, 10),
    timestamp: Number.isFinite(time) ? Math.floor(time / 1000) : index,
    close: round(close, 4),
    value: round(close, 4)
  };
}

function performanceFromHistory(history) {
  const points = Array.isArray(history?.points) ? history.points.map(chartPointFromYahoo).filter(Boolean) : [];
  if (points.length < 2) return null;
  const first = Number(points[0].close);
  const last = Number(points.at(-1).close);
  if (!Number.isFinite(first) || !Number.isFinite(last) || first <= 0 || last <= 0) return null;
  return round(((last / first) - 1) * 100, 4);
}

function accumulatedIpcaPercent(ipcaPoints = [], months = 12) {
  const clean = Array.isArray(ipcaPoints) ? ipcaPoints.filter(p => Number.isFinite(Number(p?.monthlyPercent))).slice(-months) : [];
  if (!clean.length) return null;
  let factor = 1;
  for (const point of clean) factor *= (1 + Number(point.monthlyPercent) / 100);
  return round((factor - 1) * 100, 4);
}

function realReturnPercent(returnPercent, inflationPercent) {
  const r = Number(returnPercent);
  const i = Number(inflationPercent);
  if (!Number.isFinite(r) || !Number.isFinite(i)) return null;
  return round((((1 + r / 100) / (1 + i / 100)) - 1) * 100, 4);
}

function chartSummary(points = []) {
  if (!points.length) return { points: 0 };
  const values = points.map(p => Number(p.close)).filter(Number.isFinite);
  const first = values[0];
  const last = values.at(-1);
  return {
    points: points.length,
    firstClose: round(first, 4),
    lastClose: round(last, 4),
    min: round(Math.min(...values), 4),
    max: round(Math.max(...values), 4),
    variationPercent: first > 0 ? round(((last / first) - 1) * 100, 4) : null
  };
}

function firstHistoricalIndicatorValue(history, labelCandidates = []) {
  const labels = labelCandidates.map(label => String(label || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase());
  const rows = Array.isArray(history?.rows) ? history.rows : [];
  const row = rows.find(item => {
    const label = String(item?.label || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    return labels.some(candidate => label === candidate || label.includes(candidate));
  });
  if (!row || !row.values || typeof row.values !== 'object') return '';
  const columns = Array.isArray(history?.columns) && history.columns.length ? history.columns : Object.keys(row.values);
  const preferred = ['Atual', 'ATUAL', 'Último', 'Ultimo', ...columns];
  for (const key of preferred) {
    const value = row.values[key];
    if (value !== undefined && value !== null && String(value).trim()) return cleanInvestidor10InfoValue(value);
  }
  return '';
}

function formattedYahooPriceFromHistory(history, chartPoints = []) {
  const price = Number(history?.regularMarketPrice || chartPoints.at(-1)?.close);
  return Number.isFinite(price) && price > 0 ? `R$ ${price.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '';
}

function yahooChangeFromHistory(history, chartPoints = []) {
  const last = Number(history?.regularMarketPrice || chartPoints.at(-1)?.close);
  const previous = Number(history?.previousClose || chartPoints.at(-2)?.close);
  if (!Number.isFinite(last) || !Number.isFinite(previous) || previous <= 0) return { value: null, display: '' };
  const value = round(((last / previous) - 1) * 100, 4);
  return { value, display: formatPercent(value, true) };
}

function comparisonPoint({ date, timestamp, close = null, returnPercent = 0, source = '' } = {}) {
  const safeReturn = Number(returnPercent);
  const safeTimestamp = Number(timestamp);
  const normalizedDate = String(date || (Number.isFinite(safeTimestamp) ? new Date(safeTimestamp * 1000).toISOString().slice(0, 10) : '') || '').slice(0, 10);
  const out = {
    date: normalizedDate,
    timestamp: Number.isFinite(safeTimestamp) ? Math.floor(safeTimestamp) : Math.floor(new Date(`${normalizedDate || '1970-01-01'}T00:00:00.000Z`).getTime() / 1000),
    value: round(safeReturn, 4),
    returnPercent: round(safeReturn, 4),
    investedValue: round(FII_COMPARISON_BASE_INVESTMENT * (1 + safeReturn / 100), 2)
  };
  const safeClose = Number(close);
  if (Number.isFinite(safeClose) && safeClose > 0) out.close = round(safeClose, 4);
  if (source) out.source = source;
  return out;
}

function normalizeComparisonPoints(history = {}) {
  const points = Array.isArray(history?.points) ? history.points.map(chartPointFromYahoo).filter(Boolean) : [];
  if (points.length < 2) return [];
  const first = Number(points[0].close);
  if (!Number.isFinite(first) || first <= 0) return [];
  return points.map(point => {
    const close = Number(point.close);
    const returnPercent = round(((close / first) - 1) * 100, 4);
    return comparisonPoint({ date: point.date, timestamp: point.timestamp, close, returnPercent, source: history?.source || '' });
  });
}

function monthStartTimestamp(month = '') {
  const clean = String(month || '').slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(clean)) return 0;
  return Math.floor(new Date(`${clean}-01T00:00:00.000Z`).getTime() / 1000);
}

function normalizeAccumulatedBenchmarkPoints(rows = [], period = {}, source = '') {
  const safeMonths = Math.max(2, Number(period.months || 24));
  const clean = (Array.isArray(rows) ? rows : [])
    .map(row => {
      const month = String(row.month || row.date || '').slice(0, 7);
      const accumulatedPercent = Number(row.accumulatedPercent ?? row.returnPercent ?? row.valuePercent ?? row.value);
      const monthlyPercent = Number(row.monthlyPercent ?? row.monthReturnPercent ?? row.value);
      return { month, accumulatedPercent, monthlyPercent, source: row.source || source };
    })
    .filter(row => /^\d{4}-\d{2}$/.test(row.month) && Number.isFinite(row.accumulatedPercent))
    .sort((a, b) => a.month.localeCompare(b.month))
    .slice(-safeMonths);
  if (clean.length < 2) return [];
  const baseFactor = 1 + Number(clean[0].accumulatedPercent || 0) / 100;
  if (!Number.isFinite(baseFactor) || baseFactor <= 0) return [];
  return clean.map(row => {
    const factor = 1 + Number(row.accumulatedPercent || 0) / 100;
    const returnPercent = ((factor / baseFactor) - 1) * 100;
    return comparisonPoint({
      date: `${row.month}-01`,
      timestamp: monthStartTimestamp(row.month),
      returnPercent,
      source: row.source || source
    });
  });
}

function comparisonItemFromSeries(series, periodKey) {
  const first = series?.points?.[0];
  const last = series?.points?.at?.(-1);
  if (!first || !last) return null;
  const returnPercent = Number(last.returnPercent ?? last.value);
  const investedValue = Number(last.investedValue ?? (Number.isFinite(returnPercent) ? FII_COMPARISON_BASE_INVESTMENT * (1 + returnPercent / 100) : NaN));
  return {
    id: series.id,
    code: series.code,
    label: series.label,
    periodKey,
    returnPercent: Number.isFinite(returnPercent) ? round(returnPercent, 4) : null,
    returnDisplay: Number.isFinite(returnPercent) ? formatPercent(returnPercent, true) : '—',
    investedValue: Number.isFinite(investedValue) ? round(investedValue, 2) : null,
    investedValueDisplay: Number.isFinite(investedValue) ? `R$ ${Number(investedValue).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—',
    source: series.source,
    selectorEnabled: true
  };
}

function comparisonItemsForSelectableSeries(series = [], periodKey = '') {
  const items = (Array.isArray(series) ? series : [])
    .map(item => comparisonItemFromSeries(item, periodKey))
    .filter(Boolean);
  const seen = new Set();
  return items.filter(item => {
    const key = String(item.code || item.id || '').toUpperCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function indexQuoteFromYahooQuote(benchmark, quote) {
  const price = Number(quote?.price ?? quote?.regularMarketPrice);
  const variation = Number(quote?.variationPct ?? quote?.changePercent);
  return {
    id: benchmark.key,
    code: benchmark.code,
    label: benchmark.label,
    yahooSymbol: benchmark.yahooSymbol,
    value: Number.isFinite(price) ? round(price, 4) : null,
    valueDisplay: Number.isFinite(price) ? price.toLocaleString('pt-BR', { maximumFractionDigits: 0 }) : '—',
    variationPercent: Number.isFinite(variation) ? round(variation, 4) : null,
    variationDisplay: Number.isFinite(variation) ? formatPercent(variation, true) : '—',
    source: 'Yahoo Finance Chart API',
    endpoint: `GET https://query1.finance.yahoo.com/v8/finance/chart/${benchmark.yahooSymbol}?range=1d&interval=1d&includePrePost=false`,
    ok: Boolean(quote?.ok) && Number.isFinite(price)
  };
}

function comparisonFetchPlans(period) {
  const primary = { range: period.range, interval: period.interval, fallback: false };
  const alternates = [];
  // O Yahoo costuma aceitar combinações diferentes por símbolo. Mantemos a mesma
  // janela do seletor (2Y/5Y/10Y), mas testamos granularidades alternativas antes
  // de declarar a série vazia. Isso evita que IFIX, SMLL, IDIV e CDI apareçam
  // apenas como cards/snapshots, sem linha nem simulação de R$ 1.000,00.
  if (period.key === '2y') alternates.push(
    { range: period.range, interval: '1mo', fallback: true },
    { range: period.range, interval: '1wk', fallback: true },
    { range: period.range, interval: '1d', fallback: true }
  );
  if (period.key === '5y') alternates.push(
    { range: period.range, interval: '1mo', fallback: true },
    { range: period.range, interval: '1wk', fallback: true },
    { range: period.range, interval: '1d', fallback: true }
  );
  if (period.key === '10y') alternates.push(
    { range: period.range, interval: '1mo', fallback: true },
    { range: period.range, interval: '1wk', fallback: true },
    { range: period.range, interval: '1d', fallback: true }
  );
  const seen = new Set();
  return [primary, ...alternates].filter(plan => {
    const key = `${plan.range}|${plan.interval}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}


function comparisonHistoryRangeForPeriod(period = {}) {
  const months = Number(period.months || 24);
  if (months <= 12) return '1Y';
  if (months <= 60) return '5Y';
  return 'MAX';
}

function pointDateMillis(point = {}) {
  const raw = point.date || point.time || point.timestamp || point.month || '';
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw > 10_000_000_000 ? raw : raw * 1000;
  const text = String(raw || '').trim();
  if (!text) return 0;
  if (/^\d{4}-\d{2}$/.test(text)) return Date.parse(`${text}-01T00:00:00.000Z`);
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return Date.parse(`${text}T00:00:00.000Z`);
  const parsed = Date.parse(text);
  if (Number.isFinite(parsed)) return parsed;
  const numeric = Number(text);
  if (Number.isFinite(numeric) && numeric > 0) return numeric > 10_000_000_000 ? numeric : numeric * 1000;
  return 0;
}

function historyPointClose(point = {}) {
  const value = Number(point.close ?? point.price ?? point.value ?? point.adjClose ?? point.lastPrice);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function normalizeReturnPageHistoryPoints(history = {}, period = {}, source = '') {
  const rows = history.points || history.history || history.series || history.prices || history.chartHistory || [];
  const clean = (Array.isArray(rows) ? rows : [])
    .map((point, index) => {
      const millis = pointDateMillis(point);
      const close = historyPointClose(point);
      if (!millis || !close) return null;
      const date = new Date(millis).toISOString().slice(0, 10);
      return { date, timestamp: Math.floor(millis / 1000), close, source: point.source || source || history.source || '', index };
    })
    .filter(Boolean)
    .sort((a, b) => a.timestamp - b.timestamp || a.index - b.index);
  if (clean.length < 2) return [];
  const last = clean.at(-1);
  const months = Number(period.months || 24);
  const cutoffDate = new Date(last.timestamp * 1000);
  cutoffDate.setUTCMonth(cutoffDate.getUTCMonth() - Math.max(1, months));
  const cutoff = Math.floor(cutoffDate.getTime() / 1000);
  let sliced = clean.filter(point => point.timestamp >= cutoff);
  if (sliced.length < 2) sliced = clean.slice(-Math.min(clean.length, Math.max(2, months + 1)));
  if (sliced.length < 2) return [];
  const firstClose = Number(sliced[0].close);
  if (!Number.isFinite(firstClose) || firstClose <= 0) return [];
  return sliced.map(point => {
    const returnPercent = ((Number(point.close) / firstClose) - 1) * 100;
    return comparisonPoint({
      date: point.date,
      timestamp: point.timestamp,
      close: point.close,
      returnPercent,
      source: point.source || history.source || source || ''
    });
  });
}

async function fetchOfficialReturnIndexComparisonHistory(item, period, timeoutMs) {
  const range = comparisonHistoryRangeForPeriod(period);
  const history = await getAssetHistory({
    ticker: item.code,
    range,
    timeoutMs,
    limit: period.key === '10y' ? 260 : 520,
    bypassCache: false
  }).catch(error => ({ status: 'ERROR', ok: false, points: [], error: error?.message || String(error) }));
  const integrity = inspectRealHistoryIntegrity(history);
  const points = integrity.trusted ? normalizeReturnPageHistoryPoints(history, period, history?.source || item.sourceLabel) : [];
  if (points.length >= 2) {
    return {
      history,
      integrity,
      points,
      plan: { range, interval: history?.yahooInterval || history?.interval || (range === 'MAX' ? '1mo' : '1wk'), returnPageReuse: true },
      ok: true,
      symbolUsed: history?.yahooSymbol || item.yahooSymbol || item.ticker,
      reusedReturnProxy: true
    };
  }
  return {
    ok: false,
    points: [],
    error: integrity.trusted
      ? (history?.error || history?.warning || `${item.code} sem pontos suficientes no mesmo provedor do Retorno`)
      : `Série rejeitada pelo gate de integridade: ${integrity.reasons.join(', ')}`,
    history,
    integrity
  };
}

function fixedFiiIndexSelectorOptions(ticker = '') {
  return [
    { code: 'IFIX', label: 'IFIX', required: true },
    { code: 'CDI', label: 'CDI', required: true },
    { code: 'IPCA', label: 'IPCA', required: true },
    { code: 'IBOV', label: 'IBOV', required: true },
    { code: 'SMLL', label: 'SMLL', required: true },
    { code: 'IDIV', label: 'IDIV', required: true },
    { code: 'IVVB11', label: 'IVVB11', required: true }
  ].map(item => ({ ...item, id: item.code.toLowerCase(), assetCode: ticker }));
}

async function fetchComparisonSeriesHistory(item, period, timeoutMs, macroSeries = {}) {
  if (item.kind === 'bcb_cdi') {
    const points = normalizeAccumulatedBenchmarkPoints(macroSeries.cdi?.points || macroSeries.cdi?.series || [], period, macroSeries.cdi?.source || item.sourceLabel);
    return points.length >= 2
      ? { history: { source: macroSeries.cdi?.source || item.sourceLabel, symbol: 'CDI', interval: '1mo' }, points, plan: { range: `${period.months}M`, interval: '1mo' }, ok: true }
      : { ok: false, points: [], error: macroSeries.cdi?.error || 'CDI Banco Central sem pontos suficientes' };
  }
  if (item.kind === 'bcb_ipca') {
    const points = normalizeAccumulatedBenchmarkPoints(macroSeries.ipca?.points || macroSeries.ipca?.series || [], period, macroSeries.ipca?.source || item.sourceLabel);
    return points.length >= 2
      ? { history: { source: macroSeries.ipca?.source || item.sourceLabel, symbol: 'IPCA', interval: '1mo' }, points, plan: { range: `${period.months}M`, interval: '1mo' }, ok: true }
      : { ok: false, points: [], error: macroSeries.ipca?.error || 'IPCA Banco Central sem pontos suficientes' };
  }

  if (item.kind === 'official_return_index') {
    const official = await fetchOfficialReturnIndexComparisonHistory(item, period, timeoutMs);
    if (official.ok && official.points?.length >= 2) return official;
    // Segunda tentativa direta no Yahoo quando a rota interna não entrega a série,
    // mas a prioridade passa a ser o mesmo provedor/normalizador usado na página Retorno.
  }

  const symbols = [item.yahooSymbol, ...(Array.isArray(item.yahooSymbols) ? item.yahooSymbols : []), item.ticker]
    .filter(Boolean)
    .map(value => String(value).trim())
    .filter(Boolean);
  const uniqueSymbols = [...new Set(symbols)];
  const plans = comparisonFetchPlans(period);
  let lastError = '';
  for (const symbol of uniqueSymbols) {
    for (const plan of plans) {
      const history = await fetchYahooHistory(symbol, {
        range: plan.range,
        interval: plan.interval,
        timeoutMs,
        limit: period.key === '10y' ? 260 : 520,
        cache: true
      });
      const points = normalizeComparisonPoints(history);
      if (points.length >= 2) {
        return { history, points, plan, ok: true, symbolUsed: history?.symbol || symbol };
      }
      lastError = history?.error || history?.warning || `sem pontos suficientes em ${symbol} ${plan.range}/${plan.interval}`;
    }
  }
  return { ok: false, points: [], error: lastError || 'Yahoo sem histórico suficiente' };
}

function macroQuoteFromSeries(benchmark, macro, periodItem = null) {
  const rows = macro?.points || macro?.series || [];
  const last = Array.isArray(rows) ? rows.at(-1) : null;
  const latestMonthly = Number(last?.monthlyPercent ?? last?.value);
  const accumulated = Number(periodItem?.returnPercent ?? last?.accumulatedPercent);
  return {
    id: benchmark.key,
    code: benchmark.code,
    label: benchmark.label,
    yahooSymbol: null,
    value: Number.isFinite(accumulated) ? round(accumulated, 4) : null,
    valueDisplay: Number.isFinite(accumulated) ? formatPercent(accumulated, true) : '—',
    variationPercent: Number.isFinite(latestMonthly) ? round(latestMonthly, 4) : null,
    variationDisplay: Number.isFinite(latestMonthly) ? `${formatPercent(latestMonthly, true)} mês` : (macro?.status || 'BCB'),
    source: macro?.source || benchmark.sourceLabel,
    endpoint: benchmark.code === 'CDI' ? 'BancoCentralSGS séries 12/4391' : 'BancoCentralSGS série 433',
    ok: Array.isArray(rows) && rows.length > 0
  };
}

function comparisonQuoteFromItem(item, fallbackBenchmark = {}) {
  return {
    id: item.id || fallbackBenchmark.key || String(item.code || '').toLowerCase(),
    code: item.code || fallbackBenchmark.code || '',
    label: item.label || fallbackBenchmark.label || item.code || '',
    yahooSymbol: fallbackBenchmark.yahooSymbol || null,
    value: Number.isFinite(Number(item.investedValue)) ? round(Number(item.investedValue), 2) : null,
    valueDisplay: item.investedValueDisplay || '—',
    variationPercent: Number.isFinite(Number(item.returnPercent)) ? round(Number(item.returnPercent), 4) : null,
    variationDisplay: item.returnDisplay || '—',
    source: item.source || fallbackBenchmark.sourceLabel || '',
    ok: Number.isFinite(Number(item.returnPercent))
  };
}

async function buildFiiYahooIndexComparison(ticker, timeoutMs = 8500) {
  const perCallTimeout = Math.min(7800, Math.max(4800, Math.floor(timeoutMs * 0.9)));
  const diagnostics = [];
  const yahooQuoteBenchmarks = [
    { key: 'asset', code: ticker, label: ticker, ticker, yahooSymbol: `${ticker}.SA` },
    ...FII_INDEX_BENCHMARKS.filter(item => item.yahooSymbol)
  ];
  const quoteSettledPromise = Promise.allSettled(yahooQuoteBenchmarks.map(item => fetchYahooQuote(item.yahooSymbol, { timeoutMs: Math.min(4200, perCallTimeout), interval: '1d' })));
  const macroMonths = Math.max(...FII_COMPARISON_PERIODS.map(period => Number(period.months || 24)));
  const [cdiSeries, ipcaSeries] = await Promise.all([
    getCdiAccumulatedSeries(macroMonths, Math.min(5200, perCallTimeout)).catch(error => ({ status: 'ERROR', points: [], error: error?.message || String(error), source: 'BancoCentralSGS CDI' })),
    getIpcaSeries(macroMonths).catch(error => ({ status: 'ERROR', points: [], error: error?.message || String(error), source: 'BancoCentralSGS IPCA' }))
  ]);
  const macroSeries = { cdi: cdiSeries, ipca: ipcaSeries };
  diagnostics.push({ provider: 'CDI', status: cdiSeries.status || (cdiSeries.points?.length ? 'OK' : 'EMPTY'), count: cdiSeries.points?.length || 0, source: cdiSeries.source, error: cdiSeries.error });
  diagnostics.push({ provider: 'IPCA', status: ipcaSeries.status || (ipcaSeries.points?.length ? 'OK' : 'EMPTY'), count: ipcaSeries.points?.length || 0, source: ipcaSeries.source, error: ipcaSeries.error });

  const periodEntries = await Promise.all(FII_COMPARISON_PERIODS.map(async period => {
    const tickers = [
      { key: 'asset', code: ticker, label: ticker, ticker, yahooSymbol: `${ticker}.SA`, kind: 'yahoo_asset', sourceLabel: 'Yahoo Finance Chart API ativo' },
      ...FII_INDEX_BENCHMARKS
    ];
    const histories = await Promise.allSettled(tickers.map(item => fetchComparisonSeriesHistory(item, period, perCallTimeout, macroSeries)));
    const series = histories.map((result, index) => {
      const item = tickers[index];
      if (result.status !== 'fulfilled' || !result.value?.ok) {
        diagnostics.push({
          period: period.key,
          code: item.code,
          yahooSymbol: item.yahooSymbol || item.ticker,
          status: 'EMPTY',
          reason: result.status === 'fulfilled' ? (result.value?.error || 'sem pontos suficientes') : (result.reason?.message || String(result.reason || 'erro'))
        });
        return null;
      }
      const value = result.value;
      return {
        id: item.key || item.code.toLowerCase(),
        code: item.code,
        ticker: item.ticker,
        label: item.label,
        periodKey: period.key,
        points: value.points,
        source: value.reusedReturnProxy
          ? `${value.history?.source || item.sourceLabel || 'Retorno/Proxy'} · mesmo provedor da página Retorno`
          : `${item.sourceLabel || value.history?.source || 'Yahoo Finance Chart API'}${value.symbolUsed && value.symbolUsed !== item.yahooSymbol ? ` · símbolo alternativo ${value.symbolUsed}` : ''}${value.plan?.fallback ? '' : ''}`,
        yahooSymbol: value.symbolUsed || value.history?.yahooSymbol || value.history?.symbol || item.yahooSymbol || `${item.ticker}.SA`,
        endpoint: item.kind?.startsWith('bcb_')
          ? (value.history?.source || item.sourceLabel)
          : value.reusedReturnProxy
            ? `Retorno/Proxy getAssetHistory(${item.code}, ${value.plan?.range || period.range})`
            : `GET https://query1.finance.yahoo.com/v8/finance/chart/${value.symbolUsed || item.yahooSymbol || item.ticker}?range=${String(value.history?.yahooRange || value.plan?.range || period.range).toLowerCase()}&interval=${value.history?.interval || value.plan?.interval || period.interval}&includePrePost=false`
      };
    }).filter(Boolean);
    const alignedSeries = alignComparisonSeriesToSharedWindow(series);
    return [period.key, { ...period, status: alignedSeries.length >= 2 ? 'OK' : (alignedSeries.length ? 'PARTIAL' : 'EMPTY'), series: alignedSeries, items: comparisonItemsForSelectableSeries(alignedSeries, period.key) }];
  }));

  const seriesByPeriod = Object.fromEntries(periodEntries);
  const defaultPeriod = seriesByPeriod['2y']?.series?.length >= 2 ? '2y' : (Object.keys(seriesByPeriod).find(key => seriesByPeriod[key]?.series?.length >= 2) || '2y');
  const active = seriesByPeriod[defaultPeriod] || { series: [], items: [] };

  const quoteSettled = await quoteSettledPromise;
  const yahooQuotes = yahooQuoteBenchmarks.map((item, index) => {
    const quote = quoteSettled[index].status === 'fulfilled' ? quoteSettled[index].value : {};
    if (quoteSettled[index].status !== 'fulfilled' || !quote?.ok) {
      diagnostics.push({ code: item.code, yahooSymbol: item.yahooSymbol, status: 'QUOTE_EMPTY', reason: quote?.error || quoteSettled[index].reason?.message || 'cotação indisponível' });
    }
    const yahooQuote = indexQuoteFromYahooQuote(item, quote);
    return yahooQuote.ok ? yahooQuote : null;
  }).filter(Boolean);
  const activeItemsByCode = new Map((active.items || []).map(item => [item.code, item]));
  const indexQuotes = [
    ...yahooQuotes,
    macroQuoteFromSeries(FII_INDEX_BENCHMARKS.find(item => item.code === 'CDI'), cdiSeries, activeItemsByCode.get('CDI')),
    macroQuoteFromSeries(FII_INDEX_BENCHMARKS.find(item => item.code === 'IPCA'), ipcaSeries, activeItemsByCode.get('IPCA'))
  ].filter(item => item && item.id).sort((a, b) => {
    const order = [ticker, 'IFIX', 'CDI', 'IPCA', 'IBOV', 'SMLL', 'IDIV', 'IVVB11'];
    return order.indexOf(a.code) - order.indexOf(b.code);
  });

  return {
    id: 'fii_asset_vs_indices_selector',
    title: `Comparação de ${ticker} com índices`,
    subtitle: 'Selecione os índices para desenhar as linhas no gráfico: IFIX, CDI, IPCA, IBOV, SMLL, IDIV e IVVB11.',
    status: active.series.length >= 2 ? 'OK' : (active.series.length ? 'PARTIAL' : (indexQuotes.some(item => item.ok) ? 'QUOTES_ONLY' : 'EMPTY')),
    defaultPeriod,
    baseInvestment: FII_COMPARISON_BASE_INVESTMENT,
    baseInvestmentDisplay: 'R$ 1.000,00',
    periods: FII_COMPARISON_PERIODS,
    seriesByPeriod,
    series: active.series,
    items: active.items,
    itemsByPeriod: Object.fromEntries(Object.entries(seriesByPeriod).map(([key, value]) => [key, value.items || []])),
    indexQuotes,
    selectorOptions: fixedFiiIndexSelectorOptions(ticker),
    diagnostics,
    source: 'Retorno/Proxy getAssetHistory + Yahoo Finance Chart API + Banco Central SGS',
    selectorPolicy: 'O ativo fica fixo no gráfico; cada benchmark possui seletor próprio para desenhar ou ocultar a linha.',
    defaultSelectedCodes: [ticker, 'IFIX', 'CDI', 'IPCA', 'IBOV', 'SMLL', 'IDIV', 'IVVB11'],
    sourcePolicy: 'Comparação alinhada à página Retorno: IFIX, SMLL, IDIV e IBOV usam séries históricas reais do getAssetHistory/Yahoo direto; snapshots isolados, curvas reconstruídas de snapshot, ticker substituto, mock e série simulada são rejeitados. CDI e IPCA usam Banco Central SGS. A projeção de R$ 1.000,00 é calculada somente a partir das séries reais ativas do período selecionado.'
  };
}


function normalizeFiiModalStage(payload = {}) {
  const raw = String(payload.stage || payload.mode || payload.priority || '').toLowerCase();
  if (raw.includes('fast') || raw.includes('initial') || raw.includes('essential')) return 'fast';
  return 'full';
}

function fiiStageTimeoutMs(payload = {}, fallback = 8500) {
  const stage = normalizeFiiModalStage(payload);
  const requested = Number(payload.timeoutMs || payload.modalTimeoutMs || payload.fundamentalTimeoutMs || fallback);
  const safe = Number.isFinite(requested) ? requested : fallback;
  return stage === 'fast'
    ? Math.min(4500, Math.max(2500, safe))
    : Math.min(12000, Math.max(3500, safe));
}

function deferredFiiIndexComparison(ticker = '') {
  return {
    id: 'fii_asset_vs_indices_selector',
    title: `Comparação de ${ticker} com índices`,
    status: 'DEFERRED',
    defaultPeriod: '1y',
    periods: FII_COMPARISON_PERIODS,
    series: [],
    items: [],
    seriesByPeriod: {},
    itemsByPeriod: {},
    indexQuotes: [],
    source: 'Carregado no stage full do modal de FII'
  };
}

async function buildFiiModalContractFresh(payload = {}) {
  const ticker = normalizeTicker(payload.ticker || payload.symbol || payload.q || payload.query);
  if (!ticker) {
    return { ok: false, status: 'ERROR', endpoint: 'asset/fii-modal', error: 'Informe ticker ou symbol do FII.' };
  }
  const assetClass = classifyTicker(ticker);
  const explicitFiiFamily = String(payload.resolvedFamily || payload.assetType || payload.assetClass || '').toLowerCase().includes('fii')
    || /FIAGRO|FI[-_\s]?INFRA/i.test(String(payload.assetType || payload.assetClass || ''));
  if (assetClass !== 'FII' && !explicitFiiFamily) {
    return {
      ok: true,
      status: 'NOT_FII',
      endpoint: 'asset/fii-modal',
      contract: 'FiiAssetModalResponse',
      contractVersion: FII_MODAL_VERSION,
      ticker,
      assetType: assetClass,
      sourcePolicy: 'StatusInvest, dados estáticos e dados de exemplo permanecem bloqueados no modal único.',
      message: 'Contrato atual carregou a camada de FIIs. Ações serão conectadas pelo mesmo padrão Investidor10-only na próxima etapa.'
    };
  }

  const stage = normalizeFiiModalStage(payload);
  const fastMode = stage === 'fast';
  const recoveryTarget = fiiSectionRecoveryTargets(payload);
  const timeoutMs = fiiStageTimeoutMs(payload, fastMode ? 3800 : 14500);
  const emptyFiiBundle = (reason, error = '') => ({
    ok: false,
    status: reason === 'fast_preview_source_warming' ? 202 : 0,
    cacheStatus: reason === 'fast_preview_source_warming' ? 'SOURCE_WARMING' : 'ERROR',
    items: [],
    sections: [],
    quickMetrics: {},
    peerComparison: { id: 'fii_peer_comparison', title: 'Comparando com outros FIIs', subtitle: 'Mesmo tipo e segmento', filterLabel: 'Mesmo tipo e segmento', source: 'Investidor10', status: 'EMPTY', columns: [], rows: [] },
    checklist: emptyFiiBuyHoldChecklist(ticker, { reason }),
    aboutFund: emptyFiiAboutFund(ticker, { reason }),
    propertyPortfolio: emptyFiiPropertyPortfolio(ticker, { reason }),
    vacancyHistory: emptyFiiVacancyHistory(ticker, { reason }),
    patrimonialInfo: emptyFiiPatrimonialInfo(ticker, { reason }),
    announcements: emptyFiiAnnouncements(ticker, { reason }),
    returnsRows: [],
    historicalIndicators: { columns: [], rows: [], tablesByPeriod: {}, status: fastMode ? 'DEFERRED' : 'EMPTY' },
    stage,
    deferred: fastMode,
    error,
    diagnostics: { found: false, reason }
  });
  const historyPromise = fetchYahooHistory(ticker, {
    range: fastMode ? '1M' : (payload.range || '1Y'),
    interval: payload.interval || '1d',
    timeoutMs: Math.min(fastMode ? 2400 : timeoutMs, timeoutMs),
    limit: Number(payload.limit || (fastMode ? 80 : 260))
  }).catch(error => ({ ok: false, points: [], error: error?.message || String(error), source: 'YahooChart' }));
  const fiiBundlePromise = fetchInvestidor10FiiBundle(
    ticker,
    Math.min(Number(payload.investidor10TimeoutMs || payload.fundamentalTimeoutMs || timeoutMs || 14500), fastMode ? 2600 : 14500),
    { ...payload, mode: stage, stage, requiredSections: [...recoveryTarget.sections] }
  ).catch(error => emptyFiiBundle('investidor10_fetch_failed', error?.message || String(error)));
  const yahooLogoPromise = fetchYahooLogo(ticker, { timeoutMs: Math.min(3800, Math.max(timeoutMs, 3800)), cache: true })
    .catch(error => ({ ok: false, logoUrl: '', error: error?.message || String(error), source: 'Yahoo Finance Quote API' }));
  const shouldFetchDividendYieldHistory = !fastMode
    && (!recoveryTarget.targeted || recoveryTarget.sections.has('dividendCharts'));
  const historicalDividendYieldPromise = shouldFetchDividendYieldHistory
    ? fetchYahooHistory(ticker, {
      range: '5Y',
      interval: '1mo',
      timeoutMs: Math.min(9000, timeoutMs),
      limit: 72
    }).catch(error => ({ ok: false, points: [], error: error?.message || String(error), source: 'YahooChart' }))
    : Promise.resolve({ ok: false, points: [], source: 'YahooChart', deferred: true });
  const historyTask = fastMode
    ? settleFastModalSource(historyPromise, 2600, { ok: false, points: [], source: 'YahooChart', stage: 'fast', deferred: true, error: 'fast_preview_deferred' })
    : historyPromise;
  const fiiBundleTask = fastMode
    ? settleFastModalSource(fiiBundlePromise, 2500, emptyFiiBundle('fast_preview_source_warming'))
    : fiiBundlePromise;
  const yahooLogoTask = fastMode
    ? settleFastModalSource(yahooLogoPromise, 2200, { ok: false, logoUrl: '', source: 'Yahoo Finance Quote API', stage: 'fast', deferred: true })
    : yahooLogoPromise;

  const [oneYearHistory, investidor10, comparison, yahooLogo, historicalDividendYield] = await Promise.all([
    historyTask,
    fiiBundleTask,
    fastMode || (recoveryTarget.targeted && !recoveryTarget.sections.has('indexComparison'))
      ? Promise.resolve(deferredFiiIndexComparison(ticker))
      : buildFiiYahooIndexComparison(ticker, timeoutMs)
        .catch(error => ({ id: 'fii_asset_vs_yahoo_indices', status: 'ERROR', error: error?.message || String(error), periods: FII_COMPARISON_PERIODS, seriesByPeriod: {}, series: [], items: [], indexQuotes: [] })),
    yahooLogoTask,
    historicalDividendYieldPromise
  ]);

  const chartPoints = (oneYearHistory?.points || []).map(chartPointFromYahoo).filter(Boolean);
  const quick = investidor10?.quickMetrics || {};
  const historical = investidor10?.historicalIndicators || {};
  const histDyDisplay = firstHistoricalIndicatorValue(historical, ['Dividend Yield']);
  const histPvpDisplay = firstHistoricalIndicatorValue(historical, ['P/VP']);
  const histLiquidityDisplay = firstHistoricalIndicatorValue(historical, ['Liquidez Diária']);
  const yahooPriceDisplay = formattedYahooPriceFromHistory(oneYearHistory, chartPoints);
  const yahooDayChange = yahooChangeFromHistory(oneYearHistory, chartPoints);
  const priceChartSummary = chartSummary(chartPoints);
  const rawYahooVariation12m = finiteNumberOrNull(priceChartSummary?.variationPercent);
  const yahooVariation12m = rawYahooVariation12m === null ? null : round(rawYahooVariation12m, 4);
  const quickVariation12m = finiteNumberOrNull(quick.variation12mPercent);
  const variation12m = quickVariation12m === null ? yahooVariation12m : round(quickVariation12m, 4);
  const price = finiteNumberOrNull(quick.price)
    ?? finiteNumberOrNull(oneYearHistory?.regularMarketPrice)
    ?? finiteNumberOrNull(chartPoints.at(-1)?.close);
  const dy12m = finiteNumberOrNull(quick.dy12m) ?? parseBrNumber(histDyDisplay);
  const pvp = finiteNumberOrNull(quick.pvp) ?? parseBrNumber(histPvpDisplay);
  const dailyLiquidity = finiteNumberOrNull(quick.dailyLiquidity) ?? parseMoneyScale(histLiquidityDisplay);
  const name = investidor10?.items?.find?.(item => item.id === 'razao_social')?.value || investidor10?.canonical?.presentation?.summary?.split(' • ')?.[0] || ticker;
  const resolvedLogoUrl = yahooLogo?.logoUrl || '';
  const metrics = [
    { id: 'price', label: `${ticker} cotação`, value: quick.priceDisplay || yahooPriceDisplay || '—', numericValue: Number.isFinite(price) ? round(price, 4) : null, source: quick.priceDisplay ? 'Investidor10' : 'Yahoo Finance Chart API' },
    { id: 'dy12m', label: `${ticker} DY (12M)`, value: quick.dy12mDisplay || histDyDisplay || (Number.isFinite(dy12m) ? formatPercent(dy12m) : '—'), numericValue: Number.isFinite(dy12m) ? round(dy12m, 4) : null, source: quick.dy12mDisplay ? 'Investidor10' : (histDyDisplay ? 'Investidor10 histórico' : 'Investidor10') },
    { id: 'pvp', label: 'P/VP', value: quick.pvpDisplay || histPvpDisplay || (Number.isFinite(pvp) ? String(round(pvp, 2)).replace('.', ',') : '—'), numericValue: Number.isFinite(pvp) ? round(pvp, 4) : null, source: quick.pvpDisplay ? 'Investidor10' : (histPvpDisplay ? 'Investidor10 histórico' : 'Investidor10') },
    { id: 'daily_liquidity', label: 'Liquidez diária', value: quick.dailyLiquidityDisplay || histLiquidityDisplay || (Number.isFinite(dailyLiquidity) ? formatCompactMoney(dailyLiquidity) : '—'), numericValue: Number.isFinite(dailyLiquidity) ? round(dailyLiquidity, 2) : null, source: quick.dailyLiquidityDisplay ? 'Investidor10' : (histLiquidityDisplay ? 'Investidor10 histórico' : 'Investidor10') },
    { id: 'variation_12m', label: 'Variação (12M)', value: quick.variation12mDisplay || (variation12m === null ? '—' : formatPercent(variation12m, false)), numericValue: variation12m, source: quick.variation12mDisplay ? 'Investidor10' : (yahooVariation12m === null ? 'Investidor10' : 'Yahoo Finance Chart API') }
  ];

  const baseDividendCharts = investidor10?.dividendCharts?.status === 'OK'
    ? investidor10.dividendCharts
    : buildFiiDividendChartsPayload({
      canonical: investidor10?.canonical || {},
      html: investidor10?.html || '',
      ticker,
      quickMetrics: quick,
      distributions12m: investidor10?.distributions12m,
      referencePrice: price
    });
  const dividendCharts = enrichFiiDividendChartsWithHistoricalYield(baseDividendCharts, historicalDividendYield);
  const now = new Date().toISOString();
  const hasResolvedChecklist = (investidor10?.checklist?.items || []).some(item =>
    typeof item?.passed === 'boolean' || ['PASSED', 'FAILED'].includes(String(item?.status || '').toUpperCase())
  );
  const hasInvestidor10Data = Boolean(investidor10?.items?.length || investidor10?.returnsRows?.length || investidor10?.historicalIndicators?.rows?.length || hasResolvedChecklist || investidor10?.aboutFund?.sections?.length || investidor10?.propertyPortfolio?.states?.length || investidor10?.propertyPortfolio?.properties?.length || investidor10?.vacancyHistory?.points?.length || investidor10?.patrimonialInfo?.metrics?.length || investidor10?.patrimonialInfo?.bars?.length || investidor10?.patrimonialInfo?.segmentAverage?.rows?.length || investidor10?.announcements?.items?.length || metrics.some(m => String(m.source || '').startsWith('Investidor10') && m.value !== '—'));
  const hasComparisonData = Boolean(comparison?.series?.length || Object.values(comparison?.seriesByPeriod || {}).some(period => Array.isArray(period) ? period.some(item => Array.isArray(item?.points) && item.points.length) : period?.series?.length));
  const status = hasInvestidor10Data || chartPoints.length > 1 || hasComparisonData ? 'OK' : 'PARTIAL';
  return {
    ok: true,
    status,
    endpoint: 'asset/fii-modal',
    contract: 'FiiAssetModalResponse',
    contractVersion: FII_MODAL_VERSION,
    version: RELEASE.version,
    patch: RELEASE.patch,
    ticker,
    symbol: ticker,
    assetType: 'FII',
    name,
    updatedAt: now,
    stage,
    mode: stage,
    fullOnly: !fastMode,
    progressive: true,
    sourcePolicy: 'Modal único de FIIs com política sem substituição estática: blocos cadastrais, indicadores, proventos, imóveis, vacância, comunicados, checklist e comparador de pares só são preenchidos quando vierem da fonte real capturada para o ticker solicitado. Cotação e comparação com índices usam fontes vivas definidas no contrato. Quando a fonte real não entrega um bloco, o contrato mantém status EMPTY/ERROR em vez de reconstruir com dados relacionados, exemplo ou snapshot.',
    dataTruth: {
      status: 'AUDITED',
      policy: 'FAIL_CLOSED',
      identityVerified: Boolean(investidor10?.identityOk),
      directSourceSections: ['quoteSummary', 'metrics', 'chart', 'returns', 'information', 'historicalIndicators', 'peerComparison', 'distributions12m', 'dividendCharts', 'aboutFund', 'propertyPortfolio', 'vacancyHistory', 'announcements', 'patrimonialInfo'],
      calculatedSections: [
        { id: 'checklist', nature: 'MIXED', rule: 'marcação direta da fonte ou cálculo transparente somente com métricas reais do Investidor10; sem evidência fica UNKNOWN' },
        { id: 'vacancyHistory.occupancyPercent', nature: 'CALCULATED_WHEN_ABSENT', rule: '100% menos vacância, identificado por occupancyCalculated=true quando a ocupação não foi publicada' },
        { id: 'indexComparison', nature: 'CALCULATED', rule: 'rebasing, retorno acumulado e simulação de R$ 1.000 calculados somente sobre séries temporais reais' },
        { id: 'dividendCharts.yieldSeries', nature: 'DIRECT_OR_CALCULATED', rule: 'usa a série direta quando publicada; na ausência, calcula dividendo real / fechamento histórico Yahoo do mesmo período, sem usar a cotação atual' },
        { id: 'patrimonialInfo.segmentAverage', nature: 'DIRECT_OR_EMPTY', rule: 'média só é exibida quando a própria tabela da fonte prova o recorte de mesmo tipo/segmento; FIIs apenas relacionados não geram média' }
      ],
      prohibitedSubstitutions: ['mock', 'synthetic', 'static_snapshot', 'proxy_ticker', 'single_quote_as_history', 'monthly_return_reconstruction', 'historical_dy_from_current_price', 'peer_type_inheritance', 'patrimonial_value_inference'],
      unavailableBehavior: 'EMPTY_ERROR_OR_UNKNOWN'
    },
    sources: [
      { id: 'investidor10_fii_html', role: 'cards_rapidos_rentabilidade_informacoes' },
      { id: 'investidor10_fii_api', role: 'historico_indicadores_fundamentalistas' },
      { id: 'yahoo_chart', role: 'cotacao_tempo_real_apenas_sem_fundamentos' },
      { id: 'yahoo_quote_logo', role: 'logotipo_canonico_do_ativo_quando_disponivel' },
      { id: 'yahoo_direct_indices', role: 'comparacao_ativo_ifix_cdi_ipca_ibov_smll_idiv_ivvb11' },
      { id: 'investidor10_fii_peer_table', role: 'comparando_com_outros_fiis_mesmo_tipo_segmento' },
      { id: 'investidor10_fii_distributions_12m', role: 'distribuicoes_nos_ultimos_12_meses' },
      { id: 'investidor10_fii_dividend_yield_chart', role: 'dividend_yield_mensal_anual_1a_5a_max' },
      { id: 'yahoo_historical_closes_for_fii_dy', role: 'fechamentos_historicos_reais_para_calculo_do_dividend_yield_quando_a_fonte_nao_publica_a_serie' },
      { id: 'investidor10_fii_dividend_chart_table', role: 'dividendos_mensal_anual_1a_5a_max_tabela_datas' },
      { id: 'investidor10_fii_buy_hold_checklist', role: 'checklist_do_investidor_buy_and_hold' },
      { id: 'investidor10_fii_vacancy_history', role: 'historico_da_taxa_de_vacancia' },
      { id: 'investidor10_fii_patrimonial_info', role: 'valor_patrimonial_barras_metricas_media_tipo_segmento' },
      { id: 'investidor10_fii_announcements', role: 'comunicados_documentos_pdf_fatos_relevantes_distribuicoes' },
      { id: 'investidor10_fii_about_fund', role: 'sobre_o_fundo_estrategia_composicao_diversificacao_taxas' },
      { id: 'investidor10_fii_property_portfolio', role: 'lista_de_imoveis_grafico_por_estado_e_cards_de_imoveis' }
    ],
    quoteSummary: {
      ticker,
      name,
      logoUrl: resolvedLogoUrl,
      logoSource: yahooLogo?.logoUrl ? 'Yahoo Finance Quote API' : '',
      price: price === null ? null : round(price, 4),
      priceDisplay: quick.priceDisplay || yahooPriceDisplay || '—',
      changePercent: finiteNumberOrNull(quick.changePercent) === null ? yahooDayChange.value : round(Number(quick.changePercent), 4),
      changeDisplay: quick.changeDisplay || yahooDayChange.display || '',
      dy12m: Number.isFinite(dy12m) ? round(dy12m, 4) : null,
      pvp: Number.isFinite(pvp) ? round(pvp, 4) : null,
      dailyLiquidity: Number.isFinite(dailyLiquidity) ? round(dailyLiquidity, 2) : null,
      variation12mPercent: variation12m,
      source: quick.priceDisplay ? 'Investidor10' : 'Yahoo Finance Chart API'
    },
    metrics,
    chart: {
      id: 'realtime_price_history',
      title: `Cotação ${ticker}`,
      range: oneYearHistory?.range || '1Y',
      interval: oneYearHistory?.interval || '1d',
      currency: oneYearHistory?.currency || 'BRL',
      source: 'Yahoo Finance Chart API',
      points: chartPoints,
      summary: priceChartSummary,
      warning: oneYearHistory?.error || undefined
    },
    comparison,
    peerComparison: investidor10?.peerComparison || extractInvestidor10FiiPeerComparison('', ticker, quick),
    checklist: investidor10?.checklist || emptyFiiBuyHoldChecklist(ticker, { reason: 'investidor10_bundle_missing' }),
    aboutFund: {
      ...(investidor10?.aboutFund || emptyFiiAboutFund(ticker, { reason: 'investidor10_bundle_missing' })),
      logoUrl: resolvedLogoUrl,
      logoSource: yahooLogo?.logoUrl ? 'Yahoo Finance Quote API' : ''
    },
    propertyPortfolio: investidor10?.propertyPortfolio || emptyFiiPropertyPortfolio(ticker, { reason: 'investidor10_bundle_missing' }),
    vacancyHistory: investidor10?.vacancyHistory || emptyFiiVacancyHistory(ticker, { reason: 'investidor10_bundle_missing' }),
    patrimonialInfo: investidor10?.patrimonialInfo || emptyFiiPatrimonialInfo(ticker, { reason: 'investidor10_bundle_missing' }),
    announcements: investidor10?.announcements || emptyFiiAnnouncements(ticker, { reason: 'investidor10_bundle_missing' }),
    distributions12m: investidor10?.distributions12m || emptyFiiDistributions12m(ticker, { reason: 'investidor10_bundle_missing' }),
    dividendCharts: dividendCharts || emptyFiiDividendCharts(ticker, { reason: 'investidor10_bundle_missing' }),
    returns: {
      title: `Rentabilidade de ${name}`,
      rows: investidor10?.returnsRows || [],
      inflationSource: 'Investidor10',
      nominalSource: 'Investidor10'
    },
    information: {
      title: `Informações sobre ${ticker}`,
      source: 'Investidor10',
      sourceUrl: investidor10?.url || `https://investidor10.com.br/fiis/${ticker.toLowerCase()}/`,
      status: investidor10?.items?.length ? 'OK' : 'EMPTY',
      items: investidor10?.items || [],
      sections: investidor10?.sections || []
    },
    infoSections: investidor10?.sections || [],
    historicalIndicators: investidor10?.historicalIndicators || { title: 'Histórico de indicadores fundamentalistas', columns: [], rows: [], status: 'EMPTY', source: 'Investidor10' },
    diagnostics: {
      stage,
      fastMode,
      chartOk: chartPoints.length > 1,
      yahooLogoStatus: yahooLogo?.ok ? 'OK' : (yahooLogo?.error ? 'ERROR' : 'EMPTY'),
      yahooLogoUrl: yahooLogo?.logoUrl || '',
      investidor10Status: investidor10?.status || 0,
      investidor10CacheStatus: investidor10?.cacheStatus,
      investidor10Found: Boolean(investidor10?.items?.length),
      investidor10Error: investidor10?.error,
      identityOk: Boolean(investidor10?.identityOk),
      identityDiagnostics: investidor10?.identityDiagnostics || undefined,
      investidor10FiiId: investidor10?.ids?.fiiId || '',
      historicalIndicatorsStatus: investidor10?.historicalIndicators?.status || 'EMPTY',
      aboutFundSections: investidor10?.aboutFund?.sections?.length || 0,
      propertyPortfolioStates: investidor10?.propertyPortfolio?.states?.length || 0,
      propertyPortfolioItems: investidor10?.propertyPortfolio?.properties?.length || 0,
      vacancyHistoryStatus: investidor10?.vacancyHistory?.status || 'EMPTY',
      vacancyHistoryPoints: investidor10?.vacancyHistory?.points?.length || 0,
      vacancyHistoryHttpStatus: investidor10?.vacancyStatus?.status || 0,
      patrimonialInfoStatus: investidor10?.patrimonialInfo?.status || 'EMPTY',
      patrimonialInfoBars: investidor10?.patrimonialInfo?.bars?.length || 0,
      patrimonialInfoMetrics: investidor10?.patrimonialInfo?.metrics?.length || 0,
      patrimonialInfoSegmentRows: investidor10?.patrimonialInfo?.segmentAverage?.rows?.length || 0,
      announcementsStatus: investidor10?.announcements?.status || 'EMPTY',
      announcementsItems: investidor10?.announcements?.items?.length || 0,
      announcementPdfLinks: investidor10?.announcements?.items?.filter?.(item => item.pdfUrl)?.length || 0,
      vacancyHistoryError: investidor10?.vacancyStatus?.error || '',
      historicalIndicatorsHttpStatus: investidor10?.historicalStatus?.status || 0,
      historicalIndicatorsError: investidor10?.historicalStatus?.error || '',
      comparisonStatus: comparison?.status || 'EMPTY',
      comparisonBenchmarkCards: comparison?.indexQuotes?.filter?.(item => item.ok)?.length || 0,
      comparisonSeriesByPeriod: Object.fromEntries(Object.entries(comparison?.seriesByPeriod || {}).map(([key, value]) => [key, value?.series?.length || 0])),
      comparisonError: comparison?.error || '',
      peerComparisonRows: investidor10?.peerComparison?.rows?.length || 0,
      checklistItems: investidor10?.checklist?.items?.length || 0,
      distributions12mItems: investidor10?.distributions12m?.items?.length || 0,
      dividendChartsStatus: dividendCharts?.status || 'EMPTY',
      dividendChartsYieldMonthly: dividendCharts?.yieldSeriesByFrequency?.monthly?.length || 0,
      dividendChartsDividendsMonthly: dividendCharts?.dividendSeriesByFrequency?.monthly?.length || 0,
      dividendChartsEvents: dividendCharts?.events?.length || 0,
      dividendYieldHistoricalPricePoints: historicalDividendYield?.points?.length || 0,
      statusInvestDiscarded: true,
      fundamentusDiscarded: true,
      staticSubstitutionDiscarded: true
    }
  };
}

function normalizeFiiModalPayload(payload = {}, defaultTimeoutMs = 12000) {
  const stage = normalizeFiiModalStage(payload);
  const timeoutMs = fiiStageTimeoutMs(payload, stage === 'fast' ? 3800 : defaultTimeoutMs);
  return {
    ...payload,
    stage,
    mode: stage,
    priority: stage,
    fullContract: stage === 'full',
    fullOnly: stage === 'full',
    progressive: true,
    timeoutMs,
    routeDeadlineMs: stage === 'fast'
      ? Math.min(4500, Math.max(2200, timeoutMs))
      : Math.min(12500, Math.max(7000, timeoutMs)),
    modalDeadlineMs: stage === 'fast'
      ? Math.min(4500, Math.max(2200, timeoutMs))
      : Math.min(12500, Math.max(7000, timeoutMs)),
    deadlineMs: stage === 'fast'
      ? Math.min(4500, Math.max(2200, timeoutMs))
      : Math.min(12500, Math.max(7000, timeoutMs))
  };
}

export async function buildFiiModalContract(payload = {}) {
  const modalPayload = normalizeFiiModalPayload(payload, 12000);
  const ticker = normalizeTicker(modalPayload.ticker || modalPayload.symbol || modalPayload.q || modalPayload.query);
  return withAssetModalRuntime({
    family: 'fii',
    ticker,
    payload: modalPayload,
    ttlMs: modalPayload.stage === 'fast' ? 35_000 : 180_000,
    staleMs: modalPayload.stage === 'fast' ? 2 * 60 * 1000 : 15 * 60 * 1000,
    producer: () => buildFiiModalContractFresh(modalPayload)
  });
}

export const _test = { distributionPeriodKey, normalizeFiiModalStage, fiiStageTimeoutMs, deferredFiiIndexComparison, extractInvestidor10FiiInformation, extractInvestidor10FiiQuickMetrics, normalizeFiiHistoricalIndicatorsApi, returnsRowsFromInvestidor10, cleanInvestidor10InfoValue, normalizeComparisonPoints, comparisonItemFromSeries, comparisonItemsForSelectableSeries, firstHistoricalIndicatorValue, comparisonFetchPlans, extractInvestidor10FiiPeerComparison, extractInvestidor10FiiRelatedPeerComparison, extractFiiReferenceTypeSegmentFromText, extractInvestidor10FiiBuyHoldChecklist, detectChecklistPassed, ensureFiiBuyHoldChecklist, fiiTickerIdentityOk, fiiPageIdentityDiagnostics, emptyFiiBuyHoldChecklist, extractInvestidor10FiiAbout, emptyFiiAboutFund, extractInvestidor10FiiPropertyPortfolio, emptyFiiPropertyPortfolio, extractFiiPropertyStates, extractFiiPropertyItems, extractFiiVacancyHistoryFromHtml, buildFiiVacancyHistoryPayload, emptyFiiVacancyHistory, collectFiiVacancyApiPoints, buildFiiPatrimonialInfoPayload, emptyFiiPatrimonialInfo, extractInvestidor10FiiAnnouncements, mergeFiiAnnouncementsPayloads, fetchInvestidor10FiiAnnouncementsPages, announcementKindFromUrl, emptyFiiAnnouncements, enrichInvestidor10FiiAnnouncementPdfLinks, extractPdfUrlFromAnnouncementDocument, findAnnouncementsHtmlSection, findPatrimonialSection, findTypeSegmentAverageSection, buildTypeSegmentAverageRows, buildFiiDistributions12mPayload, extractFiiDistributions12mFromHtml, emptyFiiDistributions12m, emptyFiiDividendCharts, buildFiiDividendChartsPayload, extractFiiDividendChartsFromHtml, normalizeFiiDividendEvent, aggregateDividendEvents, parseFiiPeerRowChunk, fiiPeerPatrimonialValueFromHtml, enrichFiiPeerComparisonPatrimonialValues, FII_INDEX_BENCHMARKS, FII_COMPARISON_PERIODS, FII_MODAL_VERSION, normalizeAccumulatedBenchmarkPoints, comparisonHistoryRangeForPeriod, normalizeReturnPageHistoryPoints, fixedFiiIndexSelectorOptions, parseFiiSectionList, fiiSectionRecoveryTargets, extractFiiIdFromJson, getCachedFiiId, cacheFiiId, resolveInvestidor10FiiId };
