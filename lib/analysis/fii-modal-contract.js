import { classifyTicker, normalizeTicker } from '../core/tickers.js';
import { round } from '../core/numbers.js';
import { fetchYahooHistory, fetchYahooQuote } from '../market/yahoo.js';
import { fetchText, fetchJson } from '../sources/fetch.js';
import { getCdiAccumulatedSeries } from '../sources/cdi.js';
import { getIpcaSeries } from '../sources/ipca.js';
import { extractInvestidor10ChartIds, buildInvestidor10CanonicalCharts } from '../market/investidor10-chart-extractor.js';
import { RELEASE } from '../core/release.js';

const FII_MODAL_VERSION = '26.asset-modal.fii.v16';

const RETURN_PERIODS = Object.freeze([
  { key: '1m', label: '1 mês', range: '1M', interval: '1d', months: 1 },
  { key: '3m', label: '3 meses', range: '3M', interval: '1d', months: 3 },
  { key: '1y', label: '1 ano', range: '1Y', interval: '1d', months: 12 },
  { key: '2y', label: '2 anos', range: '2Y', interval: '1wk', months: 24 },
  { key: '5y', label: '5 anos', range: '5Y', interval: '1wk', months: 60 },
  { key: '10y', label: '10 anos', range: '10Y', interval: '1mo', months: 120 }
]);

const FII_INDEX_BENCHMARKS = Object.freeze([
  { key: 'ifix', code: 'IFIX', label: 'IFIX', ticker: 'IFIX', yahooSymbol: 'IFIX.SA', yahooSymbols: ['IFIX.SA', '^IFIX'], kind: 'yahoo_index', sourceLabel: 'Yahoo Finance Chart API índice direto IFIX.SA' },
  { key: 'cdi', code: 'CDI', label: 'CDI', ticker: 'CDI', kind: 'bcb_cdi', sourceLabel: 'Banco Central SGS CDI' },
  { key: 'ipca', code: 'IPCA', label: 'IPCA', ticker: 'IPCA', kind: 'bcb_ipca', sourceLabel: 'Banco Central SGS IPCA' },
  { key: 'ibov', code: 'IBOV', label: 'IBOV', ticker: 'IBOV', yahooSymbol: '^BVSP', kind: 'yahoo_index', sourceLabel: 'Yahoo Finance Chart API índice direto ^BVSP' },
  { key: 'smll', code: 'SMLL', label: 'SMLL', ticker: 'SMLL', yahooSymbol: 'SMLL.SA', yahooSymbols: ['SMLL.SA', '^SMLL'], kind: 'yahoo_index', sourceLabel: 'Yahoo Finance Chart API índice direto SMLL.SA' },
  { key: 'idiv', code: 'IDIV', label: 'IDIV', ticker: 'IDIV', yahooSymbol: 'IDIV.SA', yahooSymbols: ['IDIV.SA', '^IDIV'], kind: 'yahoo_index', sourceLabel: 'Yahoo Finance Chart API índice direto IDIV.SA' },
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
  const occupancyNumber = occupancy !== null && occupancy !== undefined && occupancy !== '' && Number.isFinite(Number(occupancy)) ? Number(occupancy) : Math.max(0, 100 - vacancyNumber);
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
    Number.isFinite(Number(quickMetrics?.pvp)) ? { label: 'P/VP', value: String(quickMetrics.pvp).replace('.', ',') } : null
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


function detectChecklistPassed(section = '', labelStart = 0, labelLength = 0) {
  const window = normalizeLooseText(section.slice(Math.max(0, labelStart - 140), Math.min(section.length, labelStart + labelLength + 160)));
  if (/\b(?:nao atende|não atende|reprovado|reprovada|falhou|negativo|cancel|close|unchecked|xmark|times)\b/.test(window)) return false;
  if (/\b(?:check_circle|check|done|aprovado|aprovada|atende|positivo|sim)\b/.test(window) || /✓/.test(section)) return true;
  // Na página do Investidor10 os critérios do checklist aparecem com um box de check ao lado.
  // Quando o texto está presente no bloco e não há marcador de reprovação próximo, preservamos o estado como atendido.
  return true;
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
  return {
    id: 'fii_peer_comparison',
    title: 'Comparando com outros FIIs',
    subtitle: diagnostics?.mode === 'related_fiis_fallback'
      ? 'Pares do Investidor10 montados a partir de FIIs Relacionados e páginas dos pares quando a tabela renderizada não vem no HTML estático.'
      : 'Tabela do Investidor10 filtrada por mesmo tipo e segmento do fundo.',
    filterLabel: 'Mesmo tipo e segmento',
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

function buildReferenceFiiPeerRow(ticker = '', quickMetrics = {}, infoItems = []) {
  const symbol = String(ticker || '').toUpperCase();
  if (!symbol) return null;
  const dyValue = Number.isFinite(Number(quickMetrics?.dy12m)) ? Number(quickMetrics.dy12m) : parseBrNumber(firstInfoValue(infoItems, ['dividend_yield', 'dy']));
  const pvpValue = Number.isFinite(Number(quickMetrics?.pvp)) ? Number(quickMetrics.pvp) : parseBrNumber(firstInfoValue(infoItems, ['pvp', 'p_vp']));
  const patrimonialDisplay = firstInfoValue(infoItems, ['valor_patrimonial']) || '—';
  const patrimonialValue = parseMoneyScale(patrimonialDisplay);
  const fundType = normalizeFiiPeerType(firstInfoValue(infoItems, ['tipo_fundo']) || '');
  const segment = normalizePeerTableText(firstInfoValue(infoItems, ['segmento']) || '');
  return {
    ticker: symbol,
    isReference: true,
    dividendYield: Number.isFinite(dyValue) ? dyValue : null,
    dividendYieldDisplay: quickMetrics?.dy12mDisplay || (Number.isFinite(dyValue) ? formatPercent(dyValue) : '—'),
    pvp: Number.isFinite(pvpValue) ? pvpValue : null,
    pvpDisplay: quickMetrics?.pvpDisplay || (Number.isFinite(pvpValue) ? String(round(pvpValue, 2)).replace('.', ',') : '—'),
    patrimonialValue: Number.isFinite(patrimonialValue) ? patrimonialValue : null,
    patrimonialValueDisplay: patrimonialDisplay || '—',
    fundType: fundType || '—',
    segment: segment || '—',
    source: 'Investidor10'
  };
}

function mergeFiiPeerRows(seed = {}, enrichment = {}, referenceTicker = '') {
  const ticker = String(seed?.ticker || enrichment?.ticker || '').toUpperCase();
  if (!ticker) return null;
  const dyValue = Number.isFinite(Number(enrichment?.dividendYield)) ? Number(enrichment.dividendYield) : (Number.isFinite(Number(seed?.dividendYield)) ? Number(seed.dividendYield) : null);
  const pvpValue = Number.isFinite(Number(enrichment?.pvp)) ? Number(enrichment.pvp) : (Number.isFinite(Number(seed?.pvp)) ? Number(seed.pvp) : null);
  const patrimonialValue = Number.isFinite(Number(enrichment?.patrimonialValue)) ? Number(enrichment.patrimonialValue) : (Number.isFinite(Number(seed?.patrimonialValue)) ? Number(seed.patrimonialValue) : null);
  return {
    ticker,
    isReference: ticker === String(referenceTicker || '').toUpperCase(),
    dividendYield: dyValue,
    dividendYieldDisplay: enrichment?.dividendYieldDisplay || seed?.dividendYieldDisplay || (Number.isFinite(dyValue) ? formatPercent(dyValue) : '—'),
    pvp: pvpValue,
    pvpDisplay: enrichment?.pvpDisplay || seed?.pvpDisplay || (Number.isFinite(pvpValue) ? String(round(pvpValue, 2)).replace('.', ',') : '—'),
    patrimonialValue,
    patrimonialValueDisplay: enrichment?.patrimonialValueDisplay || seed?.patrimonialValueDisplay || (Number.isFinite(patrimonialValue) ? formatCompactMoney(patrimonialValue) : '—'),
    fundType: enrichment?.fundType || seed?.fundType || '—',
    segment: enrichment?.segment || seed?.segment || '—',
    source: enrichment?.source || seed?.source || 'Investidor10'
  };
}

function extractInvestidor10FiiRelatedPeers(html = '', referenceTicker = '') {
  const plain = htmlToPlainText(html);
  const start = plain.search(/FIIS\s+RELACIONAD[AO]S?/i);
  if (start < 0) return [];
  const rawSection = plain.slice(start, start + 3600);
  const endRel = rawSection.slice(80).search(/(?:Comparar\s+Fiis|Hist[óo]rico\s+de\s+Indicadores|Nacional|Internacional|D[úu]vidas\s+comuns|Discuss[ãa]o|Copyright)/i);
  const section = normalizePeerTableText(endRel >= 0 ? rawSection.slice(0, 80 + endRel) : rawSection);
  const matches = [...section.matchAll(/\b[A-Z]{4}\d{2}\b/g)];
  const rows = [];
  const seen = new Set([String(referenceTicker || '').toUpperCase()].filter(Boolean));
  for (let i = 0; i < matches.length; i++) {
    const ticker = String(matches[i][0] || '').toUpperCase();
    if (!ticker || seen.has(ticker)) continue;
    const startIdx = matches[i].index ?? 0;
    const endIdx = i + 1 < matches.length ? (matches[i + 1].index ?? section.length) : section.length;
    const chunk = section.slice(startIdx, endIdx);
    const dyText = chunk.match(/DY\s*:\s*([+-]?\d{1,3}(?:[.,]\d+)?\s*%|0\s*%)/i)?.[1] || '';
    const pvpText = chunk.match(/P\s*\/\s*VP\s*:\s*([+-]?\d{1,3}(?:[.,]\d+)?)/i)?.[1] || '';
    if (!dyText && !pvpText) continue;
    seen.add(ticker);
    rows.push({
      ticker,
      isReference: false,
      dividendYield: parseBrNumber(dyText),
      dividendYieldDisplay: normalizePeerTableText(dyText).replace(/\s+%/g, '%') || '—',
      pvp: parseBrNumber(pvpText),
      pvpDisplay: normalizePeerTableText(pvpText).replace('.', ',') || '—',
      patrimonialValue: null,
      patrimonialValueDisplay: '—',
      fundType: '—',
      segment: '—',
      source: 'Investidor10 — FIIs Relacionados'
    });
    if (rows.length >= 14) break;
  }
  return rows;
}

async function fetchInvestidor10FiiPeerEnrichment(row = {}, referenceUrl = '', timeoutMs = 4500) {
  const ticker = String(row?.ticker || '').toUpperCase();
  if (!ticker) return row;
  const url = `https://investidor10.com.br/fiis/${ticker.toLowerCase()}/`;
  const response = await fetchText(url, {
    timeoutMs: Math.min(4500, Math.max(2200, Number(timeoutMs) || 4500)),
    ttlMs: 30 * 60 * 1000,
    staleMs: 0,
    retries: 0,
    headers: {
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      Referer: referenceUrl || 'https://investidor10.com.br/fiis/'
    }
  });
  const html = response?.text || '';
  if (!html) return { ...row, enrichmentStatus: 'EMPTY' };
  const quick = extractInvestidor10FiiQuickMetrics(html, ticker);
  const info = extractInvestidor10FiiInformation(html, ticker);
  const referenceLike = buildReferenceFiiPeerRow(ticker, quick, info.items || []);
  return mergeFiiPeerRows(row, { ...referenceLike, source: 'Investidor10 — página do par' }, '');
}

async function buildInvestidor10FiiPeerComparisonFallback({ html = '', ticker = '', quickMetrics = {}, infoItems = [], timeoutMs = 6500, url = '' } = {}) {
  const referenceRow = buildReferenceFiiPeerRow(ticker, quickMetrics, infoItems);
  const relatedRows = extractInvestidor10FiiRelatedPeers(html, ticker);
  const seedRows = [referenceRow, ...relatedRows].filter(Boolean);
  if (!seedRows.length) return emptyFiiPeerComparison(ticker, { mode: 'related_fiis_fallback', reason: 'no_related_rows' });
  const peersToEnrich = relatedRows.slice(0, 10);
  const enrichedResults = await Promise.allSettled(peersToEnrich.map(row => fetchInvestidor10FiiPeerEnrichment(row, url, Math.min(4500, timeoutMs))));
  const enrichedByTicker = new Map();
  let enrichmentOk = 0;
  let enrichmentFailed = 0;
  for (let i = 0; i < peersToEnrich.length; i++) {
    const result = enrichedResults[i];
    if (result?.status === 'fulfilled' && result.value?.ticker) {
      enrichedByTicker.set(result.value.ticker, result.value);
      if (result.value.fundType !== '—' || result.value.segment !== '—' || result.value.patrimonialValueDisplay !== '—') enrichmentOk += 1;
    } else {
      enrichmentFailed += 1;
    }
  }
  const merged = seedRows.map(row => mergeFiiPeerRows(row, enrichedByTicker.get(row.ticker) || {}, ticker)).filter(Boolean);
  const deduped = [];
  const seen = new Set();
  for (const row of merged) {
    if (!row.ticker || seen.has(row.ticker)) continue;
    seen.add(row.ticker);
    deduped.push(row);
  }
  return buildFiiPeerComparisonPayload(deduped, ticker, {
    mode: 'related_fiis_fallback',
    reason: 'rendered_comparator_rows_absent_from_static_html',
    relatedRows: relatedRows.length,
    enrichmentOk,
    enrichmentFailed
  }, 'Investidor10 — FIIs Relacionados');
}

function extractInvestidor10FiiPeerComparison(html = '', ticker = '') {
  const plain = htmlToPlainText(html);
  const start = plain.search(/COMPARANDO\s+COM\s+OUTROS\s+FIIS/i);
  if (start < 0) return emptyFiiPeerComparison(ticker, { mode: 'rendered_table', reason: 'section_not_found' });
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
  return buildFiiPeerComparisonPayload(rows, ticker, {
    mode: 'rendered_table',
    rowCandidates: matches.length,
    parsedRows: rows.length
  }, 'Investidor10');
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
    const key = label.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_');
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

function buildDerivedDividendYieldSeries(dividendPoints = [], referencePrice = null) {
  const price = Number(referencePrice);
  if (!Number.isFinite(price) || price <= 0) return [];
  return dividendPoints.map(point => {
    const dy = Number(point.value) / price * 100;
    return {
      ...point,
      value: round(dy, 4),
      valueDisplay: formatPercent(dy, false),
      yieldPercent: round(dy, 4),
      yieldDisplay: formatPercent(dy, false),
      source: 'Investidor10 dividendos + cotação de referência'
    };
  }).filter(point => Number.isFinite(point.value));
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

function buildFiiDividendChartsPayload({ canonical = {}, ticker = '', quickMetrics = {}, distributions12m = null, referencePrice = null } = {}) {
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
  let yieldMonthly = rawDy.map(item => normalizeDividendYieldPoint(item, 'monthly')).filter(Boolean);
  if (!yieldMonthly.length && finalDividendMonthly.length) yieldMonthly = buildDerivedDividendYieldSeries(finalDividendMonthly, referencePrice);
  const yieldYearly = yieldMonthly.length ? yearlyFromMonthly(yieldMonthly, 'average') : [];
  const currentDy = Number.isFinite(Number(quickMetrics?.dy12m)) ? Number(quickMetrics.dy12m) : Number(distributions12m?.items?.find?.(item => item?.key === '12m')?.yieldPercent);
  const avg5y = averageLastYears(yieldMonthly, 5) ?? averageLastYears(yieldYearly, 5);
  const total12m = totalLastMonths(finalDividendMonthly, 12) ?? Number(distributions12m?.items?.find?.(item => item?.key === '12m')?.amount);
  const hasData = yieldMonthly.length || yieldYearly.length || finalDividendMonthly.length || finalDividendYearly.length || events.length;
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
      dyDerivedFromDividends: !rawDy.length && yieldMonthly.length > 0,
      sourcePolicy: rawDy.length ? 'investidor10_dividend_yield_history' : 'derived_from_investidor10_dividends_and_reference_price_when_chart_data_not_embedded'
    }
  };
}

async function fetchInvestidor10FiiBundle(ticker, timeoutMs = 6500) {
  const url = `https://investidor10.com.br/fiis/${ticker.toLowerCase()}/`;
  const response = await fetchText(url, {
    timeoutMs,
    ttlMs: 15 * 60 * 1000,
    staleMs: 0,
    retries: 1,
    headers: { Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' }
  });
  const html = response?.text || '';
  const info = html ? extractInvestidor10FiiInformation(html, ticker) : { items: [], sections: [], diagnostics: { found: false } };
  const quickMetrics = html ? extractInvestidor10FiiQuickMetrics(html, ticker) : {};
  const checklist = html ? extractInvestidor10FiiBuyHoldChecklist(html, ticker) : emptyFiiBuyHoldChecklist(ticker, { reason: 'no_html' });
  const aboutFund = html ? extractInvestidor10FiiAbout(html, ticker, info.items || [], quickMetrics) : emptyFiiAboutFund(ticker, { reason: 'no_html' });
  const propertyPortfolio = html ? extractInvestidor10FiiPropertyPortfolio(html, ticker) : emptyFiiPropertyPortfolio(ticker, { reason: 'no_html' });
  let peerComparison = html ? extractInvestidor10FiiPeerComparison(html, ticker) : extractInvestidor10FiiPeerComparison('', ticker);
  if (html && !(peerComparison?.rows || []).length) {
    peerComparison = await buildInvestidor10FiiPeerComparisonFallback({
      html,
      ticker,
      quickMetrics,
      infoItems: info.items || [],
      timeoutMs,
      url
    });
  }
  const ids = html ? extractInvestidor10ChartIds(html) : {};
  let historicalRaw = null;
  let historicalStatus = { status: 0, cacheStatus: '', error: '' };
  if (ids.fiiId) {
    const histUrl = `https://investidor10.com.br/api/fii/historico-indicadores/${ids.fiiId}/10`;
    const histResponse = await fetchJson(histUrl, {
      timeoutMs: Math.min(7000, Math.max(3500, timeoutMs)),
      ttlMs: 15 * 60 * 1000,
      staleMs: 0,
      retries: 1,
      headers: {
        Accept: 'application/json, text/plain, */*',
        'X-Requested-With': 'XMLHttpRequest',
        Referer: url
      }
    });
    historicalRaw = histResponse?.json;
    historicalStatus = { status: histResponse?.status || 0, cacheStatus: histResponse?.cacheStatus, error: histResponse?.error || (histResponse?.parseError ? 'parse-error' : '') };
  }
  let vacancyRaw = null;
  let vacancyStatus = { status: 0, cacheStatus: '', error: '' };
  if (ids.fiiId) {
    const vacancyCandidates = [
      `https://investidor10.com.br/api/fii/vacancia-chart/${ids.fiiId}/12`,
      `https://investidor10.com.br/api/fii/taxa-vacancia-chart/${ids.fiiId}/12`,
      `https://investidor10.com.br/api/fii/historico-vacancia/${ids.fiiId}/12`,
      `https://investidor10.com.br/api/fii/vacancia/${ids.fiiId}/12`,
      `https://investidor10.com.br/api/fii/historico-taxa-vacancia/${ids.fiiId}/12`
    ];
    for (const vacancyUrl of vacancyCandidates) {
      const vacancyResponse = await fetchJson(vacancyUrl, {
        timeoutMs: Math.min(5500, Math.max(3000, timeoutMs)),
        ttlMs: 15 * 60 * 1000,
        staleMs: 0,
        retries: 0,
        headers: {
          Accept: 'application/json, text/plain, */*',
          'X-Requested-With': 'XMLHttpRequest',
          Referer: url
        }
      });
      const candidateRows = collectFiiVacancyApiPoints(vacancyResponse?.json, '12m');
      if (candidateRows.length >= 2) {
        vacancyRaw = vacancyResponse?.json;
        vacancyStatus = { status: vacancyResponse?.status || 0, cacheStatus: vacancyResponse?.cacheStatus, error: vacancyResponse?.error || (vacancyResponse?.parseError ? 'parse-error' : ''), url: vacancyUrl };
        break;
      }
      if (!vacancyRaw && vacancyResponse?.status && vacancyResponse.status < 500) {
        vacancyRaw = vacancyResponse?.json;
        vacancyStatus = { status: vacancyResponse?.status || 0, cacheStatus: vacancyResponse?.cacheStatus, error: vacancyResponse?.error || (vacancyResponse?.parseError ? 'parse-error' : ''), url: vacancyUrl };
      }
    }
  }
  const canonical = buildInvestidor10CanonicalCharts({
    ticker,
    type: 'FII',
    html,
    apiExtras: { historicoIndicadoresFii: historicalRaw, rawJson: { historicoIndicadoresFii: historicalRaw, vacancyHistory: vacancyRaw }, apiStatus: [] }
  });
  const historicalIndicators = normalizeFiiHistoricalIndicatorsApi(historicalRaw || canonical?.fii?.fundamentalIndicatorHistory || {});
  const distributions12m = buildFiiDistributions12mPayload({ canonical, html, ticker });
  const vacancyHistory = buildFiiVacancyHistoryPayload({ html, ticker, raw: vacancyRaw || canonical?.fii?.vacancyHistory || canonical?.vacancyHistory, historicalIndicators, quickMetrics });
  return {
    ok: Boolean(html),
    url,
    status: response?.status || 0,
    cacheStatus: response?.cacheStatus,
    error: response?.error,
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
    dividendCharts: buildFiiDividendChartsPayload({
      canonical,
      html,
      ticker,
      quickMetrics,
      distributions12m,
      referencePrice: Number.isFinite(Number(quickMetrics?.price)) ? Number(quickMetrics.price) : null
    }),
    canonical,
    historicalIndicators,
    historicalStatus,
    vacancyStatus,
    ...info
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
        source: `${item.sourceLabel || value.history?.source || 'Yahoo Finance Chart API'}${value.symbolUsed && value.symbolUsed !== item.yahooSymbol ? ` · símbolo alternativo ${value.symbolUsed}` : ''}${value.plan?.fallback ? ' · fallback de intervalo' : ''}`,
        yahooSymbol: value.symbolUsed || value.history?.symbol || item.yahooSymbol || `${item.ticker}.SA`,
        endpoint: item.kind?.startsWith('bcb_')
          ? (value.history?.source || item.sourceLabel)
          : `GET https://query1.finance.yahoo.com/v8/finance/chart/${value.symbolUsed || item.yahooSymbol || item.ticker}?range=${String(value.history?.yahooRange || value.plan?.range || period.range).toLowerCase()}&interval=${value.history?.interval || value.plan?.interval || period.interval}&includePrePost=false`
      };
    }).filter(Boolean);
    return [period.key, { ...period, status: series.length >= 2 ? 'OK' : (series.length ? 'PARTIAL' : 'EMPTY'), series, items: comparisonItemsForSelectableSeries(series, period.key) }];
  }));

  const seriesByPeriod = Object.fromEntries(periodEntries);
  const defaultPeriod = seriesByPeriod['2y']?.series?.length >= 2 ? '2y' : (Object.keys(seriesByPeriod).find(key => seriesByPeriod[key]?.series?.length >= 2) || '2y');
  const active = seriesByPeriod[defaultPeriod] || { series: [], items: [] };

  const yahooQuoteBenchmarks = [
    { key: 'asset', code: ticker, label: ticker, ticker, yahooSymbol: `${ticker}.SA` },
    ...FII_INDEX_BENCHMARKS.filter(item => item.yahooSymbol)
  ];
  const quoteSettled = await Promise.allSettled(yahooQuoteBenchmarks.map(item => fetchYahooQuote(item.yahooSymbol, { timeoutMs: Math.min(4200, perCallTimeout), interval: '1d' })));
  const yahooQuotes = yahooQuoteBenchmarks.map((item, index) => {
    const quote = quoteSettled[index].status === 'fulfilled' ? quoteSettled[index].value : {};
    if (quoteSettled[index].status !== 'fulfilled' || !quote?.ok) {
      diagnostics.push({ code: item.code, yahooSymbol: item.yahooSymbol, status: 'QUOTE_EMPTY', reason: quote?.error || quoteSettled[index].reason?.message || 'cotação indisponível' });
    }
    const periodItem = active.items?.find(row => row.id === item.key || row.code === item.code);
    const yahooQuote = indexQuoteFromYahooQuote(item, quote);
    return yahooQuote.ok ? yahooQuote : comparisonQuoteFromItem(periodItem || {}, item);
  });
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
    diagnostics,
    source: 'Yahoo Finance Chart API + Banco Central SGS',
    selectorPolicy: 'O ativo fica fixo no gráfico; cada benchmark possui seletor próprio para desenhar ou ocultar a linha.',
    defaultSelectedCodes: [ticker, 'IFIX', 'CDI', 'IPCA', 'IBOV', 'SMLL', 'IDIV', 'IVVB11'],
    sourcePolicy: 'Ativo, IFIX, SMLL, IDIV, IBOV e IVVB11 usam Yahoo Finance Chart API. IFIX, SMLL e IDIV priorizam os símbolos diretos .SA informados e podem tentar o símbolo Yahoo direto com ^ quando o .SA vier sem histórico; sem Investidor10, B3, ETF ou proxy ticker para esses índices. CDI e IPCA usam Banco Central SGS. A simulação de R$ 1.000,00 usa as séries históricas ativas do período selecionado.'
  };
}


export async function buildFiiModalContract(payload = {}) {
  const ticker = normalizeTicker(payload.ticker || payload.symbol || payload.q || payload.query);
  if (!ticker) {
    return { ok: false, status: 'ERROR', endpoint: 'asset/fii-modal', error: 'Informe ticker=GGRC11 ou symbol=GGRC11.' };
  }
  const assetClass = classifyTicker(ticker);
  if (assetClass !== 'FII') {
    return {
      ok: true,
      status: 'NOT_FII',
      endpoint: 'asset/fii-modal',
      contract: 'FiiAssetModalResponse',
      contractVersion: FII_MODAL_VERSION,
      ticker,
      assetType: assetClass,
      sourcePolicy: 'StatusInvest e fallbacks legados permanecem bloqueados no modal único. A próxima etapa habilita o contrato Investidor10 também para ações.',
      message: 'Contrato atual carregou a camada de FIIs. Ações serão conectadas pelo mesmo padrão Investidor10-only na próxima etapa.'
    };
  }

  const timeoutMs = Number(payload.timeoutMs || 8500);
  const [oneYearHistory, investidor10, comparison] = await Promise.all([
    fetchYahooHistory(ticker, { range: payload.range || '1Y', interval: payload.interval || '1d', timeoutMs, limit: Number(payload.limit || 260) })
      .catch(error => ({ ok: false, points: [], error: error?.message || String(error), source: 'YahooChart' })),
    fetchInvestidor10FiiBundle(ticker, Number(payload.investidor10TimeoutMs || 7500))
      .catch(error => ({ ok: false, items: [], sections: [], quickMetrics: {}, peerComparison: { id: 'fii_peer_comparison', title: 'Comparando com outros FIIs', subtitle: 'Mesmo tipo e segmento', filterLabel: 'Mesmo tipo e segmento', source: 'Investidor10', status: 'EMPTY', columns: [], rows: [] }, checklist: emptyFiiBuyHoldChecklist(ticker, { reason: 'investidor10_fetch_failed' }), aboutFund: emptyFiiAboutFund(ticker, { reason: 'investidor10_fetch_failed' }), propertyPortfolio: emptyFiiPropertyPortfolio(ticker, { reason: 'investidor10_fetch_failed' }), vacancyHistory: emptyFiiVacancyHistory(ticker, { reason: 'investidor10_fetch_failed' }), returnsRows: [], historicalIndicators: { columns: [], rows: [], status: 'EMPTY' }, error: error?.message || String(error), diagnostics: { found: false } })),
    buildFiiYahooIndexComparison(ticker, timeoutMs)
      .catch(error => ({ id: 'fii_asset_vs_yahoo_indices', status: 'ERROR', error: error?.message || String(error), periods: FII_COMPARISON_PERIODS, seriesByPeriod: {}, series: [], items: [], indexQuotes: [] }))
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
  const yahooVariation12m = Number.isFinite(Number(priceChartSummary?.variationPercent)) ? round(Number(priceChartSummary.variationPercent), 4) : null;
  const variation12m = Number.isFinite(Number(quick.variation12mPercent)) ? round(Number(quick.variation12mPercent), 4) : yahooVariation12m;
  const price = Number.isFinite(Number(quick.price)) ? Number(quick.price) : Number(oneYearHistory?.regularMarketPrice || chartPoints.at(-1)?.close);
  const dy12m = Number.isFinite(Number(quick.dy12m)) ? Number(quick.dy12m) : parseBrNumber(histDyDisplay);
  const pvp = Number.isFinite(Number(quick.pvp)) ? Number(quick.pvp) : parseBrNumber(histPvpDisplay);
  const dailyLiquidity = Number.isFinite(Number(quick.dailyLiquidity)) ? Number(quick.dailyLiquidity) : parseMoneyScale(histLiquidityDisplay);
  const name = investidor10?.items?.find?.(item => item.id === 'razao_social')?.value || investidor10?.canonical?.presentation?.summary?.split(' • ')?.[0] || ticker;
  const metrics = [
    { id: 'price', label: `${ticker} cotação`, value: quick.priceDisplay || yahooPriceDisplay || '—', numericValue: Number.isFinite(price) ? round(price, 4) : null, source: quick.priceDisplay ? 'Investidor10' : 'Yahoo Finance Chart API' },
    { id: 'dy12m', label: `${ticker} DY (12M)`, value: quick.dy12mDisplay || histDyDisplay || (Number.isFinite(dy12m) ? formatPercent(dy12m) : '—'), numericValue: Number.isFinite(dy12m) ? round(dy12m, 4) : null, source: quick.dy12mDisplay ? 'Investidor10' : (histDyDisplay ? 'Investidor10 histórico' : 'Investidor10') },
    { id: 'pvp', label: 'P/VP', value: quick.pvpDisplay || histPvpDisplay || (Number.isFinite(pvp) ? String(round(pvp, 2)).replace('.', ',') : '—'), numericValue: Number.isFinite(pvp) ? round(pvp, 4) : null, source: quick.pvpDisplay ? 'Investidor10' : (histPvpDisplay ? 'Investidor10 histórico' : 'Investidor10') },
    { id: 'daily_liquidity', label: 'Liquidez diária', value: quick.dailyLiquidityDisplay || histLiquidityDisplay || (Number.isFinite(dailyLiquidity) ? formatCompactMoney(dailyLiquidity) : '—'), numericValue: Number.isFinite(dailyLiquidity) ? round(dailyLiquidity, 2) : null, source: quick.dailyLiquidityDisplay ? 'Investidor10' : (histLiquidityDisplay ? 'Investidor10 histórico' : 'Investidor10') },
    { id: 'variation_12m', label: 'Variação (12M)', value: quick.variation12mDisplay || (variation12m === null ? '—' : formatPercent(variation12m, false)), numericValue: variation12m, source: quick.variation12mDisplay ? 'Investidor10' : (yahooVariation12m === null ? 'Investidor10' : 'Yahoo Finance Chart API') }
  ];

  const dividendCharts = investidor10?.dividendCharts?.status === 'OK'
    ? investidor10.dividendCharts
    : buildFiiDividendChartsPayload({
      canonical: investidor10?.canonical || {},
      ticker,
      quickMetrics: quick,
      distributions12m: investidor10?.distributions12m,
      referencePrice: Number.isFinite(Number(price)) ? Number(price) : null
    });
  const now = new Date().toISOString();
  const hasInvestidor10Data = Boolean(investidor10?.items?.length || investidor10?.returnsRows?.length || investidor10?.historicalIndicators?.rows?.length || investidor10?.checklist?.items?.length || investidor10?.aboutFund?.sections?.length || investidor10?.propertyPortfolio?.states?.length || investidor10?.propertyPortfolio?.properties?.length || investidor10?.vacancyHistory?.points?.length || metrics.some(m => String(m.source || '').startsWith('Investidor10') && m.value !== '—'));
  const hasComparisonData = Boolean(comparison?.series?.length || Object.values(comparison?.seriesByPeriod || {}).some(period => period?.series?.length));
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
    sourcePolicy: 'Modal único com StatusInvest, Fundamentus, BCB e fallbacks legados descartados. Para FIIs, cards rápidos, rentabilidade, informações cadastrais e histórico de indicadores fundamentalistas, distribuições dos últimos 12 meses, gráficos de Dividend Yield/Dividendos, texto Sobre o fundo, Lista de imóveis, histórico da taxa de vacância e checklist buy and hold vêm do Investidor10. Cotação e comparação com ativo, IFIX, CDI, IPCA, IBOV, SMLL, IDIV e IVVB11 usam Yahoo Finance Chart API e Banco Central SGS com símbolos diretos, sem ETF/proxy/ticker substituto. A seção de comparação com índices é sempre devolvida no contrato para o APK mostrar o bloco mesmo quando o Yahoo retornar histórico parcial. O comparador de FIIs pares usa a tabela Comparando com outros FIIs do Investidor10; quando o HTML estático traz apenas o cabeçalho da tabela renderizada, o Proxy reconstrói o bloco com FIIs Relacionados e páginas individuais dos pares do próprio Investidor10.',
    sources: [
      { id: 'investidor10_fii_html', role: 'cards_rapidos_rentabilidade_informacoes' },
      { id: 'investidor10_fii_api', role: 'historico_indicadores_fundamentalistas' },
      { id: 'yahoo_chart', role: 'cotacao_tempo_real_apenas_sem_fundamentos' },
      { id: 'yahoo_direct_indices', role: 'comparacao_ativo_ifix_cdi_ipca_ibov_smll_idiv_ivvb11' },
      { id: 'investidor10_fii_peer_table', role: 'comparando_com_outros_fiis_mesmo_tipo_segmento' },
      { id: 'investidor10_fii_distributions_12m', role: 'distribuicoes_nos_ultimos_12_meses' },
      { id: 'investidor10_fii_dividend_yield_chart', role: 'dividend_yield_mensal_anual_1a_5a_max' },
      { id: 'investidor10_fii_dividend_chart_table', role: 'dividendos_mensal_anual_1a_5a_max_tabela_datas' },
      { id: 'investidor10_fii_buy_hold_checklist', role: 'checklist_do_investidor_buy_and_hold' },
      { id: 'investidor10_fii_vacancy_history', role: 'historico_da_taxa_de_vacancia' },
      { id: 'investidor10_fii_about_fund', role: 'sobre_o_fundo_estrategia_composicao_diversificacao_taxas' },
      { id: 'investidor10_fii_property_portfolio', role: 'lista_de_imoveis_grafico_por_estado_e_cards_de_imoveis' }
    ],
    quoteSummary: {
      ticker,
      name,
      price: Number.isFinite(price) ? round(price, 4) : null,
      priceDisplay: quick.priceDisplay || yahooPriceDisplay || '—',
      changePercent: Number.isFinite(Number(quick.changePercent)) ? round(Number(quick.changePercent), 4) : yahooDayChange.value,
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
    peerComparison: investidor10?.peerComparison || extractInvestidor10FiiPeerComparison('', ticker),
    checklist: investidor10?.checklist || emptyFiiBuyHoldChecklist(ticker, { reason: 'investidor10_bundle_missing' }),
    aboutFund: investidor10?.aboutFund || emptyFiiAboutFund(ticker, { reason: 'investidor10_bundle_missing' }),
    propertyPortfolio: investidor10?.propertyPortfolio || emptyFiiPropertyPortfolio(ticker, { reason: 'investidor10_bundle_missing' }),
    vacancyHistory: investidor10?.vacancyHistory || emptyFiiVacancyHistory(ticker, { reason: 'investidor10_bundle_missing' }),
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
      chartOk: chartPoints.length > 1,
      investidor10Status: investidor10?.status || 0,
      investidor10CacheStatus: investidor10?.cacheStatus,
      investidor10Found: Boolean(investidor10?.items?.length),
      investidor10Error: investidor10?.error,
      investidor10FiiId: investidor10?.ids?.fiiId || '',
      historicalIndicatorsStatus: investidor10?.historicalIndicators?.status || 'EMPTY',
      aboutFundSections: investidor10?.aboutFund?.sections?.length || 0,
      propertyPortfolioStates: investidor10?.propertyPortfolio?.states?.length || 0,
      propertyPortfolioItems: investidor10?.propertyPortfolio?.properties?.length || 0,
      vacancyHistoryStatus: investidor10?.vacancyHistory?.status || 'EMPTY',
      vacancyHistoryPoints: investidor10?.vacancyHistory?.points?.length || 0,
      vacancyHistoryHttpStatus: investidor10?.vacancyStatus?.status || 0,
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
      statusInvestDiscarded: true,
      fundamentusDiscarded: true,
      legacyFallbackDiscarded: true
    }
  };
}

export const _test = { extractInvestidor10FiiInformation, extractInvestidor10FiiQuickMetrics, normalizeFiiHistoricalIndicatorsApi, returnsRowsFromInvestidor10, cleanInvestidor10InfoValue, normalizeComparisonPoints, comparisonItemFromSeries, comparisonItemsForSelectableSeries, firstHistoricalIndicatorValue, comparisonFetchPlans, extractInvestidor10FiiPeerComparison, extractInvestidor10FiiRelatedPeers, extractInvestidor10FiiBuyHoldChecklist, emptyFiiBuyHoldChecklist, extractInvestidor10FiiAbout, emptyFiiAboutFund, extractInvestidor10FiiPropertyPortfolio, emptyFiiPropertyPortfolio, extractFiiPropertyStates, extractFiiPropertyItems, extractFiiVacancyHistoryFromHtml, buildFiiVacancyHistoryPayload, emptyFiiVacancyHistory, collectFiiVacancyApiPoints, buildFiiDistributions12mPayload, extractFiiDistributions12mFromHtml, emptyFiiDistributions12m, emptyFiiDividendCharts, buildFiiDividendChartsPayload, normalizeFiiDividendEvent, aggregateDividendEvents, buildReferenceFiiPeerRow, parseFiiPeerRowChunk, FII_INDEX_BENCHMARKS, FII_COMPARISON_PERIODS, FII_MODAL_VERSION, normalizeAccumulatedBenchmarkPoints };
