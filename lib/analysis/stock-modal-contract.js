import { classifyTicker, normalizeTicker } from '../core/tickers.js';
import { round } from '../core/numbers.js';
import { fetchYahooHistory, fetchYahooQuote, fetchYahooLogo } from '../market/yahoo.js';
import { fetchText } from '../sources/fetch.js';
import { getAssetHistory } from '../sources/asset-details.js';
import { getIpcaSeries } from '../sources/ipca.js';
import { getCdiAccumulatedSeries } from '../sources/cdi.js';
import { buildInvestidor10CanonicalCharts, discoverInvestidor10ChartApiUrls, extractInvestidor10ChartIds } from '../market/investidor10-chart-extractor.js';
import { parseFinancialNumber, parsePercentNumber } from '../normalizers/numbers.js';
import { RELEASE } from '../core/release.js';
import { settleFastModalSource, withAssetModalRuntime } from './asset-modal-runtime.js';
import { alignComparisonSeriesToSharedWindow } from './asset-index-comparison.js';

export const STOCK_MODAL_VERSION = '26.asset-modal.stock.v56-progressive-fast-full';


const stockIdResolutionCache = new Map();
const STOCK_ID_CACHE_TTL_MS = 6 * 60 * 60 * 1000;


const STOCK_REQUIRED_DEEP_SECTIONS = Object.freeze([
  'historicalIndicators',
  'revenueProfitChart',
  'profitQuoteChart',
  'equityEvolutionChart',
  'indexComparison',
  'announcements'
]);

function parseStockSectionList(value) {
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

function stockSectionRecoveryTargets(payload = {}) {
  const recovery = payload.recovery === true
    || payload.sectionRecovery === true
    || /^(?:1|true|yes|on)$/i.test(String(payload.recovery ?? payload.sectionRecovery ?? ''));
  if (!recovery) return { targeted: false, sections: new Set(STOCK_REQUIRED_DEEP_SECTIONS) };
  const requested = [
    ...parseStockSectionList(payload.knownMissingSections),
    ...parseStockSectionList(payload.missingSections),
    ...parseStockSectionList(payload.requiredSections),
    ...parseStockSectionList(payload.deferredSections)
  ];
  const expanded = requested.flatMap(section => section === 'financialCharts'
    ? ['revenueProfitChart', 'profitQuoteChart', 'equityEvolutionChart']
    : [section]);
  const allowed = new Set(STOCK_REQUIRED_DEEP_SECTIONS);
  const filtered = expanded.filter(section => allowed.has(section));
  return {
    targeted: true,
    sections: new Set(filtered.length ? filtered : STOCK_REQUIRED_DEEP_SECTIONS)
  };
}

function stockApiKeyNeededForTargets(key = '', target = { targeted: false, sections: new Set() }) {
  if (!target.targeted) return true;
  const sections = target.sections || new Set();
  if (key === 'assetTickerRest') return sections.has('historicalIndicators') || sections.has('revenueProfitChart') || sections.has('equityEvolutionChart');
  if (key === 'historicoIndicadores') return sections.has('historicalIndicators');
  if (key === 'receitasLucros') return sections.has('revenueProfitChart') || sections.has('profitQuoteChart') || sections.has('equityEvolutionChart');
  if (key === 'lucroCotacao') return sections.has('profitQuoteChart');
  if (key === 'evolucaoPatrimonio' || key === 'balanceSheetTable') return sections.has('equityEvolutionChart');
  return false;
}

function getCachedStockIds(symbol = '') {
  const key = String(symbol || '').toUpperCase();
  const cached = stockIdResolutionCache.get(key);
  if (!cached || Date.now() - cached.storedAt > STOCK_ID_CACHE_TTL_MS) {
    if (cached) stockIdResolutionCache.delete(key);
    return null;
  }
  return cached.ids;
}

function cacheStockIds(symbol = '', ids = {}) {
  const key = String(symbol || '').toUpperCase();
  if (!key || (!ids?.companyId && !ids?.tickerId)) return ids;
  const normalized = { companyId: String(ids.companyId || ''), tickerId: String(ids.tickerId || ''), fiiId: String(ids.fiiId || '') };
  stockIdResolutionCache.set(key, { ids: normalized, storedAt: Date.now() });
  if (stockIdResolutionCache.size > 256) stockIdResolutionCache.delete(stockIdResolutionCache.keys().next().value);
  return normalized;
}

const STOCK_MODAL_PERIODS = Object.freeze([
  { key: '1m', label: '1 mês', range: '1M', interval: '1d', months: 1 },
  { key: '3m', label: '3 meses', range: '3M', interval: '1d', months: 3 },
  { key: '1y', label: '1 ano', range: '1Y', interval: '1d', months: 12 },
  { key: '2y', label: '2 anos', range: '2Y', interval: '1d', months: 24 },
  { key: '5y', label: '5 anos', range: '5Y', interval: '1wk', months: 60 },
  { key: '10y', label: '10 anos', range: '10Y', interval: '1mo', months: 120 }
]);


const STOCK_COMPARISON_PERIODS = Object.freeze([
  { key: '2y', label: '2 A', range: '2Y', interval: '1mo', months: 24 },
  { key: '5y', label: '5 A', range: '5Y', interval: '1mo', months: 60 },
  { key: '10y', label: '10 A', range: '10Y', interval: '1mo', months: 120 }
]);

const STOCK_INDEX_BENCHMARKS = Object.freeze([
  { code: 'IBOV', label: 'IBOV', ticker: 'IBOV', yahooSymbol: '^BVSP', source: 'Yahoo Finance Chart API' },
  { code: 'IFIX', label: 'IFIX', ticker: 'IFIX', yahooSymbol: 'IFIX.SA', source: 'Yahoo Finance Chart API direto IFIX.SA' },
  { code: 'CDI', label: 'CDI', ticker: 'CDI', source: 'Banco Central SGS CDI' },
  { code: 'IPCA', label: 'IPCA', ticker: 'IPCA', source: 'Banco Central SGS IPCA' },
  { code: 'SMLL', label: 'SMLL', ticker: 'SMLL', yahooSymbol: 'SMLL.SA', source: 'Yahoo Finance Chart API direto SMLL.SA' },
  { code: 'IDIV', label: 'IDIV', ticker: 'IDIV', yahooSymbol: 'IDIV.SA', source: 'Yahoo Finance Chart API direto IDIV.SA' },
  { code: 'IVVB11', label: 'IVVB11', ticker: 'IVVB11', yahooSymbol: 'IVVB11.SA', source: 'Yahoo Finance Chart API' }
]);

const STOCK_BRENT_BENCHMARK = Object.freeze({ code: 'BRENT', label: 'Petróleo Brent', ticker: 'BZ=F', yahooSymbol: 'BZ=F', source: 'Yahoo Finance Chart API Brent Futures' });


const STOCK_FUNDAMENTAL_GROUPS = Object.freeze([
  { id: 'valuation', title: 'Valuation e múltiplos' },
  { id: 'margins', title: 'Margens e eficiência' },
  { id: 'profitability', title: 'Rentabilidade' },
  { id: 'debt', title: 'Endividamento e estrutura' },
  { id: 'growth', title: 'Crescimento' }
]);


const STOCK_BUY_HOLD_CHECKLIST_CRITERIA = Object.freeze([
  { id: 'listed_5y', label: 'Empresa com mais de 5 anos de Bolsa', variants: ['Empresa com mais de 5 anos de Bolsa'], help: 'Confere se a empresa possui histórico mínimo de negociação em Bolsa para uma leitura de longo prazo.' },
  { id: 'never_loss_fiscal', label: 'Empresa nunca deu prejuízo (ano fiscal)', variants: ['Empresa nunca deu prejuízo (ano fiscal)', 'Empresa nunca deu prejuizo (ano fiscal)'], help: 'Avalia a consistência anual de lucro. Quando não houver marcação explícita do Investidor10, o item fica sem check até haver evidência suficiente.' },
  { id: 'profit_20_quarters', label: 'Empresa com lucro nos últimos 20 trimestres (5 anos)', variants: ['Empresa com lucro nos últimos 20 trimestres (5 anos)', 'Empresa com lucro nos ultimos 20 trimestres (5 anos)'], help: 'Mede a recorrência de lucro trimestral nos últimos cinco anos.' },
  { id: 'dividends_5y_above_5', label: 'Empresa pagou +5% de dividendos/ano nos últimos 5 anos', variants: ['Empresa pagou +5% de dividendos/ano nos últimos 5 anos', 'Empresa pagou +5% de dividendos/ano nos ultimos 5 anos'], help: 'Verifica se a empresa manteve distribuição relevante de dividendos na janela de cinco anos.' },
  { id: 'roe_above_10', label: 'Empresa possui ROE acima de 10%', variants: ['Empresa possui ROE acima de 10%'], help: 'ROE acima de 10% indica retorno sobre patrimônio em nível mínimo para o filtro buy and hold.' },
  { id: 'debt_below_equity', label: 'Empresa possui dívida menor que patrimônio', variants: ['Empresa possui dívida menor que patrimônio', 'Empresa possui divida menor que patrimonio'], help: 'Compara dívida com patrimônio para identificar estrutura de capital menos pressionada.' },
  { id: 'revenue_growth_5y', label: 'Empresa apresentou crescimento de receita nos últimos 5 anos', variants: ['Empresa apresentou crescimento de receita nos últimos 5 anos', 'Empresa apresentou crescimento de receita nos ultimos 5 anos'], help: 'Usa crescimento de receita em cinco anos como sinal de expansão operacional.' },
  { id: 'profit_growth_5y', label: 'Empresa apresentou crescimento de lucros nos últimos 5 anos', variants: ['Empresa apresentou crescimento de lucros nos últimos 5 anos', 'Empresa apresentou crescimento de lucros nos ultimos 5 anos'], help: 'Usa crescimento de lucro em cinco anos como sinal de evolução de resultado.' },
  { id: 'daily_liquidity_2m_usd', label: 'Empresa possui liquidez diária acima de US$ 2M', variants: ['Empresa possui liquidez diária acima de US$ 2M', 'Empresa possui liquidez diaria acima de US$ 2M'], help: 'Indica negociação diária mínima para facilitar entrada e saída sem depender de baixa liquidez.' },
  { id: 'investidor10_user_rating', label: 'Empresa é bem avaliada pelos usuários do Investidor10', variants: ['Empresa é bem avaliada pelos usuários do Investidor10', 'Empresa e bem avaliada pelos usuarios do Investidor10'], help: 'Critério informativo baseado na avaliação de usuários do Investidor10.' }
]);

const STOCK_FUNDAMENTAL_SPECS = Object.freeze([
  { id: 'pl', label: 'P/L', group: 'valuation', valueKind: 'decimal', aliases: ['P\\s*/\\s*L', 'Preço\\s*/\\s*Lucro', 'Preco\\s*/\\s*Lucro'] },
  { id: 'psr', label: 'P/receita (PSR)', group: 'valuation', valueKind: 'decimal', aliases: ['P\\s*/\\s*receita\\s*\\(\\s*PSR\\s*\\)', 'PSR', 'P\\s*/\\s*Receita'] },
  { id: 'pvp', label: 'P/VP', group: 'valuation', valueKind: 'decimal', aliases: ['P\\s*/\\s*VP', 'PVP', 'Preço\\s*/\\s*Valor\\s*Patrimonial', 'Preco\\s*/\\s*Valor\\s*Patrimonial'] },
  { id: 'dividend_yield', label: 'Dividend Yield', group: 'valuation', valueKind: 'percent', aliases: ['Dividend\\s+Yield', 'DY'] },
  { id: 'payout', label: 'Payout', group: 'valuation', valueKind: 'percent', aliases: ['Payout'] },
  { id: 'margem_liquida', label: 'Margem Líquida', group: 'margins', valueKind: 'percent', aliases: ['Margem\\s+L[ií]quida'] },
  { id: 'margem_bruta', label: 'Margem Bruta', group: 'margins', valueKind: 'percent', aliases: ['Margem\\s+Bruta'] },
  { id: 'margem_ebit', label: 'Margem Ebit', group: 'margins', valueKind: 'percent', aliases: ['Margem\\s+Ebit(?!da)'] },
  { id: 'margem_ebitda', label: 'Margem Ebitda', group: 'margins', valueKind: 'percent', aliases: ['Margem\\s+Ebitda', 'Margem\\s+Ebtda'] },
  { id: 'ev_ebitda', label: 'EV/Ebitda', group: 'valuation', valueKind: 'decimal', aliases: ['EV\\s*/\\s*Ebitda', 'EV\\s*/\\s*Ebtda'] },
  { id: 'ev_ebit', label: 'EV/Ebit', group: 'valuation', valueKind: 'decimal', aliases: ['EV\\s*/\\s*Ebit(?!da)'] },
  { id: 'p_ebitda', label: 'P/Ebitda', group: 'valuation', valueKind: 'decimal', aliases: ['P\\s*/\\s*Ebitda', 'P\\s*/\\s*Ebtda'] },
  { id: 'p_ebit', label: 'P/Ebit', group: 'valuation', valueKind: 'decimal', aliases: ['P\\s*/\\s*Ebit(?!da)'] },
  { id: 'p_ativo', label: 'P/Ativo', group: 'valuation', valueKind: 'decimal', aliases: ['P\\s*/\\s*Ativo(?!\\s+Circ)'] },
  { id: 'p_cap_giro', label: 'P/Cap.Giro', group: 'valuation', valueKind: 'decimal', aliases: ['P\\s*/\\s*Cap\\.?\\s*Giro', 'P\\s*/\\s*Capital\\s+de\\s+Giro'] },
  { id: 'p_ativo_circ_liq', label: 'P/Ativo Circ. Liq.', group: 'valuation', valueKind: 'decimal', aliases: ['P\\s*/\\s*Ativo\\s+Circ\\.?\\s*L[ií]q\\.?', 'P\\s*/\\s*Ativo\\s+Circulante\\s+L[ií]quido'] },
  { id: 'vpa', label: 'VPA', group: 'valuation', valueKind: 'decimal', aliases: ['VPA', 'Valor\\s+Patrimonial\\s+por\\s+A[cç][aã]o'] },
  { id: 'lpa', label: 'LPA', group: 'valuation', valueKind: 'decimal', aliases: ['LPA', 'Lucro\\s+por\\s+A[cç][aã]o'] },
  { id: 'giro_ativos', label: 'Giro Ativos', group: 'margins', valueKind: 'decimal', aliases: ['Giro\\s+Ativos', 'Giro\\s+dos\\s+Ativos'] },
  { id: 'roe', label: 'ROE', group: 'profitability', valueKind: 'percent', aliases: ['ROE'] },
  { id: 'roic', label: 'ROIC', group: 'profitability', valueKind: 'percent', aliases: ['ROIC'] },
  { id: 'roa', label: 'ROA', group: 'profitability', valueKind: 'percent', aliases: ['ROA'] },
  { id: 'divida_liquida_patrimonio', label: 'Dívida Líquida / Patrimônio', group: 'debt', valueKind: 'decimal', aliases: ['D[ií]vida\\s+L[ií]quida\\s*/\\s*Patrim[oô]nio'] },
  { id: 'divida_liquida_ebitda', label: 'Dívida Líquida / Ebitda', group: 'debt', valueKind: 'decimal', aliases: ['D[ií]vida\\s+L[ií]quida\\s*/\\s*Ebitda', 'D[ií]vida\\s+L[ií]quida\\s*/\\s*Ebtda'] },
  { id: 'divida_liquida_ebit', label: 'Dívida Líquida / Ebit', group: 'debt', valueKind: 'decimal', aliases: ['D[ií]vida\\s+L[ií]quida\\s*/\\s*Ebit(?!da)'] },
  { id: 'divida_bruta_patrimonio', label: 'Dívida Bruta / Patrimônio', group: 'debt', valueKind: 'decimal', aliases: ['D[ií]vida\\s+Bruta\\s*/\\s*Patrim[oô]nio'] },
  { id: 'patrimonio_ativos', label: 'Patrimônio / Ativos', group: 'debt', valueKind: 'decimal', aliases: ['Patrim[oô]nio\\s*/\\s*Ativos'] },
  { id: 'passivos_ativos', label: 'Passivos / Ativos', group: 'debt', valueKind: 'decimal', aliases: ['Passivos\\s*/\\s*Ativos'] },
  { id: 'liquidez_corrente', label: 'Liquidez Corrente', group: 'debt', valueKind: 'decimal', aliases: ['Liquidez\\s+Corrente'] },
  { id: 'cagr_receitas_5_anos', label: 'CAGR Receitas 5 anos', group: 'growth', valueKind: 'percent', aliases: ['CAGR\\s+Receitas\\s+5\\s+anos', 'CAGR\\s+Receita\\s+5\\s+anos'] },
  { id: 'cagr_lucros_5_anos', label: 'CAGR Lucros 5 anos', group: 'growth', valueKind: 'percent', aliases: ['CAGR\\s+Lucros\\s+5\\s+anos', 'CAGR\\s+Lucro\\s+5\\s+anos'] }
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

function cleanText(value = '') {
  return htmlToPlainText(value)
    .replace(/\b(help_outline|info|open_in_new|content_copy|copiar|mais detalhes|ver detalhes)\b/gi, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[:–—•\s]+|[:–—•\s]+$/g, '')
    .trim();
}

function decodeEscapedUnicode(value = '') {
  return String(value || '')
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => {
      try { return String.fromCharCode(parseInt(hex, 16)); } catch { return ' '; }
    })
    .replace(/\\x([0-9a-fA-F]{2})/g, (_, hex) => {
      try { return String.fromCharCode(parseInt(hex, 16)); } catch { return ' '; }
    })
    .replace(/\\\//g, '/')
    .replace(/\\"/g, '"')
    .replace(/\\'/g, "'");
}

function stockRevenueSearchableText(html = '') {
  const source = String(html || '');
  if (!source) return '';
  const values = [];
  const revenueValueRe = /R\$\s*[\d.,]+\s*(?:Trilh|Bilh|Milh|mi\b|bi\b).*?\d{1,3}(?:[,.]\d+)?\s*%/i;
  const pushCandidate = (raw = '') => {
    const decoded = decodeEscapedUnicode(decodeHtmlEntities(raw));
    const plain = htmlToPlainText(decoded);
    if (!plain) return;
    if (/(REGI[ÕO]ES\s+ONDE\s+.*?GERA\s+RECEITA|NEG[ÓO]CIOS\s+QUE\s+GERAM\s+RECEITA)/i.test(plain) || revenueValueRe.test(plain)) {
      values.push(plain);
    }
  };

  const attrRe = /\b(?:content|alt|title|aria-label|data-[a-z0-9_-]+)=(['"])([\s\S]*?)\1/gi;
  for (const match of source.matchAll(attrRe)) {
    pushCandidate(match[2]);
  }

  const scriptRe = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
  for (const match of source.matchAll(scriptRe)) {
    const raw = match[1] || '';
    const decodedScript = decodeEscapedUnicode(raw);
    if (!/(REGI[ÕO]ES\s+ONDE|NEG[ÓO]CIOS\s+QUE\s+GERAM|gera\s+receita)/i.test(decodedScript) && !revenueValueRe.test(decodedScript)) continue;
    const markers = [/REGI[ÕO]ES\s+ONDE/ig, /NEG[ÓO]CIOS\s+QUE\s+GERAM/ig, /gera\s+receita/ig];
    for (const marker of markers) {
      for (const markerMatch of decodedScript.matchAll(marker)) {
        const start = Math.max(0, markerMatch.index - 500);
        const end = Math.min(decodedScript.length, markerMatch.index + 6000);
        pushCandidate(decodedScript.slice(start, end));
      }
    }
  }

  return cleanText(values.join(' '));
}

function parseBrNumber(value = '') {
  const raw = String(value || '')
    .replace(/R\$/gi, '')
    .replace(/%/g, '')
    .replace(/\b(?:Bilhões|Bilhoes|Bilhão|Bilhao|Milhões|Milhoes|Milhão|Milhao|mi|M|bi|B|mil|K)\b/gi, '')
    .replace(/\s+/g, '')
    .trim();
  if (!raw || raw === '-' || raw === '—') return null;
  const dotCount = (raw.match(/\./g) || []).length;
  const normalized = raw.includes(',')
    ? raw.replace(/\./g, '').replace(',', '.')
    : (dotCount > 1 ? raw.replace(/\./g, '') : raw);
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

function finiteNumberOrNull(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' && !value.trim()) return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function formatMoney(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatNumber(value, digits = 2) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function formatPercent(value, signed = false) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  const sign = signed && n > 0 ? '+' : '';
  return `${sign}${n.toFixed(2).replace('.', ',')}%`;
}

function escapeRegExp(value = '') {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function compactKey(value = '') {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function metricId(label = '') {
  return String(label || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '') || 'metric';
}

function stockTickerIdentityOk(html = '', finalUrl = '', ticker = '') {
  const symbol = String(ticker || '').toUpperCase();
  if (!symbol) return false;
  const url = String(finalUrl || '');
  if (url && new RegExp(`/acoes/${escapeRegExp(symbol.toLowerCase())}(?:/|$|[?#])`, 'i').test(url)) return true;
  const plain = htmlToPlainText(html).slice(0, 9000);
  if (new RegExp(`\\b${escapeRegExp(symbol)}\\b`, 'i').test(plain)) return true;
  const base = symbol.replace(/\d+$/, '');
  if (base.length >= 4 && new RegExp(`\\b${escapeRegExp(base)}[34]?\\b`, 'i').test(plain)) return true;
  return false;
}


function pickStockScopedPlainSection(plain = '', ticker = '', maxLen = 5200) {
  const text = String(plain || '').replace(/\s+/g, ' ');
  const symbol = String(ticker || '').toUpperCase();
  if (!symbol) return '';
  const escaped = escapeRegExp(symbol);
  const candidates = [
    new RegExp(`\\b${escaped}\\b\\s+(?:Cota[çc][ãa]o|Preço|Preco)`, 'i'),
    new RegExp(`(?:Cota[çc][ãa]o|Preço|Preco)\\s+(?:de\\s+)?\\b${escaped}\\b`, 'i'),
    new RegExp(`\\b${escaped}\\b[^.]{0,220}?(?:P\\s*/\\s*L|P\\s*/\\s*VP|Dividend\\s+Yield|VARIA[ÇC][ÃA]O)`, 'i'),
    new RegExp(`(?:INDICADORES\\s+FUNDAMENTALISTAS|CONFIRA\\s+OS\\s+FUNDAMENTOS)[^.]{0,220}?\\b${escaped}\\b`, 'i'),
    new RegExp(`\\b${escaped}\\b`, 'i')
  ];
  for (const re of candidates) {
    const index = text.search(re);
    if (index >= 0) return text.slice(Math.max(0, index - 350), index + maxLen);
  }
  return '';
}


function updateFactsWithResolvedQuote(facts = [], { priceDisplay = '', variation12mDisplay = '' } = {}) {
  const byId = new Map((facts || []).filter(Boolean).map(item => [String(item.id || metricId(item.label || '')).toLowerCase(), { ...item }]));
  if (priceDisplay) byId.set('quote', { ...(byId.get('quote') || { id: 'quote', label: 'Cotação' }), value: priceDisplay });
  if (variation12mDisplay) byId.set('variation_12m', { ...(byId.get('variation_12m') || { id: 'variation_12m', label: 'Variação 12M' }), value: variation12mDisplay });
  return Array.from(byId.values());
}

function withResolvedStockCompanyProfile(profile = {}, resolved = {}) {
  if (!profile || typeof profile !== 'object') return profile;
  return {
    ...profile,
    facts: updateFactsWithResolvedQuote(profile.facts || [], resolved)
  };
}

function stockPageIdentityDiagnostics(html = '', finalUrl = '', ticker = '') {
  const symbol = String(ticker || '').toUpperCase();
  const plain = htmlToPlainText(html).slice(0, 3000);
  return {
    requestedTicker: symbol,
    finalUrl: finalUrl || '',
    symbolFoundInPageHead: symbol ? new RegExp(`\\b${escapeRegExp(symbol)}\\b`, 'i').test(plain) : false,
    urlMatchesTicker: Boolean(finalUrl && symbol && new RegExp(`/acoes/${escapeRegExp(symbol.toLowerCase())}(?:/|$|[?#])`, 'i').test(finalUrl))
  };
}



function normalizeLooseText(value = '') {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\b(?:help_outline|info|open_in_new|content_copy|copiar|mais detalhes|ver detalhes)\b/gi, ' ')
    .replace(/[^a-z0-9%$]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function statusLabelFromPassed(passed) {
  return passed === true ? 'Atende' : (passed === false ? 'Não atende' : 'Não informado');
}

function statusCodeFromPassed(passed) {
  return passed === true ? 'PASSED' : (passed === false ? 'FAILED' : 'UNKNOWN');
}

function emptyStockBuyHoldChecklist(ticker = '', diagnostics = {}) {
  const symbol = String(ticker || '').toUpperCase();
  return {
    id: 'stock_buy_hold_checklist',
    title: symbol ? `Checklist do Investidor Buy and Hold sobre ${symbol}` : 'Checklist do Investidor Buy and Hold',
    subtitle: 'Critérios de qualidade do Investidor10 para leitura buy and hold da ação.',
    status: 'EMPTY',
    source: 'Investidor10',
    sourceUrl: symbol ? `https://investidor10.com.br/acoes/${symbol.toLowerCase()}/` : undefined,
    total: 0,
    passed: 0,
    failed: 0,
    unknown: 0,
    items: [],
    disclaimer: '',
    diagnostics
  };
}

// Checklist de ação não deriva status por fundamentos locais.
// Os checkboxes devem refletir apenas a marcação pública do Investidor10.
function detectStockChecklistPassed(rawWindow = '', plainWindow = '', criterionId = '') {
  const raw = String(rawWindow || '');
  const combined = `${normalizeLooseText(rawWindow)} ${normalizeLooseText(plainWindow)}`;
  const hasExplicitNegative = /\b(?:nao atende|n[aã]o atende|reprovado|reprovada|falhou|negativo|unchecked|uncheck|not checked|check box outline blank|close|cancel|times|xmark|fa times|fa xmark|icon x|icon close|is unchecked|status false|false|disabled)\b/.test(combined)
    || /(?:class|data-[a-z-]+|aria-label|title)\s*=\s*["'][^"']*(?:unchecked|uncheck|fail|failed|false|negative|danger|muted|gray|grey|times|xmark|close|cancel)[^"']*["']/i.test(raw);
  if (hasExplicitNegative) return false;
  const hasExplicitPositive = /\b(?:check circle|check_circle|checked|check box|fa check|icon check|material icons check|is checked|status true|aprovado|aprovada|atende|positivo|success|done|true|sim)\b/.test(combined)
    || /(?:class|data-[a-z-]+|aria-label|title)\s*=\s*["'][^"']*(?:checked|check-circle|check_circle|checkmark|check-mark|fa-check|icon-check|success|positive|passed|approved|true)[^"']*["']/i.test(raw)
    || /✓|✔|☑/.test(rawWindow);
  if (hasExplicitPositive) return true;
  return undefined;
}

function extractStockChecklistDisclaimer(section = '') {
  const normalized = cleanText(section).replace(/\s{2,}/g, ' ');
  const match = normalized.match(/Esta ferramenta de checklist[\s\S]{0,620}?(?:clique aqui\s*\.|clique aqui\.|futuros\.|futuro\.|$)/i);
  return cleanText(match?.[0] || '').replace(/\s{2,}/g, ' ').slice(0, 640);
}

function stockChecklistFundamentalNumber(fundamentalIndicators = {}, id = '') {
  const item = (fundamentalIndicators?.items || []).find(row => row?.id === id || metricId(row?.label || '') === id);
  if (!item) return null;
  const direct = finiteNumberOrNull(item.numericValue);
  if (direct !== null) return direct;
  const parsed = parseBrNumber(item.value || item.displayValue || '');
  return finiteNumberOrNull(parsed);
}

function extractStockChecklistCompanyFacts(html = '') {
  const plain = htmlToPlainText(html).replace(/\s+/g, ' ');
  const debutYear = Number(plain.match(/Ano\s+de\s+estreia\s+na\s+bolsa\s*:?\s*(\d{4})/i)?.[1]);
  const foundingYear = Number(plain.match(/Ano\s+de\s+funda[çc][ãa]o\s*:?\s*(\d{4})/i)?.[1]);
  const liquidityMatch = plain.match(/Liquidez\s+M[ée]dia\s+Di[áa]ria\s+((?:R\$\s*)?[+-]?\d{1,3}(?:\.\d{3})*(?:,\d+)?\s*(?:Bilhões|Bilhoes|Bilhão|Bilhao|Milhões|Milhoes|Milhão|Milhao|mi|M|bi|B|mil|K)?)(?:\s+(R\$\s*[+-]?\d{1,3}(?:\.\d{3})*(?:,\d+)?))?/i);
  const liquidityDisplay = cleanText(liquidityMatch?.[2] || liquidityMatch?.[1] || '');
  const liquidity = liquidityDisplay ? compactMoneyFromDisplay(liquidityDisplay) : null;
  const ratingDisplay = cleanText(plain.match(/M[ée]dia\s+de\s+avalia[çc][õo]es\s+dos\s+usu[áa]rios\s*:?\s*([\d,.]+\s*(?:\/\s*5)?)/i)?.[1] || '');
  const rating = parseBrNumber(ratingDisplay);
  return {
    debutYear: Number.isFinite(debutYear) ? debutYear : null,
    foundingYear: Number.isFinite(foundingYear) ? foundingYear : null,
    dailyLiquidity: finiteNumberOrNull(liquidity),
    dailyLiquidityDisplay: liquidityDisplay,
    userRating: finiteNumberOrNull(rating),
    userRatingDisplay: ratingDisplay
  };
}


function stockFinancialPointNetIncome(point = {}) {
  return firstFiniteNumberFromKeys(point, ['netProfit', 'netIncome', 'profit', 'lucro', 'lucroLiquido', 'lucro_liquido', 'resultado', 'value', 'valor']);
}

function stockChecklistProfitEvidence(canonical = {}) {
  const sources = [
    ...(Array.isArray(canonical?.financial?.incomeStatement) ? canonical.financial.incomeStatement : []),
    ...(Array.isArray(canonical?.financial?.revenueProfit) ? canonical.financial.revenueProfit : []),
    ...(Array.isArray(canonical?.financial?.profitVsQuote) ? canonical.financial.profitVsQuote : [])
  ];
  const annual = [];
  const quarterly = [];
  const seen = new Set();
  for (const point of sources) {
    const meta = financialPointYear(point || {});
    const income = stockFinancialPointNetIncome(point || {});
    if (!meta.label || finiteNumberOrNull(income) === null) continue;
    const key = `${meta.label}|${income}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const target = /T|TRI|Q/i.test(String(meta.period || meta.label || '')) ? quarterly : annual;
    target.push({ label: meta.label, year: meta.year, netIncome: Number(income) });
  }
  const sortDesc = (a, b) => (Number(b.year) || 0) - (Number(a.year) || 0) || String(b.label).localeCompare(String(a.label), 'pt-BR', { numeric: true });
  annual.sort(sortDesc);
  quarterly.sort(sortDesc);
  const last5Annual = annual.filter(point => Number.isFinite(Number(point.year))).slice(0, 5);
  const last20Quarterly = quarterly.slice(0, 20);
  return {
    annual,
    quarterly,
    last5AnnualPositive: last5Annual.length >= 5 ? last5Annual.every(point => point.netIncome > 0) : null,
    last20QuarterlyPositive: last20Quarterly.length >= 20 ? last20Quarterly.every(point => point.netIncome > 0) : null,
    annualCount: annual.length,
    quarterlyCount: quarterly.length
  };
}

function parseStockBuyHoldRankingRowFromPlain(plain = '', ticker = '') {
  const symbol = String(ticker || '').toUpperCase();
  if (!symbol) return null;
  const text = htmlToPlainText(plain).replace(/\s+/g, ' ');
  const start = text.search(/Pontua[çc][ãa]o\s+Buy\s+And\s+Hold/i);
  const haystack = text.slice(start >= 0 ? start : 0);
  const symbolRe = escapeRegExp(symbol);
  const rowRe = new RegExp(`(?:^|\\s)#\\s*\\d+\\s+${symbolRe}\\b([\\s\\S]{0,2200}?)(?=(?:\\s+#\\s*\\d+\\s+[A-Z]{4}\\d{1,2}\\b)|##\\s+Rankings|O ranking de Ações Buy and Hold|$)`, 'i');
  const match = haystack.match(rowRe);
  if (!match) return null;
  const segment = `${symbol} ${match[1] || ''}`.replace(/\s+/g, ' ').trim();
  const afterSymbol = segment.replace(new RegExp(`^${symbolRe}\\b`, 'i'), '').trim();
  const scoreMatch = afterSymbol.match(/\b(100|[1-9]0|0)\b/);
  if (!scoreMatch) return null;
  const tail = afterSymbol.slice(scoreMatch.index || 0);
  const tokens = tail.match(/(?:R\$\s*)?[+-]?\d{1,3}(?:\.\d{3})*(?:,\d+)?\s*(?:%|Bilhões|Bilhoes|Bilhão|Bilhao|Milhões|Milhoes|Milhão|Milhao|mi|M|bi|B)?|-|—/gi) || [];
  const valueAt = (index) => cleanText(tokens[index] || '');
  const numberAt = (index) => {
    const raw = valueAt(index);
    const n = /R\$|Bil|Milh|\b[BM]\b/i.test(raw) ? compactMoneyFromDisplay(raw) : parseBrNumber(raw);
    return finiteNumberOrNull(n);
  };
  const score = numberAt(0);
  if (score === null) return null;
  return {
    ticker: symbol,
    score: Number(score),
    scoreDisplay: valueAt(0),
    pl: numberAt(1),
    pvp: numberAt(2),
    dividendYield: numberAt(3),
    dyAverage5y: numberAt(4),
    roe: numberAt(13),
    marginLiquid: numberAt(14),
    marketValue: numberAt(15),
    equity: numberAt(16),
    netIncome: numberAt(17),
    revenue: numberAt(18),
    cagrRevenue5y: numberAt(19),
    cagrProfit5y: numberAt(20),
    cash: numberAt(21),
    grossDebtEquity: numberAt(22),
    source: 'Investidor10 ranking buy and hold',
    sourceUrl: 'https://investidor10.com.br/acoes/rankings/buy-and-hold/',
    diagnostics: { tokens: tokens.slice(0, 24), segment: segment.slice(0, 900) }
  };
}

function parseStockBuyHoldRankingRowFromHtml(html = '', ticker = '') {
  return parseStockBuyHoldRankingRowFromPlain(htmlToPlainText(html), ticker);
}

async function fetchInvestidor10StockBuyHoldRanking(ticker = '', timeoutMs = 3600) {
  const symbol = String(ticker || '').toUpperCase();
  if (!symbol) return null;
  const base = 'https://investidor10.com.br/acoes/rankings/buy-and-hold/';
  const urls = [base, `${base}?page=2`, `${base}?page=3`];
  const responses = await Promise.all(urls.map(url => fetchText(url, {
    timeoutMs: Math.min(3000, Math.max(1400, Number(timeoutMs) || 2400)),
    ttlMs: 15 * 60 * 1000,
    staleMs: 12 * 60 * 60 * 1000,
    retries: 0,
    headers: {
      'User-Agent': process.env.VALORAE_USER_AGENT || 'Mozilla/5.0',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      Referer: `https://investidor10.com.br/acoes/${symbol.toLowerCase()}/`
    }
  }).catch(error => ({ text: '', status: 0, error: error?.message || String(error), url }))));
  for (let i = 0; i < responses.length; i += 1) {
    const response = responses[i] || {};
    const row = parseStockBuyHoldRankingRowFromHtml(response.text || '', symbol);
    if (row) return { ...row, status: 'OK', fetchStatus: response.status || 0, sourceUrl: urls[i] };
  }
  return { ticker: symbol, status: 'EMPTY', source: 'Investidor10 ranking buy and hold', sourceUrl: base };
}

function deriveStockChecklistStatusFromInvestidor10({ criterionId = '', html = '', fundamentalIndicators = {}, canonical = {}, buyHoldRanking = null } = {}) {
  const ranking = buyHoldRanking && buyHoldRanking.status === 'OK' ? buyHoldRanking : null;
  if (Number(ranking?.score) === 100) {
    return { passed: true, source: 'Investidor10 ranking buy and hold', evidence: 'Pontuação Buy And Hold 100/100 no ranking oficial' };
  }
  const facts = extractStockChecklistCompanyFacts(html);
  const profits = stockChecklistProfitEvidence(canonical);
  const currentYear = new Date().getFullYear();
  const metric = (id) => stockChecklistFundamentalNumber(fundamentalIndicators, id);
  const pick = (...values) => values.find(value => finiteNumberOrNull(value) !== null);
  const valueResult = (value, threshold, comparator, source, display = '') => {
    const n = finiteNumberOrNull(value);
    if (n === null) return { passed: null, source, evidence: 'sem_valor_real_suficiente' };
    const passed = comparator === '<' ? n < threshold : n >= threshold;
    return { passed, source, evidence: display || `${formatNumber(n, 2)} ${comparator} ${formatNumber(threshold, 2)}` };
  };
  switch (criterionId) {
    case 'listed_5y': {
      const year = facts.debutYear || facts.foundingYear;
      if (finiteNumberOrNull(year) === null) return { passed: null, source: 'Investidor10 dados da empresa', evidence: 'ano_de_estreia_indisponivel' };
      return { passed: currentYear - Number(year) >= 5, source: 'Investidor10 dados da empresa', evidence: `Ano de estreia/fundação ${year}` };
    }
    case 'never_loss_fiscal': {
      if (profits.annual.length >= 8) return { passed: profits.annual.every(point => point.netIncome > 0), source: 'Investidor10 resultados anuais', evidence: `${profits.annual.length} anos com lucro líquido capturado` };
      return { passed: null, source: 'Investidor10 resultados anuais', evidence: 'historico_anual_completo_indisponivel' };
    }
    case 'profit_20_quarters': {
      if (profits.last20QuarterlyPositive !== null) return { passed: profits.last20QuarterlyPositive, source: 'Investidor10 resultados trimestrais', evidence: 'últimos 20 trimestres capturados' };
      if (profits.last5AnnualPositive !== null) return { passed: profits.last5AnnualPositive, source: 'Investidor10 resultados anuais', evidence: 'últimos 5 anos anuais capturados' };
      return { passed: null, source: 'Investidor10 resultados', evidence: 'historico_de_lucros_insuficiente' };
    }
    case 'dividends_5y_above_5': {
      const value = pick(ranking?.dyAverage5y, metric('dividend_yield'));
      return valueResult(value, 5, '>=', ranking?.dyAverage5y != null ? 'Investidor10 ranking buy and hold' : 'Investidor10 indicadores fundamentalistas', finiteNumberOrNull(value) !== null ? `DY médio/atual ${formatPercent(value, false)}` : '');
    }
    case 'roe_above_10': {
      const value = pick(ranking?.roe, metric('roe'));
      return valueResult(value, 10, '>=', ranking?.roe != null ? 'Investidor10 ranking buy and hold' : 'Investidor10 indicadores fundamentalistas', finiteNumberOrNull(value) !== null ? `ROE ${formatPercent(value, false)}` : '');
    }
    case 'debt_below_equity': {
      const value = pick(ranking?.grossDebtEquity, metric('divida_bruta_patrimonio'));
      return valueResult(value, 1, '<', ranking?.grossDebtEquity != null ? 'Investidor10 ranking buy and hold' : 'Investidor10 indicadores fundamentalistas', finiteNumberOrNull(value) !== null ? `Dívida Bruta/Patrimônio ${formatNumber(value, 2)}` : '');
    }
    case 'revenue_growth_5y': {
      const value = pick(ranking?.cagrRevenue5y, metric('cagr_receitas_5_anos'));
      return valueResult(value, 10, '>=', ranking?.cagrRevenue5y != null ? 'Investidor10 ranking buy and hold' : 'Investidor10 indicadores fundamentalistas', finiteNumberOrNull(value) !== null ? `CAGR Receita 5 anos ${formatPercent(value, false)}` : '');
    }
    case 'profit_growth_5y': {
      const value = pick(ranking?.cagrProfit5y, metric('cagr_lucros_5_anos'));
      return valueResult(value, 10, '>=', ranking?.cagrProfit5y != null ? 'Investidor10 ranking buy and hold' : 'Investidor10 indicadores fundamentalistas', finiteNumberOrNull(value) !== null ? `CAGR Lucro 5 anos ${formatPercent(value, false)}` : '');
    }
    case 'daily_liquidity_2m_usd': {
      const value = pick(facts.dailyLiquidity, ranking?.marketValue);
      return valueResult(value, 50_000_000, '>=', facts.dailyLiquidity != null ? 'Investidor10 informações sobre a empresa' : 'Investidor10 ranking buy and hold', facts.dailyLiquidityDisplay ? `Liquidez média diária ${facts.dailyLiquidityDisplay}` : '');
    }
    case 'investidor10_user_rating': {
      if (finiteNumberOrNull(facts.userRating) !== null) return valueResult(facts.userRating, 4, '>=', 'Investidor10 avaliação dos usuários', facts.userRatingDisplay || '');
      // Não inferimos avaliação dos usuários por pontuação parcial do ranking.
      // A única exceção já tratada acima é o 100/100 oficial, pois no método do Investidor10
      // cada um dos 10 critérios cumpridos vale 10 pontos.
      return { passed: null, source: 'Investidor10 avaliação dos usuários', evidence: 'avaliacao_indisponivel' };
    }
    default:
      return { passed: null, source: 'Investidor10', evidence: 'criterio_desconhecido' };
  }
}


function parseBrDateToIso(value = '') {
  const match = String(value || '').match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!match) return '';
  const [, day, month, year] = match;
  return `${year}-${month}-${day}`;
}

function formatBrDateDisplay(value = '') {
  const raw = String(value || '').trim();
  if (/\d{2}\/\d{2}\/\d{4}/.test(raw)) return raw.match(/\d{2}\/\d{2}\/\d{4}/)?.[0] || raw;
  const iso = raw.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  return raw || '—';
}

function normalizeStockDividendType(value = '') {
  const clean = cleanText(value).replace(/\s+/g, ' ').trim();
  if (/rend/i.test(clean) && /trib/i.test(clean)) return 'Rend. Trib.';
  if (/jscp|jcp|juros/i.test(clean)) return 'JSCP';
  if (/dividend/i.test(clean)) return 'Dividendos';
  return clean || 'Dividendos';
}

function normalizeStockDividendEvent(raw = {}, ticker = '') {
  if (!raw || typeof raw !== 'object') return null;
  const type = normalizeStockDividendType(raw.type || raw.tipo || raw.kind || raw.event || raw.dividendType || raw.label || 'Dividendos');
  const dataComRaw = raw.dataCom || raw.dateCom || raw.comDate || raw.data_com || raw.date || raw.referenceDate || raw.exDate || '';
  const paymentRaw = raw.paymentDate || raw.payDate || raw.pagamento || raw.dataPagamento || raw.payment || raw.paidAt || '';
  const valueRaw = raw.value ?? raw.amount ?? raw.valor ?? raw.valuePerShare ?? raw.dividend ?? raw.provento;
  const value = finiteNumberOrNull(valueRaw) ?? parseBrNumber(valueRaw);
  const dataCom = String(dataComRaw).includes('/') ? parseBrDateToIso(dataComRaw) : String(dataComRaw || '').slice(0, 10);
  const paymentDate = String(paymentRaw).includes('/') ? parseBrDateToIso(paymentRaw) : String(paymentRaw || '').slice(0, 10);
  if (!dataCom && !paymentDate && finiteNumberOrNull(value) === null) return null;
  const valueDisplay = raw.valueDisplay || raw.amountDisplay || raw.valorDisplay || (finiteNumberOrNull(value) !== null ? String(value).replace('.', ',') : '—');
  return {
    ticker: String(raw.ticker || ticker || '').toUpperCase(),
    type,
    dataCom,
    dataComDisplay: formatBrDateDisplay(dataComRaw || dataCom),
    paymentDate,
    paymentDateDisplay: formatBrDateDisplay(paymentRaw || paymentDate),
    value: finiteNumberOrNull(value) === null ? null : round(Number(value), 8),
    valueDisplay,
    source: raw.source || 'Investidor10 histórico de dividendos'
  };
}

function extractStockDividendEventsFromHtml(html = '', ticker = '') {
  const plain = htmlToPlainText(html);
  const start = plain.search(/Hist[óo]rico\s+de\s+Dividendos/i);
  if (start < 0) return [];
  let section = plain.slice(start, start + 26000);
  const end = section.search(/COMPARADOR\s+DE\s+A[ÇC][ÕO]ES|Regi[õo]es\s+onde|neg[oó]cios\s+que|POSI[ÇC][ÃA]O\s+ACION[ÁA]RIA|Receitas\s+e\s+Lucros|Resultados\s+/i);
  if (end > 900) section = section.slice(0, end);
  const events = [];
  const re = /\b(JSCP|JCP|Dividendos?|Rend\.?\s*Trib\.?|Rendimento\s+Trib\.?|Bonifica[çc][aã]o)\s+(\d{2}\/\d{2}\/\d{4})\s+(\d{2}\/\d{2}\/\d{4})\s+([+-]?\d+(?:[,.]\d+)?)/gi;
  let match;
  while ((match = re.exec(section)) && events.length < 240) {
    const event = normalizeStockDividendEvent({
      ticker,
      type: match[1],
      dataCom: match[2],
      paymentDate: match[3],
      value: parseBrNumber(match[4]),
      valueDisplay: match[4],
      source: 'Investidor10 HTML histórico de dividendos'
    }, ticker);
    if (event) events.push(event);
  }
  return events;
}

function stockDividendPointFromAggregate(raw = {}, fallbackFrequency = 'yearly') {
  if (!raw || typeof raw !== 'object') return null;
  const year = Number(raw.year ?? raw.ano ?? String(raw.period || raw.label || '').match(/\d{4}/)?.[0]);
  const month = Number(raw.month ?? raw.mes ?? raw.mês ?? null);
  const value = Number(raw.value ?? raw.amount ?? raw.total ?? raw.valor ?? raw.y ?? raw.dividend ?? raw.dividends ?? raw.provento);
  if (!Number.isFinite(value)) return null;
  const period = String(raw.period || raw.key || raw.date || raw.label || (Number.isFinite(year) ? (Number.isFinite(month) && month > 0 ? `${year}-${String(month).padStart(2, '0')}` : String(year)) : '')).trim();
  return {
    period: period || `${fallbackFrequency}-${Math.random().toString(16).slice(2)}`,
    label: String(raw.label || period || (Number.isFinite(year) ? String(year) : 'Atual')),
    date: raw.date || (Number.isFinite(year) ? `${year}-${String(Number.isFinite(month) && month > 0 ? month : 12).padStart(2, '0')}-01` : undefined),
    year: Number.isFinite(year) ? year : undefined,
    month: Number.isFinite(month) && month > 0 ? month : undefined,
    value: round(value, 6),
    valueDisplay: raw.valueDisplay || raw.amountDisplay || raw.valorDisplay || (fallbackFrequency === 'yearly' ? formatNumber(value, 2) : formatNumber(value, 4)),
    yieldPercent: finiteNumberOrNull(raw.yieldPercent ?? raw.dy ?? raw.dividendYield) === null ? undefined : round(Number(raw.yieldPercent ?? raw.dy ?? raw.dividendYield), 6),
    yieldDisplay: raw.yieldDisplay || raw.dyDisplay || raw.percentDisplay || '',
    source: raw.source || 'Investidor10'
  };
}

function aggregateStockDividendEventsByYear(events = []) {
  const map = new Map();
  for (const event of events) {
    const date = event.paymentDate || event.dataCom || '';
    const year = Number(String(date).slice(0, 4));
    const value = Number(event.value);
    if (!Number.isFinite(year) || !Number.isFinite(value)) continue;
    map.set(year, (map.get(year) || 0) + value);
  }
  return Array.from(map.entries()).sort((a, b) => a[0] - b[0]).map(([year, value]) => ({
    period: String(year),
    label: String(year),
    year,
    value: round(value, 8),
    valueDisplay: formatNumber(value, 6),
    source: 'Investidor10 histórico de dividendos agregado por ano'
  }));
}

function stockYieldPointFromRaw(raw = {}) {
  const base = stockDividendPointFromAggregate(raw, 'yearly');
  if (!base) return null;
  const value = Number(raw.yieldPercent ?? raw.dy ?? raw.dividendYield ?? raw.value ?? raw.y ?? base.value);
  if (!Number.isFinite(value)) return null;
  return {
    ...base,
    value: round(value, 6),
    valueDisplay: raw.valueDisplay || raw.yieldDisplay || raw.dyDisplay || formatPercent(value),
    yieldPercent: round(value, 6),
    yieldDisplay: raw.yieldDisplay || raw.dyDisplay || raw.valueDisplay || formatPercent(value),
    source: raw.source || 'Investidor10 Dividend Yield histórico'
  };
}

function deriveStockYieldFromDividends(dividendPoints = [], referencePrice = null) {
  const price = Number(referencePrice);
  if (!Number.isFinite(price) || price <= 0) return [];
  return dividendPoints.map(point => ({
    ...point,
    value: round((Number(point.value) / price) * 100, 6),
    valueDisplay: formatPercent((Number(point.value) / price) * 100),
    yieldPercent: round((Number(point.value) / price) * 100, 6),
    yieldDisplay: formatPercent((Number(point.value) / price) * 100),
    source: 'Investidor10 dividendos + cotação de referência'
  })).filter(point => Number.isFinite(Number(point.value)));
}

function extractStockAverageDy5y(html = '') {
  const plain = htmlToPlainText(html);
  const value = plain.match(/DY\s+m[eé]dio\s+em\s+5\s+anos\s*:?\s*([+-]?\d{1,4}(?:[,.]\d+)?\s*%)/i)?.[1] || '';
  return { display: value.replace(/\s+/g, ''), value: parseBrNumber(value) };
}


const STOCK_RADAR_MONTHS = Object.freeze([
  { key: 'jan', label: 'Jan', month: 1 },
  { key: 'fev', label: 'Fev', month: 2 },
  { key: 'mar', label: 'Mar', month: 3 },
  { key: 'abr', label: 'Abr', month: 4 },
  { key: 'mai', label: 'Mai', month: 5 },
  { key: 'jun', label: 'Jun', month: 6 },
  { key: 'jul', label: 'Jul', month: 7 },
  { key: 'ago', label: 'Ago', month: 8 },
  { key: 'set', label: 'Set', month: 9 },
  { key: 'out', label: 'Out', month: 10 },
  { key: 'nov', label: 'Nov', month: 11 },
  { key: 'dez', label: 'Dez', month: 12 }
]);

function isoMonth(value = '') {
  const raw = String(value || '').trim();
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return Number(iso[2]);
  const br = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (br) return Number(br[2]);
  return null;
}

function isoYear(value = '') {
  const raw = String(value || '').trim();
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return Number(iso[1]);
  const br = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (br) return Number(br[3]);
  return null;
}

function formatMoneyAbbrev(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  const abs = Math.abs(n);
  const dec = (v, d = 2) => v.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
  if (abs >= 1_000_000_000) return `${dec(n / 1_000_000_000, 2)}B`;
  if (abs >= 1_000_000) return `${dec(n / 1_000_000, 2)}M`;
  if (abs >= 1_000) return `${dec(n / 1_000, 2)}K`;
  return dec(n, 2);
}

function buildStockDividendRadarPayload({ ticker = '', dividendHistory = {} } = {}) {
  const events = Array.isArray(dividendHistory?.events) ? dividendHistory.events : [];
  const dateComCounts = new Map();
  const paymentCounts = new Map();
  const dateComYears = new Map();
  const paymentYears = new Map();
  const addMonthStat = (counts, years, month, year) => {
    if (!month) return;
    counts.set(month, (counts.get(month) || 0) + 1);
    if (year) {
      if (!years.has(month)) years.set(month, new Set());
      years.get(month).add(year);
    }
  };
  for (const event of events) {
    const dcRaw = event.dataCom || event.dateCom || event.dataComDisplay || '';
    const pgRaw = event.paymentDate || event.payDate || event.paymentDateDisplay || '';
    addMonthStat(dateComCounts, dateComYears, isoMonth(dcRaw), isoYear(dcRaw));
    addMonthStat(paymentCounts, paymentYears, isoMonth(pgRaw), isoYear(pgRaw));
  }
  const maxDateComYears = Math.max(1, ...[...dateComYears.values()].map(set => set.size));
  const maxPaymentYears = Math.max(1, ...[...paymentYears.values()].map(set => set.size));
  const months = STOCK_RADAR_MONTHS.map(item => {
    const dcYears = dateComYears.get(item.month)?.size || 0;
    const pgYears = paymentYears.get(item.month)?.size || 0;
    return {
      ...item,
      activeDateCom: (dateComCounts.get(item.month) || 0) > 0,
      activePayment: (paymentCounts.get(item.month) || 0) > 0,
      dateComCount: dateComCounts.get(item.month) || 0,
      paymentCount: paymentCounts.get(item.month) || 0,
      dateComYears: dcYears,
      paymentYears: pgYears,
      dateComScore: round(dcYears / maxDateComYears, 4),
      paymentScore: round(pgYears / maxPaymentYears, 4)
    };
  });
  const activeDateCom = months.filter(item => item.activeDateCom).length;
  const activePayment = months.filter(item => item.activePayment).length;
  return {
    id: 'stock_dividend_radar',
    title: `Radar de Dividendos Inteligente para ${String(ticker || '').toUpperCase()}`.trim(),
    ticker: String(ticker || '').toUpperCase(),
    status: events.length ? 'OK' : 'EMPTY',
    source: 'Investidor10 histórico de proventos',
    description: `Com base no histórico de proventos da ${String(ticker || '').toUpperCase()}, o Radar de Dividendos Inteligente projeta quais os possíveis meses de pagamentos de proventos no futuro.`,
    defaultMode: 'dateCom',
    modes: [
      { key: 'dateCom', label: 'Data Com' },
      { key: 'paymentDate', label: 'Data Pagamento' }
    ],
    months,
    activeDateCom,
    activePayment,
    actionLabel: 'Ver radar completo',
    actionUrl: `https://investidor10.com.br/acoes/${String(ticker || '').toLowerCase()}/`,
    diagnostics: {
      events: events.length,
      derivedFrom: 'dividendHistory.events',
      activeDateCom,
      activePayment,
      dateComCounts: Object.fromEntries(dateComCounts),
      paymentCounts: Object.fromEntries(paymentCounts),
      dateComYears: Object.fromEntries([...dateComYears.entries()].map(([month, years]) => [month, [...years].sort()])),
      paymentYears: Object.fromEntries([...paymentYears.entries()].map(([month, years]) => [month, [...years].sort()]))
    },
    confidence: events.length >= 5 && (activeDateCom >= 2 || activePayment >= 2) ? 'high' : (events.length ? 'partial' : 'empty')
  };
}

function historicalRowValues(historicalIndicators = {}, labelPattern) {
  const rows = Array.isArray(historicalIndicators?.rows) ? historicalIndicators.rows : [];
  const row = rows.find(item => labelPattern.test(String(item.label || item.id || '')));
  return row?.values || {};
}

function numberFromHistoricalValue(value = '') {
  return parseBrNumber(String(value || '').replace(/%/g, ''));
}

function mapRevenueProfitByYear(canonical = {}) {
  const points = Array.isArray(canonical?.financial?.revenueProfit) ? canonical.financial.revenueProfit : [];
  const out = new Map();
  for (const point of points) {
    const year = Number(point.year || String(point.label || '').match(/\d{4}/)?.[0]);
    const raw = point.netProfit ?? point.profit ?? point.lucro ?? point.lucroLiquido ?? point.net_income ?? point.value;
    const value = Number(raw);
    if (Number.isFinite(year) && Number.isFinite(value)) out.set(String(year), value);
  }
  return out;
}


function firstFiniteNumberFromKeys(source = {}, keys = []) {
  for (const key of keys) {
    if (!source || typeof source !== 'object' || !(key in source)) continue;
    const raw = source?.[key];
    const value = typeof raw === 'number' ? raw : parseBrNumber(raw);
    if (Number.isFinite(Number(value))) return Number(value);
  }
  return null;
}

function financialPointYear(point = {}) {
  const raw = point?.year ?? point?.ano ?? point?.period ?? point?.periodo ?? point?.label ?? point?.date ?? point?.data;
  const match = String(raw || '').match(/(?:19|20)\d{2}|Últ\s*12M|ULT\s*12M|LTM|12M/i);
  if (!match) return { period: String(raw || '').trim(), label: String(raw || '').trim(), year: null };
  const label = /12M|LTM/i.test(match[0]) ? 'Últ 12M' : match[0];
  const year = /^\d{4}$/.test(label) ? Number(label) : null;
  return { period: label.toLowerCase().replace(/\s+/g, '_'), label, year };
}








function buildStockRevenueProfitChartPayload({ ticker = '', canonical = {} } = {}) {
  const rawPoints = Array.isArray(canonical?.financial?.revenueProfit) ? canonical.financial.revenueProfit : [];
  let points = rawPoints.map(point => {
    const meta = financialPointYear(point);
    const netRevenue = firstFiniteNumberFromKeys(point, ['netRevenue', 'revenue', 'receita', 'receitaLiquida', 'receita_liquida', 'net_revenue', 'value']);
    const netIncome = firstFiniteNumberFromKeys(point, ['netProfit', 'netIncome', 'profit', 'lucro', 'lucroLiquido', 'lucro_liquido', 'secondaryValue']);
    if (!meta.label || (netRevenue === null && netIncome === null)) return null;
    return {
      period: meta.period || meta.label,
      label: meta.label,
      year: meta.year,
      netRevenue: Number.isFinite(netRevenue) ? round(netRevenue, 4) : null,
      netRevenueDisplay: Number.isFinite(netRevenue) ? formatMoneyAbbrev(netRevenue) : '—',
      netIncome: Number.isFinite(netIncome) ? round(netIncome, 4) : null,
      netIncomeDisplay: Number.isFinite(netIncome) ? formatMoneyAbbrev(netIncome) : '—',
      source: 'Investidor10 Receitas e Lucros'
    };
  }).filter(Boolean).sort((a, b) => (a.year ?? 9999) - (b.year ?? 9999));
  let source = 'Investidor10 Receitas e Lucros';
  return {
    id: 'stock_revenue_profit_chart',
    title: 'Receitas e Lucros',
    ticker: String(ticker || '').toUpperCase(),
    status: points.length ? 'OK' : 'EMPTY',
    source,
    defaultPeriod: '10y',
    periodOptions: [
      { key: '5y', label: '5 A', months: 60 },
      { key: '10y', label: '10 A', months: 120 },
      { key: 'max', label: 'MAX' }
    ],
    kind: 'revenue_profit',
    chartType: 'bar_line',
    primarySeriesLabel: 'Receita Líquida',
    secondarySeriesLabel: 'Lucro Líquido',
    points,
    diagnostics: { points: points.length, negativeNetIncome: points.filter(point => Number(point.netIncome) < 0).length, positiveNetIncome: points.filter(point => Number(point.netIncome) > 0).length }
  };
}

function annualYahooQuoteMap(history = {}) {
  const latestByYear = new Map();
  for (const point of Array.isArray(history?.points) ? history.points : []) {
    const dateText = String(point?.date || point?.timestamp || point?.time || '');
    const time = Date.parse(dateText);
    const quote = firstFiniteNumberFromKeys(point, ['adjClose', 'close', 'price', 'value']);
    if (!Number.isFinite(time) || quote === null || quote <= 0) continue;
    const year = new Date(time).getUTCFullYear();
    const previous = latestByYear.get(year);
    if (!previous || time > previous.time) latestByYear.set(year, { time, quote });
  }
  return new Map([...latestByYear.entries()].map(([year, entry]) => [year, entry.quote]));
}

function buildStockProfitQuoteChartPayload({ ticker = '', canonical = {}, quoteHistory = {}, revenueProfitChart = null } = {}) {
  const rawPoints = Array.isArray(canonical?.financial?.profitVsQuote) ? canonical.financial.profitVsQuote : [];
  let points = rawPoints.map(point => {
    const meta = financialPointYear(point);
    const quote = firstFiniteNumberFromKeys(point, ['quote', 'cotacao', 'price', 'preco', 'value']);
    const netIncome = firstFiniteNumberFromKeys(point, ['profit', 'lucro', 'netProfit', 'netIncome', 'lucroLiquido', 'secondaryValue']);
    if (!meta.label || (quote === null && netIncome === null)) return null;
    return {
      period: meta.period || meta.label,
      label: meta.label,
      year: meta.year,
      quote: Number.isFinite(quote) ? round(quote, 4) : null,
      quoteDisplay: Number.isFinite(quote) ? formatMoney(quote) : '—',
      netIncome: Number.isFinite(netIncome) ? round(netIncome, 4) : null,
      netIncomeDisplay: Number.isFinite(netIncome) ? formatMoneyAbbrev(netIncome) : '—',
      source: 'Investidor10 Lucro x Cotação'
    };
  }).filter(Boolean).sort((a, b) => (a.year ?? 9999) - (b.year ?? 9999));
  let source = 'Investidor10 Lucro x Cotação';

  // Fallback rastreável: combina lucro anual publicado pelo Investidor10 com a última
  // cotação ajustada de cada ano no Yahoo. Nenhum valor financeiro é estimado ou simulado.
  if (!points.length) {
    const quoteByYear = annualYahooQuoteMap(quoteHistory);
    const revenuePoints = Array.isArray(revenueProfitChart?.points)
      ? revenueProfitChart.points
      : buildStockRevenueProfitChartPayload({ ticker, canonical }).points;
    points = revenuePoints.map(point => {
      const year = Number(point?.year || String(point?.label || '').match(/(?:19|20)\d{2}/)?.[0]);
      const quote = quoteByYear.get(year);
      const netIncome = firstFiniteNumberFromKeys(point, ['netIncome', 'netProfit', 'profit', 'lucro']);
      if (!Number.isFinite(year) || !Number.isFinite(quote) || netIncome === null) return null;
      return {
        period: String(year),
        label: String(year),
        year,
        quote: round(quote, 4),
        quoteDisplay: formatMoney(quote),
        netIncome: round(netIncome, 4),
        netIncomeDisplay: formatMoneyAbbrev(netIncome),
        source: 'Investidor10 resultados + Yahoo Finance histórico'
      };
    }).filter(Boolean).sort((a, b) => a.year - b.year);
    if (points.length) source = 'Investidor10 resultados + Yahoo Finance histórico';
  }

  return {
    id: 'stock_profit_quote_chart',
    title: `Lucro x Cotação - ${String(ticker || '').toUpperCase()}`.trim(),
    ticker: String(ticker || '').toUpperCase(),
    status: points.length ? 'OK' : 'EMPTY',
    source,
    defaultPeriod: 'max',
    periodOptions: [
      { key: '5y', label: '5 A', months: 60 },
      { key: '10y', label: '10 A', months: 120 },
      { key: 'max', label: 'MAX' }
    ],
    kind: 'profit_quote',
    chartType: 'dual_line',
    primarySeriesLabel: 'Lucro Líquido',
    secondarySeriesLabel: 'Cotação',
    points,
    diagnostics: {
      points: points.length,
      fallbackUsed: source.includes('Yahoo Finance'),
      quoteHistoryPoints: Array.isArray(quoteHistory?.points) ? quoteHistory.points.length : 0,
      negativeNetIncome: points.filter(point => Number(point.netIncome) < 0).length,
      positiveNetIncome: points.filter(point => Number(point.netIncome) > 0).length
    }
  };
}

const STOCK_RESULTS_ROW_SPECS = Object.freeze([
  { id: 'net_revenue', label: 'Receita Líquida - (R$)', keys: ['netRevenue', 'revenue', 'receita', 'receitaLiquida', 'receita_liquida'], kind: 'money' },
  { id: 'costs', label: 'Custos - (R$)', keys: ['cost', 'costs', 'custo', 'custos', 'cpv'], kind: 'money' },
  { id: 'gross_profit', label: 'Lucro Bruto - (R$)', keys: ['grossProfit', 'lucroBruto', 'lucro_bruto'], kind: 'money' },
  { id: 'net_income', label: 'Lucro Líquido - (R$)', keys: ['netProfit', 'netIncome', 'profit', 'lucro', 'lucroLiquido', 'lucro_liquido'], kind: 'money' },
  { id: 'ebitda', label: 'EBITDA - (R$)', keys: ['ebitda', 'EBITDA'], kind: 'money' },
  { id: 'ebit', label: 'EBIT - (R$)', keys: ['ebit', 'EBIT'], kind: 'money' },
  { id: 'tax', label: 'Imposto - (R$)', keys: ['tax', 'taxes', 'imposto', 'impostos'], kind: 'money' },
  { id: 'gross_debt', label: 'Dívida Bruta - (R$)', keys: ['grossDebt', 'dividaBruta', 'dívidaBruta', 'divida_bruta'], kind: 'money' },
  { id: 'net_debt', label: 'Dívida Líquida - (R$)', keys: ['netDebt', 'dividaLiquida', 'dívidaLiquida', 'divida_liquida'], kind: 'money' },
  { id: 'gross_margin', label: 'Margem Bruta - (%)', keys: ['grossMargin', 'margemBruta', 'margem_bruta'], kind: 'percent' },
  { id: 'ebitda_margin', label: 'Margem Ebitda - (%)', keys: ['ebitdaMargin', 'margemEbitda', 'margem_ebitda'], kind: 'percent' },
  { id: 'net_margin', label: 'Margem Líquida - (%)', keys: ['netMargin', 'margemLiquida', 'margem_liquida'], kind: 'percent' },
  { id: 'roe', label: 'ROE - (%)', keys: ['roe', 'ROE'], kind: 'percent' },
  { id: 'roic', label: 'ROIC - (%)', keys: ['roic', 'ROIC'], kind: 'percent' }
]);




const STOCK_BALANCE_ROW_SPECS = Object.freeze([
  { id: 'total_assets', label: 'ATIVO TOTAL - (R$)', keys: ['totalAssets', 'ativoTotal', 'ativo_total', 'assetsTotal', 'assets', 'total_ativo'], kind: 'money' },
  { id: 'current_assets', label: 'Ativo Circulante - (R$)', keys: ['currentAssets', 'ativoCirculante', 'ativo_circulante'], kind: 'money' },
  { id: 'non_current_assets', label: 'Ativo Não Circulante - (R$)', keys: ['nonCurrentAssets', 'ativoNaoCirculante', 'ativo_nao_circulante', 'non_current_assets'], kind: 'money' },
  { id: 'total_liabilities', label: 'PASSIVO TOTAL - (R$)', keys: ['totalLiabilities', 'passivoTotal', 'passivo_total', 'liabilitiesTotal', 'passivos'], kind: 'money' },
  { id: 'current_liabilities', label: 'Passivo Circulante - (R$)', keys: ['currentLiabilities', 'passivoCirculante', 'passivo_circulante'], kind: 'money' },
  { id: 'non_current_liabilities', label: 'Passivo Não Circulante - (R$)', keys: ['nonCurrentLiabilities', 'passivoNaoCirculante', 'passivo_nao_circulante', 'non_current_liabilities'], kind: 'money' },
  { id: 'equity', label: 'Patrimônio Líquido Consolidado - (R$)', keys: ['equity', 'netWorth', 'patrimonioLiquido', 'patrimonio_liquido', 'patrimonioLiquidoConsolidado', 'shareholdersEquity'], kind: 'money' }
]);

function buildStockBalanceSheetStatementPayload({ ticker = '', canonical = {} } = {}) {
  const symbol = String(ticker || '').toUpperCase();
  const rawPoints = Array.isArray(canonical?.financial?.balanceSheet) ? canonical.financial.balanceSheet : [];
  const columns = [];
  const byColumn = new Map();
  for (const point of rawPoints) {
    const meta = financialPointYear(point);
    if (!meta.label || /12M/i.test(meta.label)) continue;
    const key = meta.label;
    if (!columns.includes(key)) columns.push(key);
    byColumn.set(key, point);
  }
  const sortedColumns = columns.sort((a, b) => {
    const na = Number(a); const nb = Number(b);
    if (Number.isFinite(na) && Number.isFinite(nb)) return nb - na;
    return String(a).localeCompare(String(b), 'pt-BR', { numeric: true });
  }).slice(0, 6);
  let rows = STOCK_BALANCE_ROW_SPECS.map(spec => {
    const values = {};
    for (const column of sortedColumns) {
      const point = byColumn.get(column) || {};
      const raw = firstFiniteNumberFromKeys(point, spec.keys);
      if (raw !== null) values[column] = stockFinancialDisplayValue(raw, spec.kind);
    }
    return { id: spec.id, label: spec.label, values, source: 'Investidor10 balanço patrimonial' };
  }).filter(row => Object.keys(row.values).length);
  let finalColumns = sortedColumns;
  let source = 'Investidor10 balanço patrimonial';
  return {
    id: 'stock_balance_sheet_statement',
    title: `Balanço Patrimonial ${symbol}`.trim(),
    subtitle: 'Arraste o quadro para ver mais dados',
    source,
    status: rows.length ? 'OK' : 'EMPTY',
    displayOptions: {
      scale: 'Valores simples',
      unit: 'Valores',
      period: 'Anual'
    },
    periods: [],
    selectedPeriod: null,
    tablesByPeriod: {},
    columns: finalColumns,
    rows
  };
}


function stockFinancialDisplayValue(value, kind = 'money') {
  const n = Number(value);
  if (!Number.isFinite(n)) return '';
  if (kind === 'percent') return `${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %`;
  return formatMoneyAbbrev(n);
}

function buildStockResultsStatementPayload({ ticker = '', canonical = {}, fundamentalIndicators = {}, historicalIndicators = {} } = {}) {
  const symbol = String(ticker || '').toUpperCase();
  const rawPoints = Array.isArray(canonical?.financial?.incomeStatement) && canonical.financial.incomeStatement.length
    ? canonical.financial.incomeStatement
    : (Array.isArray(canonical?.financial?.balanceSheet) ? canonical.financial.balanceSheet : []);
  const columns = [];
  const byColumn = new Map();
  for (const point of rawPoints) {
    const meta = financialPointYear(point);
    if (!meta.label) continue;
    const key = meta.label;
    if (!columns.includes(key)) columns.push(key);
    byColumn.set(key, point);
  }
  const sortedColumns = columns.sort((a, b) => {
    if (/12M/i.test(a)) return -1;
    if (/12M/i.test(b)) return 1;
    const na = Number(a); const nb = Number(b);
    if (Number.isFinite(na) && Number.isFinite(nb)) return nb - na;
    return String(a).localeCompare(String(b), 'pt-BR', { numeric: true });
  }).slice(0, 6);
  let rows = STOCK_RESULTS_ROW_SPECS.map(spec => {
    const values = {};
    for (const column of sortedColumns) {
      const point = byColumn.get(column) || {};
      const raw = firstFiniteNumberFromKeys(point, spec.keys);
      if (raw !== null) values[column] = stockFinancialDisplayValue(raw, spec.kind);
    }
    return { id: spec.id, label: spec.label, values, source: 'Investidor10 resultados' };
  }).filter(row => Object.keys(row.values).length);
  let finalColumns = sortedColumns;
  let source = 'Investidor10 resultados';
  return {
    id: 'stock_results_statement',
    title: `Resultados ${symbol}`.trim(),
    subtitle: 'Arraste o quadro para ver mais dados',
    source,
    status: rows.length ? 'OK' : 'EMPTY',
    periods: [],
    selectedPeriod: null,
    tablesByPeriod: {},
    columns: finalColumns,
    rows
  };
}

function buildStockEquityEvolutionChartPayload({ ticker = '', canonical = {} } = {}) {
  const symbol = String(ticker || '').toUpperCase();
  const equityPoints = Array.isArray(canonical?.financial?.equityEvolution) ? canonical.financial.equityEvolution : [];
  const revenuePoints = Array.isArray(canonical?.financial?.revenueProfit) ? canonical.financial.revenueProfit : [];
  const revenueByLabel = new Map(revenuePoints.map(point => [financialPointYear(point).label, point]));
  let points = equityPoints.map(point => {
    const meta = financialPointYear(point);
    if (!meta.label) return null;
    const revPoint = revenueByLabel.get(meta.label) || {};
    const netWorth = firstFiniteNumberFromKeys(point, ['netWorth', 'equity', 'patrimonioLiquido', 'patrimonio_liquido', 'pl', 'value']);
    const netRevenue = firstFiniteNumberFromKeys(point, ['netRevenue', 'revenue', 'receita', 'receitaLiquida']) ?? firstFiniteNumberFromKeys(revPoint, ['netRevenue', 'revenue', 'receita', 'receitaLiquida']);
    const netIncome = firstFiniteNumberFromKeys(point, ['netProfit', 'netIncome', 'profit', 'lucro', 'lucroLiquido']) ?? firstFiniteNumberFromKeys(revPoint, ['netProfit', 'netIncome', 'profit', 'lucro', 'lucroLiquido']);
    if (netWorth === null && netRevenue === null && netIncome === null) return null;
    return {
      period: meta.period || meta.label,
      label: meta.label,
      year: meta.year,
      netWorth: Number.isFinite(netWorth) ? round(netWorth, 4) : null,
      netWorthDisplay: Number.isFinite(netWorth) ? formatMoneyAbbrev(netWorth) : '—',
      netRevenue: Number.isFinite(netRevenue) ? round(netRevenue, 4) : null,
      netRevenueDisplay: Number.isFinite(netRevenue) ? formatMoneyAbbrev(netRevenue) : '—',
      netIncome: Number.isFinite(netIncome) ? round(netIncome, 4) : null,
      netIncomeDisplay: Number.isFinite(netIncome) ? formatMoneyAbbrev(netIncome) : '—',
      source: 'Investidor10 evolução do patrimônio'
    };
  }).filter(Boolean).sort((a, b) => (a.year ?? 9999) - (b.year ?? 9999));
  let source = 'Investidor10 evolução do patrimônio';
  return {
    id: 'stock_equity_evolution_chart',
    title: `Evolução do patrimônio - ${symbol}`.trim(),
    ticker: symbol,
    status: points.length ? 'OK' : 'EMPTY',
    source,
    defaultPeriod: '10y',
    periodOptions: [
      { key: '5y', label: '5 A', months: 60 },
      { key: '10y', label: '10 A', months: 120 },
      { key: 'max', label: 'MAX' }
    ],
    kind: 'equity_evolution',
    chartType: 'bar_multi_line',
    primarySeriesLabel: 'Patrimônio',
    secondarySeriesLabel: 'Receita Líquida',
    tertiarySeriesLabel: 'Lucro Líquido',
    points,
    diagnostics: { points: points.length, negativeNetIncome: points.filter(point => Number(point.netIncome) < 0).length, negativeNetWorth: points.filter(point => Number(point.netWorth) < 0).length }
  };
}

function stockPayoutPeriodMeta(raw = '', fallback = '') {
  const source = raw == null || raw === '' ? fallback : raw;
  if (typeof source === 'number' && Number.isFinite(source)) {
    if (source > 10_000_000_000) {
      const year = new Date(source).getUTCFullYear();
      if (year >= 1900 && year <= 2200) return { period: String(year), label: String(year), year };
    }
    if (source >= 1900 && source <= 2200) return { period: String(Math.trunc(source)), label: String(Math.trunc(source)), year: Math.trunc(source) };
  }
  const text = cleanText(String(source ?? fallback ?? '')).replace(/\s+/g, ' ').trim();
  if (!text) return { period: '', label: '', year: null };
  if (/^(?:atual|ult(?:\.|imo)?\s*12\s*m|últ(?:\.|imo)?\s*12\s*m|12\s*m|ttm|ltm|last\s*12)/i.test(text) || /(?:ult|últ|ttm|ltm).*12/i.test(text)) {
    return { period: 'last_12m', label: 'Últ 12M', year: null };
  }
  const match = text.match(/(?:19|20)\d{2}/);
  if (match) return { period: match[0], label: match[0], year: Number(match[0]) };
  return { period: text.toLowerCase().replace(/\s+/g, '_'), label: text, year: null };
}

function stockPayoutFieldFromName(name = '') {
  const key = compactKey(name);
  if (!key) return '';
  if (/dividendyield|dividendyeld|yielddividendos|dy$|^dy|dividendosyield/.test(key)) return 'dividendYieldPercent';
  if (/payout|payoutratio|payoutrate|payoutrenda|payoutrendimentos/.test(key)) return 'payoutPercent';
  if (/lucroliquido|lucro12m|lucro|netprofit|netincome|profit/.test(key)) return 'netIncome';
  return '';
}

function stockPayoutUnitMultiplier(unitHint = '') {
  const key = normalizeLooseText(unitHint);
  if (!key) return 1;
  if (/\b(?:t|tri|trilhao|trilhoes|trillion)\b/.test(key)) return 1e12;
  if (/\b(?:b|bi|bilhao|bilhoes|billion)\b/.test(key)) return 1e9;
  if (/\b(?:m|mi|milhao|milhoes|million)\b/.test(key)) return 1e6;
  if (/\b(?:k|mil|thousand)\b/.test(key)) return 1e3;
  return 1;
}

function stockPayoutObjectUnitHint(value = {}, inherited = '') {
  if (!value || typeof value !== 'object') return inherited || '';
  return [
    value.unit, value.unidade, value.suffix, value.valueSuffix, value.prefix, value.format, value.formatter,
    value.tooltip?.valueSuffix, value.tooltip?.suffix, value.yAxis?.title, value.axis?.title, inherited
  ].filter(Boolean).join(' ');
}

function stockPayoutMaybeScaleNetIncome(n, field = '', unitHint = '', rawString = '') {
  const value = Number(n);
  if (!Number.isFinite(value) || field !== 'netIncome') return Number.isFinite(value) ? value : null;
  const scale = stockPayoutUnitMultiplier(`${unitHint || ''} ${rawString || ''}`);
  if (scale > 1 && Math.abs(value) < 1_000_000) return value * scale;
  return value;
}

function stockPayoutNumeric(value, field = '', unitHint = '') {
  if (value == null || value === '') return null;
  if (typeof value === 'number') return stockPayoutMaybeScaleNetIncome(value, field, unitHint, '');
  if (Array.isArray(value)) {
    for (let i = value.length - 1; i >= 0; i -= 1) {
      const n = stockPayoutNumeric(value[i], field, unitHint);
      if (n !== null) return n;
    }
    return null;
  }
  if (typeof value === 'object') {
    const objectUnitHint = stockPayoutObjectUnitHint(value, unitHint);
    const keysByField = {
      netIncome: ['netIncome','netProfit','lucroLiquido','lucro_liquido','lucro','profit','resultado','amount','total','value','valor','y'],
      payoutPercent: ['payoutPercent','payout','payOut','pay_out','payoutRatio','valuePercent','percent','percentage','valor','value','y'],
      dividendYieldPercent: ['dividendYieldPercent','dividendYield','dy','yield','yieldValue','valuePercent','percent','percentage','valor','value','y']
    };
    for (const key of (keysByField[field] || ['value','valor','y','amount','total'])) {
      if (Object.prototype.hasOwnProperty.call(value, key)) {
        const n = stockPayoutNumeric(value[key], field, objectUnitHint);
        if (n !== null) return n;
      }
    }
    return null;
  }
  const rawString = String(value);
  const raw = cleanText(rawString)
    .replace(/R\$/gi, '')
    .replace(/%/g, '')
    .replace(/\b(?:BRL|USD)\b|US\$/gi, '')
    .replace(/\s+/g, '')
    .trim();

  // O Investidor10 pode enviar lucro líquido bruto como "36.700.000.000".
  // Esse formato não é decimal: é separador de milhar brasileiro. Ele precisa
  // ser resolvido antes dos normalizadores genéricos para não virar 0/36,7.
  if (field === 'netIncome') {
    if (/^[+-]?\d{1,3}(?:\.\d{3}){2,}$/.test(raw)) {
      const parsed = Number(raw.replace(/\./g, ''));
      return Number.isFinite(parsed) ? parsed : null;
    }
    if (/^[+-]?\d{1,3}(?:\.\d{3})+,\d+$/.test(raw)) {
      const parsed = Number(raw.replace(/\./g, '').replace(',', '.'));
      return Number.isFinite(parsed) ? parsed : null;
    }
  }

  const parser = field === 'payoutPercent' || field === 'dividendYieldPercent' ? parsePercentNumber : parseFinancialNumber;
  let n = parser(rawString, { maxAbs: field === 'netIncome' ? 1e16 : 100000 });
  if (!Number.isFinite(Number(n)) && raw) {
    if (/^[+-]?\d{1,3}(?:\.\d{3})+$/.test(raw)) n = Number(raw.replace(/\./g, ''));
    else if (/^[+-]?\d{1,3}(?:\.\d{3})+,\d+$/.test(raw)) n = Number(raw.replace(/\./g, '').replace(',', '.'));
  }
  return Number.isFinite(Number(n)) ? stockPayoutMaybeScaleNetIncome(Number(n), field, unitHint, rawString) : null;
}

function stockPayoutLabelFromPoint(point, fallback = '', index = 0) {
  if (Array.isArray(point)) return stockPayoutPeriodMeta(point[0] ?? fallback ?? `P${index + 1}`).label;
  if (point && typeof point === 'object') {
    const raw = point.period ?? point.periodo ?? point.year ?? point.ano ?? point.label ?? point.name ?? point.date ?? point.data ?? point.x ?? point.category ?? fallback;
    return stockPayoutPeriodMeta(raw, fallback || `P${index + 1}`).label;
  }
  return stockPayoutPeriodMeta(fallback || `P${index + 1}`).label;
}

function stockPayoutCategories(node = {}) {
  if (!node || typeof node !== 'object') return [];
  const direct = node.categories || node.labels || node.years || node.anos || node.periods || node.periodos || node.columns || node.colunas;
  if (Array.isArray(direct)) return direct.map(item => stockPayoutPeriodMeta(item).label).filter(Boolean);
  const xaxis = node.xAxis || node.xaxis || node.x_axis || node.x;
  if (xaxis && typeof xaxis === 'object') {
    const nested = xaxis.categories || xaxis.labels || xaxis.data;
    if (Array.isArray(nested)) return nested.map(item => stockPayoutPeriodMeta(item).label).filter(Boolean);
  }
  return [];
}

function extractStockPayoutCurrentNetIncomeFromHtml(html = '') {
  const plain = htmlToPlainText(html);
  const match = plain.match(/(?:nos\s+últimos\s+12\s+meses|últimos\s+12\s+meses)[\s\S]{0,320}?(?:lucro\s+(?:no\s+)?valor\s+de|lucro)[^R$]{0,80}(R\$\s*[+-]?\s*\d{1,3}(?:\.\d{3})*(?:,\d+)?\s*(?:trilh(?:ões|ão|ao)|bilh(?:ões|ão|ao)|milh(?:ões|ão|ao)|tri|bi|mi|[BMTK])?)/i);
  const value = match?.[1] ? parseFinancialNumber(match[1], { maxAbs: 1e16 }) : null;
  return value != null && value !== '' && Number.isFinite(Number(value)) ? Number(value) : null;
}

function normalizeStockPayoutDedicatedSource(raw, { ticker = '' } = {}) {
  const points = new Map();
  const sourceLabel = `Investidor10 payout-chart ${String(ticker || '').toUpperCase()}`.trim();
  const ensurePoint = (labelRaw, order = 0) => {
    const meta = stockPayoutPeriodMeta(labelRaw, `P${order + 1}`);
    if (!meta.label) return null;
    const key = meta.year != null ? String(meta.year) : compactKey(meta.label);
    const current = points.get(key) || { period: meta.period || meta.label, label: meta.label, year: meta.year, source: sourceLabel, order };
    if (current.year == null && meta.year != null) current.year = meta.year;
    if (!current.period || /^p\d+$/i.test(current.period)) current.period = meta.period || meta.label;
    current.label = meta.label || current.label;
    current.order = Math.min(current.order ?? order, order);
    points.set(key, current);
    return current;
  };
  const addField = (labelRaw, field, rawValue, order = 0, unitHint = '') => {
    if (!field) return;
    const value = stockPayoutNumeric(rawValue, field, unitHint);
    if (!Number.isFinite(Number(value))) return;
    const point = ensurePoint(labelRaw, order);
    if (!point) return;
    const n = Number(value);
    if (field === 'netIncome') point.netIncome = n;
    if (field === 'payoutPercent') point.payoutPercent = n;
    if (field === 'dividendYieldPercent') point.dividendYieldPercent = n;
  };

  const consumeSeries = (series, categories = [], inheritedName = '') => {
    for (const [seriesIndex, item] of (series || []).entries()) {
      if (!item) continue;
      const name = cleanText(item.name || item.label || item.title || item.key || item.id || inheritedName || '');
      const field = stockPayoutFieldFromName(name);
      const itemUnitHint = stockPayoutObjectUnitHint(item, inheritedName);
      const data = Array.isArray(item.data) ? item.data
        : Array.isArray(item.values) ? item.values
          : Array.isArray(item.points) ? item.points
            : Array.isArray(item.items) ? item.items
              : Array.isArray(item.serie) ? item.serie
                : [];
      if (field && data.length) {
        data.forEach((point, index) => addField(stockPayoutLabelFromPoint(point, categories[index], index), field, point, index + seriesIndex * 1000, itemUnitHint));
      }
    }
  };

  const consumeRows = (rows, categories = []) => {
    for (const [rowIndex, row] of (rows || []).entries()) {
      if (!row) continue;
      if (Array.isArray(row)) {
        const label = stockPayoutLabelFromPoint(row, categories[rowIndex], rowIndex);
        if (row.length >= 4) {
          addField(label, 'netIncome', row[1], rowIndex);
          addField(label, 'payoutPercent', row[2], rowIndex);
          addField(label, 'dividendYieldPercent', row[3], rowIndex);
        }
        continue;
      }
      if (typeof row !== 'object') continue;
      const label = stockPayoutLabelFromPoint(row, categories[rowIndex], rowIndex);
      const rowUnitHint = stockPayoutObjectUnitHint(row, '');
      addField(label, 'netIncome', row.netIncome ?? row.netProfit ?? row.lucroLiquido ?? row.lucro_liquido ?? row.lucro ?? row.profit ?? row.resultado, rowIndex, rowUnitHint);
      addField(label, 'payoutPercent', row.payoutPercent ?? row.payout ?? row.payOut ?? row.pay_out ?? row.payoutRatio, rowIndex, rowUnitHint);
      addField(label, 'dividendYieldPercent', row.dividendYieldPercent ?? row.dividendYield ?? row.dy ?? row.yield, rowIndex, rowUnitHint);
    }
  };

  const visit = (node, depth = 0, inheritedName = '') => {
    if (node == null || depth > 6) return;
    if (Array.isArray(node)) {
      const seriesRows = node.filter(item => item && typeof item === 'object' && !Array.isArray(item) && (item.name || item.label || item.title || item.key || item.id) && (Array.isArray(item.data) || Array.isArray(item.values) || Array.isArray(item.points) || Array.isArray(item.items) || Array.isArray(item.serie)));
      if (seriesRows.length) consumeSeries(seriesRows, [], inheritedName);
      const structuredRows = node.filter(item => item && typeof item === 'object' && !Array.isArray(item) && (item.payout !== undefined || item.payoutPercent !== undefined || item.dividendYield !== undefined || item.dy !== undefined || item.netIncome !== undefined || item.lucroLiquido !== undefined || item.lucro !== undefined));
      if (structuredRows.length) consumeRows(structuredRows);
      node.forEach(item => visit(item, depth + 1, inheritedName));
      return;
    }
    if (typeof node !== 'object') return;
    const categories = stockPayoutCategories(node);
    const series = Array.isArray(node.series) ? node.series
      : Array.isArray(node.datasets) ? node.datasets
        : Array.isArray(node.dataSets) ? node.dataSets
          : Array.isArray(node.lines) ? node.lines
            : [];
    if (series.length) consumeSeries(series, categories, inheritedName);
    const rows = Array.isArray(node.rows) ? node.rows
      : Array.isArray(node.linhas) ? node.linhas
        : Array.isArray(node.items) ? node.items
          : Array.isArray(node.data) && !series.length ? node.data
            : Array.isArray(node.values) && !series.length ? node.values
              : [];
    if (rows.length) consumeRows(rows, categories);

    const label = stockPayoutLabelFromPoint(node, '', 0);
    if (label) {
      const nodeUnitHint = stockPayoutObjectUnitHint(node, inheritedName);
      addField(label, 'netIncome', node.netIncome ?? node.netProfit ?? node.lucroLiquido ?? node.lucro_liquido ?? node.lucro ?? node.profit ?? node.resultado, 0, nodeUnitHint);
      addField(label, 'payoutPercent', node.payoutPercent ?? node.payout ?? node.payOut ?? node.pay_out ?? node.payoutRatio, 0, nodeUnitHint);
      addField(label, 'dividendYieldPercent', node.dividendYieldPercent ?? node.dividendYield ?? node.dy ?? node.yield, 0, nodeUnitHint);
    }

    for (const [key, value] of Object.entries(node)) {
      if (['series','datasets','dataSets','lines','rows','linhas','items','data','values','categories','labels','xAxis','xaxis','x_axis'].includes(key)) continue;
      const field = stockPayoutFieldFromName(key);
      if (field && Array.isArray(value)) {
        value.forEach((point, index) => addField(stockPayoutLabelFromPoint(point, categories[index], index), field, point, index, key));
        continue;
      }
      if (field && value && typeof value === 'object' && !Array.isArray(value)) {
        for (const [period, periodValue] of Object.entries(value)) addField(period, field, periodValue, 0, key);
        continue;
      }
      visit(value, depth + 1, key);
    }
  };

  visit(raw, 0, '');
  return Array.from(points.values())
    .filter(point => Number.isFinite(Number(point.netIncome)) || Number.isFinite(Number(point.payoutPercent)) || Number.isFinite(Number(point.dividendYieldPercent)))
    .filter(point => !( /^P\d+$/i.test(String(point.label || '')) && [point.netIncome, point.payoutPercent, point.dividendYieldPercent].every(value => Number(value) === 0)))
    .sort((a, b) => {
      if (a.year != null && b.year != null) return Number(a.year) - Number(b.year);
      if (a.year != null) return -1;
      if (b.year != null) return 1;
      return (a.order ?? 0) - (b.order ?? 0);
    });
}

function finalizeStockPayoutPoint(point, ticker = '') {
  const netIncome = point.netIncome == null || point.netIncome === '' ? NaN : Number(point.netIncome);
  const payout = point.payoutPercent == null || point.payoutPercent === '' ? NaN : Number(point.payoutPercent);
  const dy = point.dividendYieldPercent == null || point.dividendYieldPercent === '' ? NaN : Number(point.dividendYieldPercent);
  return {
    period: point.period || (point.year != null ? String(point.year) : metricId(point.label)),
    label: point.label || (point.year != null ? String(point.year) : '—'),
    year: point.year ?? null,
    netIncome: Number.isFinite(netIncome) ? round(netIncome, 4) : null,
    netIncomeDisplay: Number.isFinite(netIncome) ? formatMoneyAbbrev(netIncome) : '—',
    payoutPercent: Number.isFinite(payout) ? round(payout, 4) : null,
    payoutDisplay: Number.isFinite(payout) ? formatPercent(payout) : '—',
    dividendYieldPercent: Number.isFinite(dy) ? round(dy, 4) : null,
    dividendYieldDisplay: Number.isFinite(dy) ? formatPercent(dy) : '—',
    source: point.source || `Investidor10 Payout de ${String(ticker || '').toUpperCase() || 'ação'}`
  };
}

function buildStockPayoutChartPayload({ ticker = '', canonical = {}, historicalIndicators = {}, dividendHistory = {}, payoutRaw = null, html = '' } = {}) {
  const payoutValues = historicalRowValues(historicalIndicators, /^Payout$/i);
  const dyValues = historicalRowValues(historicalIndicators, /Dividend\s+Yield|^DY$/i);
  const profitByYear = mapRevenueProfitByYear(canonical);
  const payoutHistory = Array.isArray(canonical?.financial?.payoutHistory) ? canonical.financial.payoutHistory : [];
  const payoutByYear = new Map();
  for (const point of payoutHistory) {
    const year = String(point.year || point.label || '').match(/(?:19|20)\d{2}/)?.[0];
    const value = Number(point.value ?? point.payout ?? point.y);
    if (year && Number.isFinite(value)) payoutByYear.set(year, value);
  }
  const dyByYear = new Map((dividendHistory?.yieldSeriesByFrequency?.yearly || []).map(point => [String(point.year || point.label || point.period), Number(point.value)]));
  const currentNetIncome = extractStockPayoutCurrentNetIncomeFromHtml(html);
  const dedicatedPoints = normalizeStockPayoutDedicatedSource(payoutRaw, { ticker });
  const pointMap = new Map();
  const putPoint = (point) => {
    if (!point) return;
    const key = point.year != null ? String(point.year) : compactKey(point.label || point.period);
    if (!key) return;
    const existing = pointMap.get(key) || {};
    pointMap.set(key, { ...existing, ...point, source: point.source || existing.source });
  };
  for (const rawPoint of dedicatedPoints) putPoint(rawPoint);

  const years = new Set([
    ...profitByYear.keys(),
    ...payoutByYear.keys(),
    ...dyByYear.keys(),
    ...Object.keys(payoutValues).filter(key => /^\d{4}$/.test(key)),
    ...Object.keys(dyValues).filter(key => /^\d{4}$/.test(key))
  ]);
  const orderedYears = Array.from(years).filter(year => /^\d{4}$/.test(year)).sort((a, b) => Number(a) - Number(b));
  for (const year of orderedYears) {
    const meta = stockPayoutPeriodMeta(year);
    const existing = pointMap.get(year) || { period: year, label: year, year: Number(year), source: `Investidor10 Payout de ${String(ticker || '').toUpperCase() || 'ação'}` };
    const netIncome = profitByYear.get(year);
    const payout = payoutByYear.has(year) ? payoutByYear.get(year) : numberFromHistoricalValue(payoutValues[year]);
    const dy = dyByYear.has(year) ? dyByYear.get(year) : numberFromHistoricalValue(dyValues[year]);
    putPoint({
      ...existing,
      period: existing.period || meta.period,
      label: existing.label || meta.label,
      year: existing.year ?? meta.year,
      netIncome: Number.isFinite(Number(netIncome)) && (!Number.isFinite(Number(existing.netIncome)) || Math.abs(Number(existing.netIncome)) < 1_000_000) ? Number(netIncome) : existing.netIncome,
      payoutPercent: Number.isFinite(Number(existing.payoutPercent)) ? existing.payoutPercent : (Number.isFinite(Number(payout)) ? Number(payout) : undefined),
      dividendYieldPercent: Number.isFinite(Number(existing.dividendYieldPercent)) ? existing.dividendYieldPercent : (Number.isFinite(Number(dy)) ? Number(dy) : undefined)
    });
  }

  const hasCurrentValues = payoutValues.Atual || payoutValues.atual || dyValues.Atual || dyValues.atual || dedicatedPoints.some(point => /12M/i.test(String(point.label || point.period || '')));
  if (hasCurrentValues) {
    const payout = numberFromHistoricalValue(payoutValues.Atual || payoutValues.atual || '');
    const dy = numberFromHistoricalValue(dyValues.Atual || dyValues.atual || '');
    const latestProfit = currentNetIncome != null && currentNetIncome !== '' && Number.isFinite(Number(currentNetIncome)) ? Number(currentNetIncome) : null;
    const key = 'ult12m';
    const existing = pointMap.get(key) || pointMap.get('ultimo12m') || pointMap.get('last12m') || pointMap.get('ttm') || { period: 'last_12m', label: 'Últ 12M', year: null, source: `Investidor10 Payout de ${String(ticker || '').toUpperCase() || 'ação'}` };
    pointMap.delete('ultimo12m'); pointMap.delete('last12m'); pointMap.delete('ttm');
    pointMap.set(key, {
      ...existing,
      period: 'last_12m',
      label: 'Últ 12M',
      year: null,
      netIncome: Number.isFinite(Number(existing.netIncome)) && Math.abs(Number(existing.netIncome)) >= 1_000_000 ? existing.netIncome : (latestProfit !== null && Number.isFinite(Number(latestProfit)) ? Number(latestProfit) : existing.netIncome),
      payoutPercent: Number.isFinite(Number(existing.payoutPercent)) ? existing.payoutPercent : (Number.isFinite(Number(payout)) ? Number(payout) : undefined),
      dividendYieldPercent: Number.isFinite(Number(existing.dividendYieldPercent)) ? existing.dividendYieldPercent : (Number.isFinite(Number(dy)) ? Number(dy) : undefined)
    });
  }

  const points = Array.from(pointMap.values())
    .filter(point => Number.isFinite(Number(point.netIncome)) || Number.isFinite(Number(point.payoutPercent)) || Number.isFinite(Number(point.dividendYieldPercent)))
    .filter(point => !( /^P\d+$/i.test(String(point.label || '')) && [point.netIncome, point.payoutPercent, point.dividendYieldPercent].every(value => Number(value) === 0)))
    .sort((a, b) => {
      if (a.year != null && b.year != null) return Number(a.year) - Number(b.year);
      if (a.year != null) return -1;
      if (b.year != null) return 1;
      return String(a.label || '').localeCompare(String(b.label || ''), 'pt-BR', { numeric: true });
    })
    .map(point => finalizeStockPayoutPoint(point, ticker));

  return {
    id: 'stock_payout_chart',
    title: `Payout de ${String(canonical?.name || canonical?.company?.name || String(ticker || '').toUpperCase() || 'ação').replace(/\s*\([^)]*\)\s*/g, '').trim() || String(ticker || '').toUpperCase()}`,
    ticker: String(ticker || '').toUpperCase(),
    status: points.length ? 'OK' : 'EMPTY',
    source: dedicatedPoints.length ? 'Investidor10 API payout-chart' : 'Investidor10 Payout histórico',
    defaultPeriod: '5y',
    periodOptions: [
      { key: '5y', label: '5 A', months: 60 },
      { key: '10y', label: '10 A', months: 120 },
      { key: 'max', label: 'MAX' }
    ],
    series: {
      netIncomeLabel: 'Lucro Líquido',
      payoutLabel: 'Payout',
      dividendYieldLabel: 'Dividend Yield'
    },
    points,
    diagnostics: { points: points.length, payoutHistory: payoutHistory.length, profitPoints: profitByYear.size, dedicatedPayoutPoints: dedicatedPoints.length, currentNetIncome: Number.isFinite(Number(currentNetIncome)), negativeNetIncome: points.filter(point => Number(point.netIncome) < 0).length }
  };
}

function buildStockDividendHistoryPayload({ ticker = '', html = '', canonical = {}, quickMetrics = {}, fundamentalIndicators = {} } = {}) {
  const company = canonical?.company || {};
  const rawEvents = [
    ...(Array.isArray(company.dividendHistory) ? company.dividendHistory : []),
    ...(Array.isArray(canonical.dividendHistory) ? canonical.dividendHistory : [])
  ];
  const htmlEvents = extractStockDividendEventsFromHtml(html, ticker);
  const eventsByKey = new Map();
  for (const raw of [...htmlEvents, ...rawEvents.map(item => normalizeStockDividendEvent(item, ticker)).filter(Boolean)]) {
    const key = `${raw.type}|${raw.dataCom}|${raw.paymentDate}|${raw.valueDisplay}`;
    if (!eventsByKey.has(key)) eventsByKey.set(key, raw);
  }
  const events = Array.from(eventsByKey.values()).sort((a, b) => String(b.paymentDate || b.dataCom).localeCompare(String(a.paymentDate || a.dataCom)));

  const rawDividendYearly = [
    ...(Array.isArray(company.dividendYearly) ? company.dividendYearly : []),
    ...(Array.isArray(canonical.dividendYearly) ? canonical.dividendYearly : [])
  ];
  const dividendYearly = rawDividendYearly.map(item => stockDividendPointFromAggregate(item, 'yearly')).filter(Boolean);
  const finalDividendYearly = dividendYearly.length ? dividendYearly : aggregateStockDividendEventsByYear(events);

  const rawYield = [
    ...(Array.isArray(company.dividendYieldHistory) ? company.dividendYieldHistory : []),
    ...(Array.isArray(canonical.dividendYieldHistory) ? canonical.dividendYieldHistory : [])
  ];
  const yieldYearly = rawYield.map(stockYieldPointFromRaw).filter(Boolean);
  const derivedYield = yieldYearly.length ? yieldYearly : deriveStockYieldFromDividends(finalDividendYearly, quickMetrics.price);
  const dyItem = (fundamentalIndicators?.items || []).find(item => item.id === 'dividend_yield');
  const currentDyDisplay = quickMetrics.dyDisplay || dyItem?.value || (finiteNumberOrNull(quickMetrics.dy) !== null ? formatPercent(Number(quickMetrics.dy)) : '—');
  const avg = extractStockAverageDy5y(html);
  const hasData = derivedYield.length || finalDividendYearly.length || events.length;
  return {
    id: 'stock_dividend_history',
    title: `Histórico de Dividendos - ${String(ticker || '').toUpperCase()}`.trim(),
    dividendsTitle: `Histórico de Dividendos - ${String(ticker || '').toUpperCase()}`.trim(),
    status: hasData ? 'OK' : 'EMPTY',
    source: 'Investidor10 histórico de dividendos',
    defaultFrequency: 'yearly',
    defaultPeriod: '10y',
    frequencyOptions: [{ key: 'yearly', label: 'Dividend yield' }],
    periodOptions: [{ key: '5y', label: '5 A', months: 60 }, { key: '10y', label: '10 A', months: 120 }],
    currentDy: finiteNumberOrNull(quickMetrics.dy) !== null ? round(Number(quickMetrics.dy), 4) : (finiteNumberOrNull(dyItem?.numericValue) !== null ? round(Number(dyItem.numericValue), 4) : null),
    currentDyDisplay,
    averageDy5y: Number.isFinite(Number(avg.value)) ? round(Number(avg.value), 4) : null,
    averageDy5yDisplay: avg.display || '—',
    total12m: null,
    total12mDisplay: '—',
    summary: hasData ? `Histórico de dividendos de ${String(ticker || '').toUpperCase()} retornado pelo Investidor10.` : `Histórico de dividendos de ${String(ticker || '').toUpperCase()} ainda indisponível no Investidor10.`,
    yieldSeriesByFrequency: { yearly: derivedYield },
    dividendSeriesByFrequency: { yearly: finalDividendYearly },
    events: events.slice(0, 160),
    diagnostics: {
      htmlEvents: htmlEvents.length,
      rawEvents: rawEvents.length,
      dividendYearly: finalDividendYearly.length,
      yieldYearly: derivedYield.length
    }
  };
}

function extractInvestidor10StockBuyHoldChecklist(html = '', ticker = '', context = {}) {
  const symbol = String(ticker || '').toUpperCase();
  const plain = htmlToPlainText(html);
  const start = plain.search(/CHECKLIST\s+DO\s+INVESTIDOR\s+BUY\s+AND\s+HOLD/i);
  if (start < 0) return emptyStockBuyHoldChecklist(symbol, { reason: 'section_not_found' });
  const rawPlain = plain.slice(start, start + 9600);
  // Não usar "DIVIDENDOS" genérico como delimitador: esse termo aparece no próprio
  // critério "Empresa pagou +5% de dividendos/ano..." e cortava o checklist no 3º item.
  const endRel = rawPlain.slice(120).search(/(?:HIST[ÓO]RICO\s+DE\s+DIVIDENDOS|^\s*Dividend\s+yield\b|COMPARADOR\s+DE\s+A[ÇC][ÕO]ES|RECEITAS\s+E\s+LUCROS|COMUNICADOS\s+DO|RESULTADOS\s+|Copyright)/im);
  const section = rawPlain.slice(0, endRel >= 0 ? 120 + endRel : rawPlain.length).replace(/\s+/g, ' ').trim();
  const normalizedSection = normalizeLooseText(section);
  const rawSource = String(html || '');
  const lowerHtml = rawSource.toLowerCase();
  const htmlStart = lowerHtml.search(/checklist\s+do\s+investidor|checklist-do-investidor|checklist/i);
  const rawHtmlSection = htmlStart >= 0 ? rawSource.slice(htmlStart, htmlStart + 22000) : rawSource.slice(0, 22000);
  const rawCriteriaPositions = STOCK_BUY_HOLD_CHECKLIST_CRITERIA.map((criterion) => {
    const variants = [criterion.label, ...(criterion.variants || [])];
    let rawIdx = -1;
    let rawNeedle = '';
    for (const variant of variants) {
      const candidate = variant.split(/\s+/).filter(Boolean).slice(0, 3).join(' ');
      if (!candidate) continue;
      const idx = rawHtmlSection.toLowerCase().indexOf(candidate.toLowerCase());
      if (idx >= 0 && (rawIdx < 0 || idx < rawIdx)) {
        rawIdx = idx;
        rawNeedle = candidate;
      }
    }
    return { id: criterion.id, rawIdx, endIdx: rawIdx >= 0 ? rawIdx + rawNeedle.length : -1 };
  }).filter(item => item.rawIdx >= 0).sort((a, b) => a.rawIdx - b.rawIdx);
  const items = [];
  const seen = new Set();
  for (const criterion of STOCK_BUY_HOLD_CHECKLIST_CRITERIA) {
    const variants = [criterion.label, ...(criterion.variants || [])];
    let bestIndex = -1;
    let bestVariant = criterion.label;
    for (const variant of variants) {
      const normalizedVariant = normalizeLooseText(variant);
      const idx = normalizedSection.indexOf(normalizedVariant);
      if (idx >= 0 && (bestIndex < 0 || idx < bestIndex)) {
        bestIndex = idx;
        bestVariant = variant;
      }
    }
    if (bestIndex < 0 || seen.has(criterion.id)) continue;
    seen.add(criterion.id);
    const plainWindow = section.slice(Math.max(0, bestIndex - 180), Math.min(section.length, bestIndex + bestVariant.length + 220));
    let rawWindow = '';
    const rawNeedle = bestVariant.split(/\s+/).filter(Boolean).slice(0, 3).join(' ');
    const rawIdx = rawNeedle ? rawHtmlSection.toLowerCase().indexOf(rawNeedle.toLowerCase()) : -1;
    if (rawIdx >= 0) {
      const currentPosition = rawCriteriaPositions.find(item => item.id === criterion.id) || { rawIdx, endIdx: rawIdx + rawNeedle.length };
      const previous = [...rawCriteriaPositions].reverse().find(item => item.rawIdx < currentPosition.rawIdx);
      const next = rawCriteriaPositions.find(item => item.rawIdx > currentPosition.rawIdx);
      const currentDivStart = rawHtmlSection.lastIndexOf('<div', currentPosition.rawIdx);
      const currentLiStart = rawHtmlSection.lastIndexOf('<li', currentPosition.rawIdx);
      const nextDivStart = next ? rawHtmlSection.lastIndexOf('<div', next.rawIdx) : -1;
      const nextLiStart = next ? rawHtmlSection.lastIndexOf('<li', next.rawIdx) : -1;
      const nextItemStart = [nextDivStart, nextLiStart, next?.rawIdx ?? -1].filter(value => value >= 0).sort((a, b) => a - b)[0];
      const boundedStart = Math.max(0, previous?.endIdx ?? 0, currentDivStart, currentLiStart, currentPosition.rawIdx - 900);
      const boundedEnd = Math.min(rawHtmlSection.length, nextItemStart ?? (currentPosition.rawIdx + bestVariant.length + 900));
      rawWindow = rawHtmlSection.slice(boundedStart, boundedEnd);
    }
    const explicit = detectStockChecklistPassed(rawWindow, plainWindow, criterion.id);
    const derived = explicit === undefined
      ? deriveStockChecklistStatusFromInvestidor10({ criterionId: criterion.id, html, fundamentalIndicators: context?.fundamentalIndicators || {}, canonical: context?.canonical || {}, buyHoldRanking: context?.buyHoldRanking || null })
      : { passed: explicit, source: 'Investidor10 checklist buy and hold', evidence: 'marcação explícita no HTML' };
    const passed = derived?.passed === true ? true : (derived?.passed === false ? false : null);
    items.push({
      id: criterion.id,
      label: criterion.label,
      passed,
      status: statusCodeFromPassed(passed),
      statusLabel: statusLabelFromPassed(passed),
      help: criterion.help,
      source: derived?.source || 'Investidor10 checklist buy and hold',
      sourceUrl: symbol ? `https://investidor10.com.br/acoes/${symbol.toLowerCase()}/` : undefined,
      evidence: derived?.evidence || undefined
    });
  }
  const finalItems = items.slice(0, STOCK_BUY_HOLD_CHECKLIST_CRITERIA.length);
  const passedCount = finalItems.filter(item => item.passed === true).length;
  const failedCount = finalItems.filter(item => item.passed === false).length;
  const unknownCount = finalItems.filter(item => item.passed !== true && item.passed !== false).length;
  return {
    id: 'stock_buy_hold_checklist',
    title: symbol ? `Checklist do Investidor Buy and Hold sobre ${symbol}` : 'Checklist do Investidor Buy and Hold',
    subtitle: 'Critérios de qualidade do Investidor10 para leitura buy and hold da ação.',
    status: finalItems.length ? 'OK' : 'EMPTY',
    source: 'Investidor10',
    sourceUrl: symbol ? `https://investidor10.com.br/acoes/${symbol.toLowerCase()}/` : undefined,
    total: finalItems.length,
    passed: passedCount,
    failed: failedCount,
    unknown: unknownCount,
    items: finalItems,
    disclaimer: extractStockChecklistDisclaimer(section) || 'Esta ferramenta de checklist é fornecida apenas para fins informativos e não constitui recomendação de investimento. A pontuação baseia-se em parâmetros de mercado, mas não garante resultados futuros.',
    diagnostics: { found: true, criteriaFound: items.length, policy: 'official_i10_marking_then_real_i10_metric_derivation', rankingScore: context?.buyHoldRanking?.score ?? null }
  };
}

function extractTitleName(html = '', ticker = '') {
  const plain = htmlToPlainText(html);
  const symbol = String(ticker || '').toUpperCase();
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1];
  const title = cleanText(h1 || plain.match(new RegExp(`${symbol}\\s+([^|•]+?)(?:\\s+Cotação|\\s+Indicadores|\\s+Resultados|$)`, 'i'))?.[1] || '');
  return title ? title.replace(new RegExp(`^${symbol}\\s*`, 'i'), '').trim() : symbol;
}


function formatIndicatorHistoryValue(rawValue, rawType = '') {
  const cleaned = cleanText(String(rawValue ?? '')).replace(/\s+/g, ' ').trim();
  if (!cleaned || cleaned === '-' || cleaned === '—') return '-';
  if (/[R$%]|,/.test(cleaned) || /(?:mil|mi|bi|tri|bilh|milh)/i.test(cleaned)) return cleaned.replace(/\s+%/g, '%');
  const numericRaw = String(rawValue ?? '').trim();
  const numericNormalized = numericRaw.includes(',')
    ? numericRaw.replace(/\./g, '').replace(',', '.')
    : numericRaw.replace(/\s+/g, '');
  const n = Number(numericNormalized);
  if (!Number.isFinite(n)) return cleaned.replace(/\s+%/g, '%');
  const type = String(rawType || '').toLowerCase();
  const dec = (v, d = 2) => v.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
  if (type.includes('percent')) return `${dec(n, 2)}%`;
  if (type.includes('money')) return `R$ ${dec(n, 2)}`;
  return dec(n, 2);
}

const STOCK_HISTORICAL_LABELS = Object.freeze({
  pl: 'P/L',
  p_l: 'P/L',
  p_lucro: 'P/L',
  lucro_preco: 'P/L',
  preco_lucro: 'P/L',
  preco_por_lucro: 'P/L',
  preco_sobre_lucro: 'P/L',
  price_earnings: 'P/L',
  price_to_earnings: 'P/L',
  price_earning: 'P/L',
  pe: 'P/L',
  p_e: 'P/L',
  price_earnings_ratio: 'P/L',
  pvp: 'P/VP',
  p_vp: 'P/VP',
  pvpa: 'P/VP',
  p_vpa: 'P/VP',
  p_sobre_vp: 'P/VP',
  preco_vp: 'P/VP',
  preco_vpa: 'P/VP',
  preco_sobre_vp: 'P/VP',
  preco_sobre_valor_patrimonial: 'P/VP',
  price_to_book: 'P/VP',
  pb: 'P/VP',
  p_b: 'P/VP',
  price_book: 'P/VP',
  p_receita_psr: 'P/Receita (PSR)',
  p_receita: 'P/Receita (PSR)',
  preco_receita: 'P/Receita (PSR)',
  preco_sobre_receita: 'P/Receita (PSR)',
  preco_por_receita: 'P/Receita (PSR)',
  psr: 'P/Receita (PSR)',
  p_sr: 'P/Receita (PSR)',
  price_sales: 'P/Receita (PSR)',
  price_to_sales: 'P/Receita (PSR)',
  p_sales: 'P/Receita (PSR)',
  p_s: 'P/Receita (PSR)',
  price_sales_ratio: 'P/Receita (PSR)',
  dividend_yield: 'Dividend Yield',
  dividendyield: 'Dividend Yield',
  dividend_yield_dy: 'Dividend Yield',
  div_yield: 'Dividend Yield',
  dividend_yield_12m: 'Dividend Yield',
  dy: 'Dividend Yield',
  dy_12m: 'Dividend Yield',
  dividend_yield_atual: 'Dividend Yield',
  yield: 'Dividend Yield',
  payout: 'Payout',
  payout_ratio: 'Payout',
  margem_liquida: 'Margem Líquida',
  margemliquida: 'Margem Líquida',
  net_margin: 'Margem Líquida',
  margem_bruta: 'Margem Bruta',
  margembruta: 'Margem Bruta',
  gross_margin: 'Margem Bruta',
  margem_ebit: 'Margem Ebit',
  margemebit: 'Margem Ebit',
  ebit_margin: 'Margem Ebit',
  margem_ebitda: 'Margem Ebitda',
  margemebitda: 'Margem Ebitda',
  margem_ebitida: 'Margem Ebitda',
  margem_ebtda: 'Margem Ebitda',
  margem_ebtida: 'Margem Ebitda',
  margem_ebit_da: 'Margem Ebitda',
  ebitda_margin: 'Margem Ebitda',
  ev_ebitda: 'EV/Ebitda',
  ev_ebit_da: 'EV/Ebitda',
  enterprise_value_ebitda: 'EV/Ebitda',
  ev_ebit: 'EV/Ebit',
  enterprise_value_ebit: 'EV/Ebit',
  p_ebitda: 'P/Ebitda',
  p_ebit_da: 'P/Ebitda',
  preco_ebitda: 'P/Ebitda',
  p_ebit: 'P/Ebit',
  preco_ebit: 'P/Ebit',
  p_ativo: 'P/Ativo',
  preco_ativo: 'P/Ativo',
  preco_sobre_ativo: 'P/Ativo',
  p_cap_giro: 'P/Cap.Giro',
  p_capital_giro: 'P/Cap.Giro',
  preco_capital_giro: 'P/Cap.Giro',
  p_ativo_circ_liq: 'P/Ativo Circ. Liq.',
  p_ativ_circ_liq: 'P/Ativo Circ. Liq.',
  p_ativo_circulante_liquido: 'P/Ativo Circ. Liq.',
  preco_ativo_circulante_liquido: 'P/Ativo Circ. Liq.',
  vpa: 'VPA',
  valor_patrimonial_acao: 'VPA',
  valor_patrimonial_por_acao: 'VPA',
  book_value_per_share: 'VPA',
  lpa: 'LPA',
  lucro_por_acao: 'LPA',
  earnings_per_share: 'LPA',
  eps: 'LPA',
  giro_ativos: 'Giro Ativos',
  giro_do_ativo: 'Giro Ativos',
  asset_turnover: 'Giro Ativos',
  roe: 'ROE',
  return_on_equity: 'ROE',
  roic: 'ROIC',
  return_on_invested_capital: 'ROIC',
  roa: 'ROA',
  return_on_assets: 'ROA',
  divida_liquida_patrimonio: 'Dívida Líquida / Patrimônio',
  divida_liquida_patrimonio_liquido: 'Dívida Líquida / Patrimônio',
  divida_liquida_pl: 'Dívida Líquida / Patrimônio',
  div_liquida_pl: 'Dívida Líquida / Patrimônio',
  dl_patrimonio: 'Dívida Líquida / Patrimônio',
  dl_pl: 'Dívida Líquida / Patrimônio',
  net_debt_equity: 'Dívida Líquida / Patrimônio',
  net_debt_to_equity: 'Dívida Líquida / Patrimônio',
  divida_liquida_ebitda: 'Dívida Líquida / Ebitda',
  div_liquida_ebitda: 'Dívida Líquida / Ebitda',
  dl_ebitda: 'Dívida Líquida / Ebitda',
  divida_liquida_ebit_da: 'Dívida Líquida / Ebitda',
  net_debt_ebitda: 'Dívida Líquida / Ebitda',
  net_debt_to_ebitda: 'Dívida Líquida / Ebitda',
  divida_liquida_ebit: 'Dívida Líquida / Ebit',
  div_liquida_ebit: 'Dívida Líquida / Ebit',
  dl_ebit: 'Dívida Líquida / Ebit',
  net_debt_ebit: 'Dívida Líquida / Ebit',
  net_debt_to_ebit: 'Dívida Líquida / Ebit',
  divida_bruta_patrimonio: 'Dívida Bruta / Patrimônio',
  divida_bruta_patrimonio_liquido: 'Dívida Bruta / Patrimônio',
  divida_bruta_pl: 'Dívida Bruta / Patrimônio',
  div_bruta_pl: 'Dívida Bruta / Patrimônio',
  db_pl: 'Dívida Bruta / Patrimônio',
  gross_debt_equity: 'Dívida Bruta / Patrimônio',
  gross_debt_to_equity: 'Dívida Bruta / Patrimônio',
  patrimonio_ativos: 'Patrimônio / Ativos',
  patrimonio_ativo: 'Patrimônio / Ativos',
  equity_assets: 'Patrimônio / Ativos',
  equity_to_assets: 'Patrimônio / Ativos',
  passivos_ativos: 'Passivos / Ativos',
  passivo_ativo: 'Passivos / Ativos',
  liabilities_assets: 'Passivos / Ativos',
  liabilities_to_assets: 'Passivos / Ativos',
  liquidez_corrente: 'Liquidez Corrente',
  current_liquidity: 'Liquidez Corrente',
  current_ratio: 'Liquidez Corrente',
  cagr_receitas_5_anos: 'CAGR Receitas 5 anos',
  cagr_receitas5_anos: 'CAGR Receitas 5 anos',
  cagrreceitas5anos: 'CAGR Receitas 5 anos',
  receita_cagr_5_anos: 'CAGR Receitas 5 anos',
  revenue_cagr_5_years: 'CAGR Receitas 5 anos',
  cagr_lucros_5_anos: 'CAGR Lucros 5 anos',
  cagr_lucros5_anos: 'CAGR Lucros 5 anos',
  cagrlucros5anos: 'CAGR Lucros 5 anos',
  lucro_cagr_5_anos: 'CAGR Lucros 5 anos',
  profit_cagr_5_years: 'CAGR Lucros 5 anos',
  earnings_cagr_5_years: 'CAGR Lucros 5 anos'
});

function canonicalStockHistoricalLabel(label = '') {
  const raw = cleanText(label);
  const key = stockHistoryNormalizedKey(raw.replace(/\//g, ' '));
  return STOCK_HISTORICAL_LABELS[key] || STOCK_HISTORICAL_LABELS[stockHistoryNormalizedKey(raw)] || raw.replace(/\s+/g, ' ').trim();
}

function stockHistoryMetricKind(label = '') {
  const canonical = canonicalStockHistoricalLabel(label);
  if (/^(?:Dividend Yield|Payout|Margem Líquida|Margem Bruta|Margem Ebit|Margem Ebitda|ROE|ROIC|ROA|CAGR Receitas 5 anos|CAGR Lucros 5 anos)$/i.test(canonical)) return 'percent';
  return '';
}

function stockHistoryColumnOrder(columns = []) {
  const unique = Array.from(new Set((columns || []).map(col => String(col || '').trim()).filter(Boolean)));
  unique.sort((a, b) => {
    if (/^atual$/i.test(a) && !/^atual$/i.test(b)) return -1;
    if (/^atual$/i.test(b) && !/^atual$/i.test(a)) return 1;
    const na = Number(a); const nb = Number(b);
    if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) return nb - na;
    return String(a).localeCompare(String(b), 'pt-BR', { numeric: true });
  });
  return unique;
}

function stockHistoryRowOrderIndex(label = '') {
  const order = [
    'P/L','P/Receita (PSR)','P/VP','Dividend Yield','Payout','Margem Líquida','Margem Bruta','Margem Ebit','Margem Ebitda',
    'EV/Ebitda','EV/Ebit','P/Ebitda','P/Ebit','P/Ativo','P/Cap.Giro','P/Ativo Circ. Liq.','VPA','LPA','Giro Ativos',
    'ROE','ROIC','ROA','Dívida Líquida / Patrimônio','Dívida Líquida / Ebitda','Dívida Líquida / Ebit',
    'Dívida Bruta / Patrimônio','Patrimônio / Ativos','Passivos / Ativos','Liquidez Corrente','CAGR Receitas 5 anos','CAGR Lucros 5 anos'
  ];
  const index = order.indexOf(label);
  return index >= 0 ? index : 999;
}

function stockHistoryNormalizedKey(value = '') {
  return cleanText(String(value || ''))
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\+/g, ' mais ')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function stockHistoryColumnLabel(raw = '') {
  const text = cleanText(String(raw ?? '')).replace(/\s+/g, ' ').trim();
  if (!text) return '';
  if (stockHistoryMetaKey(text)) return '';
  const key = stockHistoryNormalizedKey(text);
  if (/^(atual|actual|current|latest|ultimo|ultima|hoje|ttm|ultimos_12_meses|ult_12_meses|ult_12m|ult_12_m|ult12m|ult12_meses|last_12_months|last_12m|ltm)$/i.test(key)) return 'Atual';
  const year = text.match(/(?:^|\b)(20\d{2}|19\d{2})(?:\b|$)/)?.[1];
  if (year) return year;
  if (/^(5a|5_anos|5anos|5y|5_years|cinco_anos|10a|10_anos|10anos|10y|10_years|dez_anos)$/i.test(key)) return '';
  if (/^(indicador|indicadores|indicator|metric|metrica|nome|label|name|id|key|acoes|acao)$/i.test(key)) return '';
  return /^[-+]?\d+(?:[,.]\d+)?\s*%?$/.test(text) ? '' : (text.length <= 24 ? text : '');
}

function stockHistoryPeriodKey(raw = '') {
  const key = stockHistoryNormalizedKey(raw);
  if (!key) return '';
  if (/^(5|5a|5_anos|5anos|5y|5_years|fiveyears|five_years|cincoanos|cinco_anos|ultimos_5_anos|ultimo_5_anos|last_5_years|periodo_5a|period_5y)$/.test(key)) return '5y';
  if (/^(10|10a|10_anos|10anos|10y|10_years|tenyears|ten_years|dezanos|dez_anos|ultimos_10_anos|ultimo_10_anos|last_10_years|periodo_10a|period_10y)$/.test(key)) return '10y';
  return key;
}


const STOCK_HISTORICAL_CONTAINER_KEYS = Object.freeze([
  'historicoIndicadores','historico_indicadores','historico_indicadores_fundamentalistas','historicoIndicadoresFundamentalistas',
  'indicadoresHistoricos','indicadores_historicos','indicadoresFundamentalistasHistorico','indicadores_fundamentalistas_historico',
  'historicIndicators','historic_indicators','historicalIndicators','historical_indicators','indicatorHistory','indicator_history',
  'indicatorsHistory','indicators_history','fundamentalHistory','fundamental_history','fundamentalsHistory','fundamentals_history',
  'fundamentalIndicatorHistory','fundamental_indicator_history','fundamentalIndicatorsHistory','fundamental_indicators_history',
  'historyIndicators','history_indicators','historicalMetrics','historical_metrics','metricHistory','metric_history','ratiosHistory','ratios_history',
  'ratioHistory','ratio_history','fundamentalistHistory','fundamentalist_history','seriesHistoricas','series_historicas',
  'historical','history','historico','historic','histories','historics','fundamentals','fundamental','ratios','indicadores','indicators','metrics','metricas',
  'table','tabela','rows','linhas','items','chart','chartData','payload','data','result','response','results'
]);

function stockHistoricalContainerKeyMatch(key = '') {
  const compact = stockHistoryNormalizedKey(key);
  return STOCK_HISTORICAL_CONTAINER_KEYS.some(item => stockHistoryNormalizedKey(item) === compact)
    || /(historico|history|historic|indicador|indicator|fundamental|fundamento|fundamentalist|ratio|metric)/i.test(compact);
}

function isStockHistoricalMetricLabel(label = '') {
  const clean = cleanText(label);
  if (!clean || clean.length > 80) return false;
  const key = stockHistoryNormalizedKey(clean.replace(/\//g, ' '));
  if (STOCK_HISTORICAL_LABELS[key] || STOCK_HISTORICAL_LABELS[stockHistoryNormalizedKey(clean)]) return true;
  return /^(p\s*\/\s*l|p\s*\/\s*vp|p\s*\/\s*receita|dividend\s+yield|payout|margem\s+(?:l[ií]quida|bruta|ebit|ebitda|ebtda)|ev\s*\/\s*ebit|p\s*\/\s*ebit|p\s*\/\s*ativo|vpa|lpa|giro\s+ativos|roe|roic|roa|d[ií]vida|patrim[oô]nio\s*\/\s*ativos|passivos\s*\/\s*ativos|liquidez\s+corrente|cagr\s+(?:receitas|lucros))/i.test(clean);
}

function stockHistoryMetaKey(label = '') {
  const key = stockHistoryNormalizedKey(label);
  return /^(data|rows|linhas|items|columns|colunas|headers|cabecalho|categories|labels|years|year|ano|anos|period|periodo|periods|periodos|series|datasets|source|provider|status|title|titulo|subtitle|subtitulo|description|descricao|descriptions|descricoes|desc|help|ajuda|tooltip|legend|legenda|note|notes|nota|notas|disclaimer|warning|aviso|selected|selectedperiod|selected_period|active|activeperiod|tablesbyperiod|periodtables|tables|periodsdata|options|xaxis|x_axis|chart|charts|colors|color|type|tipo|unit|unidade|format|formatter|icon|icone|link|url|href|name|value|valor|amount|total|display|formatted|text|y|v|valornumerico|valor_numerico|indicatorvalue|indicator_value|metricvalue|metric_value)$/.test(key);
}

function stockHistoryValueFromCell(cell, fallbackType = '') {
  if (cell == null) return '';
  if (typeof cell === 'object') {
    const raw = cell.display ?? cell.formatted ?? cell.text ?? cell.value ?? cell.valor ?? cell.amount ?? cell.total ?? cell.y ?? cell.current ?? cell.atual ?? cell.v;
    const type = cell.type ?? cell.tipo ?? cell.format ?? cell.formatter ?? cell.unit ?? cell.unidade ?? fallbackType;
    return formatIndicatorHistoryValue(raw, type);
  }
  return formatIndicatorHistoryValue(cell, fallbackType);
}

function stockHistoryColumnFromPoint(item, index = 0) {
  if (!item || typeof item !== 'object') return '';
  const has = key => Object.prototype.hasOwnProperty.call(item, key);
  const currentFlag = has('current') || has('atual') || has('latest') || has('ultimo') || has('ultima');
  return stockHistoryColumnLabel(item.period ?? item.periodo ?? item.year ?? item.ano ?? item.fiscalYear ?? item.fiscal_year ?? item.exercicio ?? item.competencia ?? item.label ?? item.date ?? item.data ?? item.x ?? item.name ?? item.key ?? (currentFlag ? 'Atual' : '')) || (index === 0 && currentFlag ? 'Atual' : '');
}

function stockHistoryLabelValue(raw) {
  if (raw == null) return '';
  if (typeof raw === 'object') {
    return raw.label ?? raw.name ?? raw.title ?? raw.key ?? raw.slug ?? raw.code ?? raw.codigo ?? raw.id ?? raw.value ?? raw.text ?? '';
  }
  return raw;
}

function stockHistoryLabelFromObject(row = {}) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) return '';
  const candidates = [
    row.label, row.indicador, row.indicator, row.indicatorName, row.indicator_name,
    row.name, row.title, row.key, row.metric, row.metrica, row.metricName, row.metric_name,
    row.slug, row.code, row.codigo, row.field, row.id
  ];
  for (const candidate of candidates) {
    const value = stockHistoryLabelValue(candidate);
    if (value != null && String(value).trim()) return value;
  }
  return '';
}

function stockHistoryExplicitValueFromRecord(row = {}) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) return undefined;
  const keys = ['value','valor','display','formatted','text','amount','total','y','v','raw','currentValue','current_value','indicatorValue','indicator_value','metricValue','metric_value','valorNumerico','valor_numerico'];
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(row, key)) return row[key];
  }
  return undefined;
}

function stockHistoryDirectValuesFromObject(row = {}) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) return undefined;
  return row.values ?? row.valores ?? row.periodValues ?? row.period_values ?? row.history ?? row.historico
    ?? row.historical ?? row.dataPoints ?? row.data_points ?? row.points ?? row.series ?? row.data;
}

function mergeStockHistoricalRows(targetRows, incomingRows) {
  const byId = new Map(targetRows.map(row => [row.id || metricId(row.label), row]));
  for (const row of incomingRows || []) {
    const id = row.id || metricId(row.label);
    const existing = byId.get(id);
    if (!existing) {
      const next = { ...row, id };
      targetRows.push(next);
      byId.set(id, next);
      continue;
    }
    existing.values = { ...(existing.values || {}), ...(row.values || {}) };
    existing.source = existing.source || row.source;
  }
}

function normalizeStockHistoricalIndicatorsDataset(data, options = {}) {
  if (!data || typeof data !== 'object') return { columns: [], rows: [], status: 'EMPTY' };
  const columns = [];
  const rows = [];
  const localSource = options.source || data?.source || data?.provider || 'Investidor10';
  const addColumn = (raw) => {
    const normalized = stockHistoryColumnLabel(raw);
    if (normalized && !columns.includes(normalized)) columns.push(normalized);
    return normalized;
  };
  const pushRow = (label, values = {}, source = localSource) => {
    const canonical = canonicalStockHistoricalLabel(label);
    if (!isStockHistoricalMetricLabel(canonical) && !isStockHistoricalMetricLabel(label)) return;
    const cleanValues = {};
    for (const [col, value] of Object.entries(values || {})) {
      const finalCol = addColumn(col);
      const finalValue = String(value ?? '').trim();
      if (finalCol && finalValue && finalValue !== 'undefined' && finalValue !== 'null') cleanValues[finalCol] = finalValue;
    }
    if (!canonical || !Object.keys(cleanValues).length) return;
    rows.push({ id: metricId(canonical), label: canonical, values: cleanValues, source });
  };
  const processPointArray = (label, values, source = localSource, fallbackColumns = []) => {
    if (!label || !Array.isArray(values) || !values.length) return;
    const rowValues = {};
    values.forEach((item, index) => {
      const col = stockHistoryColumnFromPoint(item, index) || stockHistoryColumnLabel(fallbackColumns[index]) || '';
      if (!col) return;
      rowValues[col] = stockHistoryValueFromCell(item, item?.type || item?.unit || stockHistoryMetricKind(label));
    });
    pushRow(label, rowValues, source);
  };
  const processValueObject = (label, rawValues, source = localSource, fallbackColumns = []) => {
    if (!label || rawValues == null) return;
    if (Array.isArray(rawValues)) {
      if (rawValues.length && rawValues.every(item => item && typeof item === 'object' && !Array.isArray(item))) {
        processPointArray(label, rawValues, source, fallbackColumns);
        return;
      }
      const cols = (fallbackColumns || []).map(stockHistoryColumnLabel).filter(Boolean);
      if (cols.length) {
        const values = {};
        rawValues.forEach((item, index) => {
          const col = cols[index];
          if (col) values[col] = stockHistoryValueFromCell(item, stockHistoryMetricKind(label));
        });
        pushRow(label, values, source);
      }
      return;
    }
    if (typeof rawValues !== 'object') return;
    const nestedValues = stockHistoryDirectValuesFromObject(rawValues);
    if (nestedValues != null && nestedValues !== rawValues) {
      processValueObject(label, nestedValues, rawValues.source || source, fallbackColumns);
      return;
    }
    const values = {};
    const valueType = rawValues.type || rawValues.tipo || rawValues.unit || rawValues.unidade || stockHistoryMetricKind(label);
    for (const [period, rawValue] of Object.entries(rawValues)) {
      if (stockHistoryMetaKey(period)) continue;
      const col = stockHistoryColumnLabel(period);
      if (!col) continue;
      values[col] = stockHistoryValueFromCell(rawValue, rawValue?.type || rawValue?.unit || valueType);
    }
    pushRow(label, values, source);
  };
  const parseArrayRow = (row, fallbackColumns = [], source = localSource) => {
    if (!Array.isArray(row) || !row.length) return;
    const cells = row.map(cell => typeof cell === 'object' ? (cell.label ?? cell.name ?? cell.indicador ?? cell.indicator ?? cell.text ?? cell.title ?? cell.key ?? cell.value ?? cell.valor ?? '') : cell);
    const labelIndex = cells.findIndex(cell => isStockHistoricalMetricLabel(cell));
    if (labelIndex < 0) return;
    const label = cells[labelIndex];
    const valueCells = row.slice(labelIndex + 1);
    const usableColumns = (fallbackColumns || []).map(stockHistoryColumnLabel).filter(Boolean);
    const rowValues = {};
    valueCells.forEach((cell, index) => {
      const col = usableColumns[index] || stockHistoryColumnFromPoint(cell, index) || '';
      if (!col) return;
      rowValues[col] = stockHistoryValueFromCell(cell, stockHistoryMetricKind(label));
    });
    pushRow(label, rowValues, source);
  };
  const parseIndexedObjectRow = (row, fallbackColumns = [], source = localSource) => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) return false;
    const numericEntries = Object.entries(row)
      .filter(([key]) => /^\d+$/.test(String(key)))
      .sort((a, b) => Number(a[0]) - Number(b[0]));
    if (!numericEntries.length) return false;
    const cells = numericEntries.map(([, value]) => value);
    const labelIndex = cells.findIndex(cell => isStockHistoricalMetricLabel(stockHistoryLabelValue(cell)));
    if (labelIndex < 0) return false;
    const rawLabel = stockHistoryLabelValue(cells[labelIndex]);
    const rowValues = {};
    const usableColumns = (fallbackColumns || []).map(stockHistoryColumnLabel).filter(Boolean);
    cells.slice(labelIndex + 1).forEach((cell, index) => {
      const col = usableColumns[index] || stockHistoryColumnFromPoint(cell, index) || '';
      if (!col) return;
      rowValues[col] = stockHistoryValueFromCell(cell, stockHistoryMetricKind(rawLabel));
    });
    const before = rows.length;
    pushRow(rawLabel, rowValues, source);
    return rows.length > before;
  };

  const parseObjectRow = (row, fallbackColumns = [], source = localSource) => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) return;
    if (parseIndexedObjectRow(row, fallbackColumns, source)) return;
    const label = stockHistoryLabelFromObject(row);
    if (!label) return;
    const recordColumn = stockHistoryColumnFromPoint(row);
    const recordValue = stockHistoryExplicitValueFromRecord(row);
    if (recordColumn && recordValue !== undefined && recordValue !== null && String(recordValue).trim() !== '') {
      return pushRow(label, { [recordColumn]: stockHistoryValueFromCell(recordValue, row.type || row.unit || stockHistoryMetricKind(label)) }, row.source || source);
    }
    const directValues = stockHistoryDirectValuesFromObject(row);
    if (Array.isArray(directValues)) return processValueObject(label, directValues, row.source || source, fallbackColumns);
    if (directValues && typeof directValues === 'object') return processValueObject(label, directValues, row.source || source, fallbackColumns);
    const values = {};
    for (const [key, value] of Object.entries(row)) {
      if (stockHistoryMetaKey(key)) continue;
      const col = stockHistoryColumnLabel(key);
      if (!col) continue;
      values[col] = stockHistoryValueFromCell(value, row.type || row.unit || stockHistoryMetricKind(label));
    }
    pushRow(label, values, row.source || source);
  };
  const parseMetricMap = (container, fallbackColumns = [], source = localSource, depth = 0) => {
    if (!container || typeof container !== 'object' || Array.isArray(container) || depth > 4) return false;
    let parsed = 0;
    for (const [key, value] of Object.entries(container)) {
      if (value == null) continue;
      const keyIsMetric = isStockHistoricalMetricLabel(key);
      if (keyIsMetric) {
        const before = rows.length;
        processValueObject(key, value, source, fallbackColumns);
        if (rows.length > before) parsed += 1;
        continue;
      }
      if (Array.isArray(value)) {
        const arrayObjects = value.filter(item => item && typeof item === 'object' && !Array.isArray(item));
        if (arrayObjects.length) {
          const before = rows.length;
          for (const item of arrayObjects) parseObjectRow(item, fallbackColumns, item.source || source);
          if (rows.length > before) parsed += rows.length - before;
        }
        continue;
      }
      if (typeof value !== 'object') continue;
      const nestedLabel = stockHistoryLabelFromObject(value);
      if (isStockHistoricalMetricLabel(nestedLabel)) {
        const before = rows.length;
        parseObjectRow(value, fallbackColumns, value.source || source);
        if (rows.length > before) parsed += 1;
        continue;
      }
      const before = rows.length;
      if (parseMetricMap(value, fallbackColumns, value.source || source, depth + 1)) {
        parsed += Math.max(1, rows.length - before);
      }
    }
    return parsed > 0;
  };
  const parseLongRecords = (rowArray, source = localSource) => {
    if (!Array.isArray(rowArray) || !rowArray.length) return false;
    const byMetric = new Map();
    let parsed = 0;
    for (const row of rowArray) {
      if (!row || typeof row !== 'object' || Array.isArray(row)) continue;
      const label = stockHistoryLabelFromObject(row);
      if (!isStockHistoricalMetricLabel(label)) continue;
      const col = stockHistoryColumnFromPoint(row);
      if (!col) continue;
      const rawValue = stockHistoryExplicitValueFromRecord(row);
      if (rawValue === undefined || rawValue === null || String(rawValue).trim() === '') continue;
      const canonical = canonicalStockHistoricalLabel(label);
      const values = byMetric.get(canonical) || {};
      values[col] = stockHistoryValueFromCell(rawValue, row.type || row.unit || stockHistoryMetricKind(canonical));
      byMetric.set(canonical, values);
      parsed += 1;
    }
    for (const [label, values] of byMetric.entries()) pushRow(label, values, source);
    return parsed > 0;
  };

  const parsePeriodRecords = (rowArray, source = localSource) => {
    if (!Array.isArray(rowArray) || !rowArray.length) return false;
    const periodRows = rowArray.filter(row => row && typeof row === 'object' && !Array.isArray(row) && stockHistoryColumnFromPoint(row));
    if (!periodRows.length) return false;
    const byMetric = new Map();
    for (const row of periodRows) {
      const col = stockHistoryColumnFromPoint(row);
      if (!col) continue;
      for (const [key, value] of Object.entries(row)) {
        if (stockHistoryMetaKey(key)) continue;
        if (!isStockHistoricalMetricLabel(key)) continue;
        const canonical = canonicalStockHistoricalLabel(key);
        const current = byMetric.get(canonical) || {};
        current[col] = stockHistoryValueFromCell(value, row.type || row.unit || stockHistoryMetricKind(canonical));
        byMetric.set(canonical, current);
      }
    }
    for (const [label, values] of byMetric.entries()) pushRow(label, values, source);
    return byMetric.size > 0;
  };
  const parseTabular = (root, source = localSource) => {
    if (!root || typeof root !== 'object') return;
    const headerCandidates = [root.columns, root.colunas, root.headers, root.cabecalho, root.header, root.periods, root.periodos, root.years, root.anos].filter(Array.isArray);
    let headerColumns = (headerCandidates.find(list => list.length) || []).map(item => typeof item === 'object' ? (item.label ?? item.name ?? item.title ?? item.text ?? item.key ?? item.data ?? item.field ?? item.value ?? '') : item);
    headerColumns = headerColumns.map(stockHistoryColumnLabel).filter(Boolean);
    headerColumns.forEach(addColumn);
    const rowArray = root.rows || root.linhas || root.items || root.indicators || root.indicadores || root.metrics || root.data || root.values || root.valores || root.aaData || root.aa_data || [];
    if (rowArray && typeof rowArray === 'object' && !Array.isArray(rowArray)) {
      parseMetricMap(rowArray, headerColumns, source);
      return;
    }
    if (!Array.isArray(rowArray) || !rowArray.length) return;
    let rowsToParse = rowArray;
    if (Array.isArray(rowArray[0])) {
      const possibleHeader = rowArray[0].map(cell => typeof cell === 'object' ? (cell.label ?? cell.name ?? cell.title ?? cell.key ?? cell.value ?? cell.valor ?? '') : cell);
      const possibleHeaderColumns = possibleHeader.map(stockHistoryColumnLabel).filter(Boolean);
      const hasHeader = possibleHeaderColumns.some(col => col === 'Atual' || /^\d{4}$/.test(col)) && !possibleHeader.some(cell => isStockHistoricalMetricLabel(cell));
      if (hasHeader) {
        headerColumns = possibleHeaderColumns;
        headerColumns.forEach(addColumn);
        rowsToParse = rowArray.slice(1);
      }
    }
    if (parseLongRecords(rowsToParse, source)) return;
    if (parsePeriodRecords(rowsToParse, source)) return;
    for (const row of rowsToParse) {
      if (Array.isArray(row)) parseArrayRow(row, headerColumns, source);
      else parseObjectRow(row, headerColumns, source);
    }
  };

  const categories = [
    data?.categories, data?.labels, data?.years, data?.anos, data?.periods, data?.periodos,
    data?.data?.categories, data?.data?.labels, data?.data?.years, data?.data?.anos, data?.data?.periods, data?.data?.periodos,
    data?.chart?.categories, data?.chart?.labels, data?.chart?.years, data?.chart?.periods, data?.chart?.periodos,
    data?.chartData?.categories, data?.chartData?.labels, data?.chartData?.years, data?.chartData?.periods, data?.chartData?.periodos,
    data?.payload?.categories, data?.payload?.labels, data?.payload?.years, data?.payload?.periods,
    data?.result?.categories, data?.result?.labels, data?.result?.years, data?.result?.periods,
    data?.xAxis?.categories, data?.xaxis?.categories, data?.options?.xaxis?.categories, data?.options?.xAxis?.categories
  ].find(list => Array.isArray(list) && list.length) || [];
  const rawCategories = categories.map(item => typeof item === 'object' ? (item.label ?? item.name ?? item.title ?? item.key ?? item.value ?? item.text ?? '') : item)
    .map(value => cleanText(String(value || '')).replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  const normalizedCategories = rawCategories.map(stockHistoryColumnLabel).filter(Boolean);
  const seriesRoots = [data, data?.data, data?.chart, data?.chartData, data?.payload, data?.result].filter(Boolean);
  let seriesCandidate = [];
  for (const root of seriesRoots) {
    const candidate = root?.series ?? root?.datasets ?? root?.dataset;
    if (Array.isArray(candidate) && candidate.length) { seriesCandidate = candidate; break; }
    if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) { seriesCandidate = Object.values(candidate); break; }
  }
  if (normalizedCategories.length && Array.isArray(seriesCandidate) && seriesCandidate.length) {
    normalizedCategories.forEach(addColumn);
    for (const series of seriesCandidate) {
      const label = series?.name || series?.label || series?.title || series?.key || series?.indicator || series?.indicador;
      const dataValues = Array.isArray(series?.data) ? series.data : (Array.isArray(series?.values) ? series.values : (Array.isArray(series?.valores) ? series.valores : []));
      if (!label || !dataValues.length) continue;
      const values = {};
      dataValues.forEach((rawValue, index) => {
        const col = normalizedCategories[index];
        if (col) values[col] = stockHistoryValueFromCell(rawValue, rawValue?.type || rawValue?.unit || series?.unit || stockHistoryMetricKind(label));
      });
      pushRow(label, values, series?.source || 'Investidor10 indicadores chart API');
    }
  }

  // Alguns endpoints do Investidor10 retornam o gráfico transposto:
  // categories/xAxis = indicadores e series/datasets = períodos/anos.
  // Nesse formato a versão anterior ignorava tudo porque "Atual/2025" não é rótulo de métrica.
  const metricCategories = rawCategories.map((label, index) => ({ label, index, canonical: canonicalStockHistoricalLabel(label) }))
    .filter(item => isStockHistoricalMetricLabel(item.canonical) || isStockHistoricalMetricLabel(item.label));
  if (metricCategories.length && Array.isArray(seriesCandidate) && seriesCandidate.length) {
    const transposedByMetric = new Map();
    for (const series of seriesCandidate) {
      const rawPeriod = series?.period ?? series?.periodo ?? series?.year ?? series?.ano ?? series?.name ?? series?.label ?? series?.title ?? series?.key;
      const col = stockHistoryColumnLabel(rawPeriod);
      if (!col) continue;
      addColumn(col);
      const dataValues = Array.isArray(series?.data) ? series.data : (Array.isArray(series?.values) ? series.values : (Array.isArray(series?.valores) ? series.valores : []));
      if (!dataValues.length) continue;
      for (const metric of metricCategories) {
        const rawValue = dataValues[metric.index];
        if (rawValue == null || rawValue === '') continue;
        const canonical = canonicalStockHistoricalLabel(metric.canonical || metric.label);
        const values = transposedByMetric.get(canonical) || {};
        values[col] = stockHistoryValueFromCell(rawValue, rawValue?.type || rawValue?.unit || series?.unit || stockHistoryMetricKind(canonical));
        transposedByMetric.set(canonical, values);
      }
    }
    for (const [label, values] of transposedByMetric.entries()) pushRow(label, values, 'Investidor10 indicadores chart API');
  }

  if (Array.isArray(data)) {
    if (data.length && Array.isArray(data[0])) {
      parseTabular({ data }, localSource);
    } else if (!parseLongRecords(data, localSource)) {
      for (const row of data) {
        if (Array.isArray(row)) parseArrayRow(row, [], localSource);
        else parseObjectRow(row, [], row?.source || localSource);
      }
    }
  } else {
    parseTabular(data, localSource);
    const root = data.data && typeof data.data === 'object' && !Array.isArray(data.data) ? data.data : data;
    if (root && typeof root === 'object' && !Array.isArray(root)) {
      for (const [label, rawValues] of Object.entries(root)) {
        if (stockHistoryMetaKey(label)) continue;
        if (isStockHistoricalMetricLabel(label)) {
          processValueObject(label, rawValues, localSource, normalizedCategories);
          continue;
        }
        if (rawValues && typeof rawValues === 'object' && !Array.isArray(rawValues)) {
          const nestedLabel = stockHistoryLabelFromObject(rawValues);
          if (isStockHistoricalMetricLabel(nestedLabel)) {
            parseObjectRow(rawValues, normalizedCategories, rawValues.source || localSource);
          } else {
            parseMetricMap(rawValues, normalizedCategories, rawValues.source || localSource);
          }
        }
      }
    }
  }

  if (!rows.length) {
    const candidateKeys = STOCK_HISTORICAL_CONTAINER_KEYS;
    for (const key of candidateKeys) {
      const child = data?.[key];
      if (!child || child === data) continue;
      const normalized = normalizeStockHistoricalIndicatorsDataset(child, { source: localSource });
      if (normalized.rows?.length) {
        normalized.columns.forEach(addColumn);
        mergeStockHistoricalRows(rows, normalized.rows);
        break;
      }
    }
  }

  const deduped = [];
  mergeStockHistoricalRows(deduped, rows);
  const valueColumns = new Set(deduped.flatMap(row => Object.keys(row.values || {})));
  const sortedColumns = stockHistoryColumnOrder([...columns, ...valueColumns]);
  deduped.sort((a, b) => stockHistoryRowOrderIndex(a.label) - stockHistoryRowOrderIndex(b.label) || a.label.localeCompare(b.label, 'pt-BR'));
  return { title: 'Histórico de indicadores fundamentalistas', columns: sortedColumns, rows: deduped, source: 'Investidor10', status: deduped.length ? 'OK' : 'EMPTY' };
}

function extractInvestidor10StockHistoricalIndicatorsFromHtml(html = '', ticker = '') {
  const source = String(html || '');
  if (!source) return { status: 'EMPTY', columns: [], rows: [] };
  const plain = htmlToPlainText(source).replace(/\s+/g, ' ');
  const start = plain.search(/HIST[ÓO]RICO\s+DE\s+INDICADORES\s+FUNDAMENTALISTAS/i);
  if (start < 0) return { status: 'EMPTY', columns: [], rows: [] };
  let section = plain.slice(start, start + 14000);
  const end = section.search(/(?:CHECKLIST\s+DO\s+INVESTIDOR|SOBRE\s+(?:A\s+)?EMPRESA|DIVIDENDOS\s+E\s+PROVENTOS|HIST[ÓO]RICO\s+DE\s+DIVIDENDOS|COMPARADOR|COMUNICADOS|RECEITAS\s+E\s+LUCROS)/i);
  if (end > 600) section = section.slice(0, end);
  const columns = [];
  if (/\bAtual\b/i.test(section)) columns.push('Atual');
  for (const year of [...section.matchAll(/\b(20\d{2}|19\d{2})\b/g)].map(m => m[1])) {
    if (!columns.includes(year)) columns.push(year);
  }
  const orderedColumns = stockHistoryColumnOrder(columns).slice(0, 11);
  if (!orderedColumns.length) return { status: 'EMPTY', columns: [], rows: [] };
  const labels = Object.values(STOCK_HISTORICAL_LABELS)
    .filter((value, index, arr) => arr.indexOf(value) === index)
    .sort((a, b) => b.length - a.length);
  const rows = [];
  const numberPattern = '[-+]?\\d{1,3}(?:\\.\\d{3})*(?:,\\d+)?\\s*%?|[-+]?\\d+(?:[,.]\\d+)?\\s*%?|[-+]?\\d{1,3}(?:\\.\\d{3})+(?:,\\d+)?';
  const metricHits = [];
  for (const label of labels) {
    const labelPattern = escapeRegExp(label).replace(/\\ /g, '\\s+');
    const re = new RegExp(`(?:^|[\\s,;|•])(${labelPattern})(?=[\\s:;,|•–—-])`, 'gi');
    for (const match of section.matchAll(re)) {
      const index = Number(match.index || 0) + match[0].indexOf(match[1]);
      metricHits.push({ label, index, end: index + match[1].length });
    }
  }
  metricHits.sort((a, b) => a.index - b.index || (b.end - b.index) - (a.end - a.index));
  const scopedHits = [];
  for (const hit of metricHits) {
    const last = scopedHits[scopedHits.length - 1];
    if (last && hit.index < last.end) continue;
    scopedHits.push(hit);
  }
  for (let hitIndex = 0; hitIndex < scopedHits.length; hitIndex += 1) {
    const hit = scopedHits[hitIndex];
    const next = scopedHits[hitIndex + 1];
    const slice = section.slice(hit.end, next ? next.index : Math.min(section.length, hit.end + 1100));
    const values = [...slice.matchAll(new RegExp(numberPattern, 'g'))]
      .map(m => cleanText(m[0]).replace(/\s+%/g, '%'))
      .filter(Boolean)
      .slice(0, orderedColumns.length);
    if (!values.length) continue;
    const rowValues = {};
    orderedColumns.forEach((col, index) => {
      if (values[index]) rowValues[col] = values[index];
    });
    if (Object.keys(rowValues).length) rows.push({ id: metricId(hit.label), label: hit.label, values: rowValues, source: 'Investidor10 HTML' });
  }
  if (!rows.length) {
    for (const label of labels) {
      const re = new RegExp(`${escapeRegExp(label).replace(/\\ /g, '\\s+')}(?:\\s|:|,|;|–|—|-)+((?:${numberPattern})(?:(?:\\s|,|;|\\|)+${numberPattern}){1,12})`, 'i');
      const match = section.match(re);
      if (!match?.[1]) continue;
      const values = [...match[1].matchAll(new RegExp(numberPattern, 'g'))].map(m => cleanText(m[0]).replace(/\s+%/g, '%'));
      if (!values.length) continue;
      const rowValues = {};
      orderedColumns.forEach((col, index) => {
        if (values[index]) rowValues[col] = values[index];
      });
      if (Object.keys(rowValues).length) rows.push({ id: metricId(label), label, values: rowValues, source: 'Investidor10 HTML' });
    }
  }
  const byId = [];
  mergeStockHistoricalRows(byId, rows);
  return { title: `Histórico de indicadores fundamentalistas ${String(ticker || '').toUpperCase()}`.trim(), columns: orderedColumns, rows: byId, source: 'Investidor10', status: byId.length ? 'OK' : 'EMPTY' };
}


function stockHistoryLooksLikeDatasetArray(value) {
  if (!Array.isArray(value)) return false;
  if (!value.length) return true;
  const first = value[0];
  if (first && typeof first === 'object' && !Array.isArray(first) && Array.isArray(first.rows) && Array.isArray(first.columns)) return false;
  return Array.isArray(first) || (first && typeof first === 'object' && (
    first.label || first.indicador || first.indicator ||
    first.values || first.valores || first.periodValues || first.period_values || first.history || first.historico
  ));
}

function stockHistoricalTableWithColumns(table = {}, requestedColumns = []) {
  const columns = stockHistoryColumnOrder(requestedColumns || []);
  const rows = (table.rows || [])
    .map(row => {
      const values = {};
      for (const column of columns) {
        const value = row.values?.[column];
        if (value != null && String(value).trim()) values[column] = String(value).trim();
      }
      return { ...row, values };
    })
    .filter(row => Object.keys(row.values || {}).length);
  return {
    ...table,
    columns,
    rows,
    status: rows.length ? 'OK' : 'EMPTY'
  };
}

function stockHistoricalAutoPeriodTables(normalized = {}) {
  const normalizedColumns = stockHistoryColumnOrder([...(normalized.columns || []), ...(normalized.rows || []).flatMap(row => Object.keys(row.values || {}))]);
  const currentColumn = normalizedColumns.find(column => /^Atual$/i.test(column));
  const yearColumns = normalizedColumns.filter(column => /^\d{4}$/.test(column)).sort((a, b) => Number(b) - Number(a));
  const prefix = currentColumn ? [currentColumn] : [];
  if (yearColumns.length > 5) {
    return {
      '5y': stockHistoricalTableWithColumns(normalized, [...prefix, ...yearColumns.slice(0, 5)]),
      '10y': stockHistoricalTableWithColumns(normalized, [...prefix, ...yearColumns.slice(0, 10)])
    };
  }
  return { '5y': stockHistoricalTableWithColumns(normalized, [...prefix, ...yearColumns]) };
}

function mergeStockHistoricalTable(existing = {}, incoming = {}) {
  const rows = [...(existing.rows || [])];
  mergeStockHistoricalRows(rows, incoming.rows || []);
  const columns = stockHistoryColumnOrder([...(existing.columns || []), ...(incoming.columns || []), ...rows.flatMap(row => Object.keys(row.values || {}))]);
  return {
    title: incoming.title || existing.title || 'Histórico de indicadores fundamentalistas',
    columns,
    rows,
    source: existing.source || incoming.source || 'Investidor10',
    status: rows.length ? 'OK' : 'EMPTY'
  };
}


function stockHistoryCandidateScore(value, path = '') {
  if (!value || typeof value !== 'object') return 0;
  const pathKey = compactKey(path);
  let score = 0;
  if (/(historico|history|historic|indicador|indicator|fundamental|fundamento|fundamentalist|ratio|ratios|metric|metrics)/i.test(pathKey)) score += 3;
  if (/(historicoindicadores|historicalindicators|fundamentalindicatorhistory|indicadoresfundamentalistas|indicatorhistory)/i.test(pathKey)) score += 8;
  const text = Array.isArray(value)
    ? JSON.stringify(value.slice(0, 8))
    : JSON.stringify(Object.fromEntries(Object.entries(value).slice(0, 40)));
  for (const spec of STOCK_FUNDAMENTAL_SPECS) {
    if (new RegExp(`(?:^|[^a-z0-9])${escapeRegExp(spec.id).replace(/_/g, '[_\\s-]*')}(?:$|[^a-z0-9])`, 'i').test(text)) score += 1;
    if (new RegExp(spec.aliases[0], 'i').test(text)) score += 1;
  }
  if (/Atual|Dividend\s*Yield|Payout|ROE|ROIC|P\s*\/\s*L|P\s*\/\s*VP|CAGR/i.test(text)) score += 3;
  if (/20\d{2}|19\d{2}|atual|current/i.test(text)) score += 2;
  return score;
}

function collectStockHistoricalIndicatorCandidates(payload, options = {}) {
  const candidates = [];
  const seen = new Set();
  const maxDepth = Number.isFinite(Number(options.maxDepth)) ? Number(options.maxDepth) : 10;
  const add = (value, path = '', reason = '') => {
    if (!value || typeof value !== 'object') return;
    const score = stockHistoryCandidateScore(value, path) + (reason ? 2 : 0);
    if (score < 4) return;
    candidates.push({ value, path, score, reason });
  };
  const walk = (value, path = 'root', depth = 0) => {
    if (!value || typeof value !== 'object' || depth > maxDepth) return;
    if (seen.has(value)) return;
    seen.add(value);
    const direct = normalizeStockHistoricalIndicatorsDataset(value, { source: 'Investidor10 REST asset ticker API' });
    if ((direct.rows || []).length) add(value, path, 'normalizable');
    const key = compactKey(path.split('.').pop() || path);
    if (stockHistoricalContainerKeyMatch(key)) add(value, path, 'semantic_key');
    if (Array.isArray(value)) {
      value.slice(0, 120).forEach((item, index) => walk(item, `${path}[${index}]`, depth + 1));
      return;
    }
    for (const [childKey, child] of Object.entries(value).slice(0, 180)) {
      const childPath = `${path}.${childKey}`;
      if (child && typeof child === 'object') walk(child, childPath, depth + 1);
    }
  };
  walk(payload);
  candidates.sort((a, b) => b.score - a.score || a.path.length - b.path.length);
  const deduped = [];
  const byPath = new Set();
  for (const candidate of candidates) {
    if (byPath.has(candidate.path)) continue;
    byPath.add(candidate.path);
    deduped.push(candidate.value);
    if (deduped.length >= 18) break;
  }
  return deduped;
}

function buildStockHistoricalIndicatorSources({ html = '', ticker = '', apiExtras = {} } = {}) {
  const sources = [];
  const fromHtml = extractInvestidor10StockHistoricalIndicatorsFromHtml(html || '', ticker || '');
  if ((fromHtml.rows || []).length) sources.push(fromHtml);
  const raw = apiExtras?.rawJson || {};
  const directSources = [
    raw.historicoIndicadoresNormalized,
    raw.stockHistoricalIndicatorsNormalized,
    raw.historicoIndicadores,
    raw.historicIndicators,
    raw.indicadoresHistoricos,
    raw.historicalIndicators,
    raw.indicatorHistory,
    ...(Array.isArray(raw.stockHistoricalIndicatorsDedicatedSources) ? raw.stockHistoricalIndicatorsDedicatedSources : []),
    ...(Array.isArray(raw.historicoIndicadoresSources) ? raw.historicoIndicadoresSources : []),
    raw.assetTickerRest,
    ...(Array.isArray(raw.assetTickerRestSources) ? raw.assetTickerRestSources : [])
  ].filter(Boolean);
  for (const item of directSources) {
    sources.push(item);
    for (const nested of collectStockHistoricalIndicatorCandidates(item, { maxDepth: 12 })) sources.push(nested);
  }
  // Auditoria v269: o endpoint /api/rest/assets/tickers/{TICKER} pode trocar a chave
  // que contém o histórico entre ativos. Por isso também varremos o envelope rawJson
  // inteiro e não apenas aliases conhecidos, mantendo filtragem por score/normalização.
  for (const nested of collectStockHistoricalIndicatorCandidates(raw, { maxDepth: 12 })) sources.push(nested);
  const embedded = apiExtras?.embedded || {};
  for (const key of STOCK_HISTORICAL_CONTAINER_KEYS) {
    if (embedded[key]) sources.push(embedded[key]);
  }
  return sources;
}

function normalizeStockHistoricalIndicatorsApi(data, ticker = '', fundamentalIndicators = {}) {
  const rawSources = Array.isArray(data) && !stockHistoryLooksLikeDatasetArray(data) ? data.filter(Boolean) : [data].filter(Boolean);
  const sources = [];
  for (const raw of rawSources) {
    if (!raw) continue;
    sources.push(raw);
    for (const nested of collectStockHistoricalIndicatorCandidates(raw, { maxDepth: 12 })) sources.push(nested);
  }
  return buildStockHistoricalIndicators(sources, ticker, fundamentalIndicators);
}

function buildStockHistoricalIndicators(rawHistory, ticker = '', fundamentalIndicators = {}) {
  const inputs = Array.isArray(rawHistory) && !stockHistoryLooksLikeDatasetArray(rawHistory)
    ? rawHistory.filter(Boolean)
    : [rawHistory].filter(Boolean);
  const tablesByPeriod = {};
  const normalizeCandidateTable = (candidate) => {
    const isAlreadyNormalized = candidate?.rows && Array.isArray(candidate.rows) && candidate?.columns
      && candidate.rows.every(row => row && typeof row === 'object' && !Array.isArray(row) && row.values && row.label);
    return isAlreadyNormalized ? candidate : normalizeStockHistoricalIndicatorsDataset(candidate || {});
  };
  const putTable = (periodKey, candidate) => {
    const key = ['5y', '10y'].includes(periodKey) ? periodKey : '5y';
    const normalized = normalizeCandidateTable(candidate);
    if (!(normalized.rows || []).length) return;
    tablesByPeriod[key] = mergeStockHistoricalTable(tablesByPeriod[key], normalized);
  };
  const putAutoPeriodTables = (candidate) => {
    const normalized = normalizeCandidateTable(candidate);
    if (!(normalized.rows || []).length) return;
    const autoTables = stockHistoricalAutoPeriodTables(normalized);
    for (const [key, table] of Object.entries(autoTables)) {
      if ((table.rows || []).length) tablesByPeriod[key] = mergeStockHistoricalTable(tablesByPeriod[key], table);
    }
  };

  for (const input of inputs) {
    const source = input?.data && typeof input.data === 'object' && !Array.isArray(input.data) && !input.rows && !input.columns ? input.data : input;
    if (!source) continue;
    let hasPeriodTables = false;
    if (source && typeof source === 'object' && !Array.isArray(source)) {
      const periodContainers = [source, source.tablesByPeriod, source.periodTables, source.periodsData, source.tables, source.data].filter(item => item && typeof item === 'object' && !Array.isArray(item));
      for (const container of periodContainers) {
        for (const [rawKey, value] of Object.entries(container)) {
          const periodKey = stockHistoryPeriodKey(rawKey);
          if (!['5y', '10y'].includes(periodKey)) continue;
          putTable(periodKey, value);
          hasPeriodTables = true;
        }
      }
    }
    if (!hasPeriodTables) putAutoPeriodTables(source);
  }

  const periods = Object.keys(tablesByPeriod).sort((a, b) => (a === '5y' ? -1 : (b === '5y' ? 1 : a.localeCompare(b))));
  const selectedPeriod = periods.includes('5y') ? '5y' : (periods[0] || '5y');
  const selected = tablesByPeriod[selectedPeriod] || { columns: [], rows: [], source: 'Investidor10', status: 'EMPTY' };
  return {
    id: 'stock_historical_indicators',
    title: `Histórico de indicadores fundamentalistas ${String(ticker || '').toUpperCase()}`.trim(),
    subtitle: 'Arraste o quadro para ver mais dados',
    source: 'Investidor10',
    status: selected.status || (selected.rows?.length ? 'OK' : 'EMPTY'),
    periods,
    selectedPeriod,
    tablesByPeriod,
    columns: selected.columns || [],
    rows: selected.rows || []
  };
}

function extractNearbyMetric(plain = '', labels = [], valuePattern = '[+-]?\\s*(?:R\\$\\s*)?\\d{1,3}(?:\\.\\d{3})*(?:,\\d+)?\\s*%?|[+-]?\\s*\\d+(?:[,.]\\d+)?\\s*%?') {
  const normalizedPlain = String(plain || '').replace(/\s+/g, ' ');
  for (const label of labels) {
    const re = new RegExp(`(?:^|\\s|>)(${label})\\s*:?\\s*(${valuePattern})`, 'i');
    const match = normalizedPlain.match(re);
    if (match?.[2]) return cleanText(match[2]).replace(/\s+/g, ' ').trim();
  }
  return '';
}

function extractStockVariation12mDisplay(plain = '', section = '', ticker = '') {
  const normalizedPlain = String(plain || '').replace(/\s+/g, ' ');
  const symbol = String(ticker || '').toUpperCase();
  const windows = [section, normalizedPlain.slice(0, 5200)];
  const rentStart = normalizedPlain.search(new RegExp(`Rentabilidade\s+(?:de\s+)?${symbol || '[A-Z0-9]{4,6}'}`, 'i'));
  if (rentStart >= 0) windows.push(normalizedPlain.slice(rentStart, rentStart + 2600));
  const summaryStart = normalizedPlain.search(/No\s+último\s+ano|12\s+meses|1\s+ano/i);
  if (summaryStart >= 0) windows.push(normalizedPlain.slice(Math.max(0, summaryStart - 300), summaryStart + 1800));
  const patterns = [
    /VARIA[ÇC][ÃA]O\s*\(\s*12M\s*\)\s*:?\s*([+-]?\s*\d{1,4}(?:[,.]\d+)?\s*%)/i,
    /Varia[çc][ãa]o\s+(?:em\s+)?12\s*M(?:eses)?\s*:?\s*([+-]?\s*\d{1,4}(?:[,.]\d+)?\s*%)/i,
    /No\s+último\s+ano[^.]{0,220}?(?:varia[çc][ãa]o|rentabilidade|cota[çc][ãa]o)[^.]{0,160}?([+-]?\s*\d{1,4}(?:[,.]\d+)?\s*%)/i,
    /(?:12\s+meses|1\s+ano)[^.]{0,160}?(?:varia[çc][ãa]o|rentabilidade|cota[çc][ãa]o)[^.]{0,160}?([+-]?\s*\d{1,4}(?:[,.]\d+)?\s*%)/i,
    /(?:varia[çc][ãa]o|rentabilidade|cota[çc][ãa]o)[^.]{0,160}?(?:12\s+meses|1\s+ano|último\s+ano)[^.]{0,160}?([+-]?\s*\d{1,4}(?:[,.]\d+)?\s*%)/i
  ];
  for (const source of windows) {
    const text = String(source || '').replace(/\s+/g, ' ');
    if (!text) continue;
    for (const re of patterns) {
      const value = text.match(re)?.[1];
      const n = parseBrNumber(value);
      if (value && Number.isFinite(Number(n)) && Math.abs(Number(n)) < 2000) return cleanText(value).replace(/\s+/g, '');
    }
  }
  return '';
}

export function extractInvestidor10StockQuickMetrics(html = '', ticker = '') {
  const plain = htmlToPlainText(html);
  const symbol = String(ticker || '').toUpperCase();
  const section = pickStockScopedPlainSection(plain, symbol, 4200);
  if (!section) return {};
  const priceDisplay = section.match(new RegExp(`\\b${escapeRegExp(symbol)}\\b[^R$]{0,160}(R\\$\\s*[\\d.,]+)`, 'i'))?.[1]
    || section.match(/(?:Cotação|Valor atual|Preço atual|Preco atual)\s*(R\$\s*[\d.,]+)/i)?.[1]
    || section.match(/(R\$\s*[\d.,]+)\s*[+-]?\s*\d{1,3}(?:[,.]\d+)?\s*%/i)?.[1]
    || '';
  const priceChunk = priceDisplay ? section.slice(Math.max(0, section.indexOf(priceDisplay)), Math.max(0, section.indexOf(priceDisplay)) + 110) : '';
  const dayChange = priceChunk.replace(priceDisplay, '').match(/[+-]?\s*\d{1,3}(?:[,.]\d+)?\s*%/)?.[0] || '';
  const variation12mDisplay = extractStockVariation12mDisplay(plain, section, symbol) || extractNearbyMetric(section, ['VARIA[ÇC][ÃA]O\\s*\\(12M\\)', 'Varia[çc][ãa]o\\s*\\(12M\\)', 'Varia[çc][ãa]o\\s+12M'], '[+-]?\\s*\\d{1,4}(?:[,.]\\d+)?\\s*%');
  const plDisplay = extractNearbyMetric(section, ['P\\s*\\/\\s*L', 'Preço\\s*\\/\\s*Lucro', 'Preco\\s*\\/\\s*Lucro'], '[+-]?\\s*\\d{1,6}(?:[,.]\\d+)?');
  const pvpDisplay = extractNearbyMetric(section, ['P\\s*\\/\\s*VP', 'PVP', 'Preço\\s*\\/\\s*Valor\\s*Patrimonial', 'Preco\\s*\\/\\s*Valor\\s*Patrimonial'], '[+-]?\\s*\\d{1,6}(?:[,.]\\d+)?');
  let dyDisplay = extractNearbyMetric(section, ['DY', 'Dividend\\s+Yield', 'Dividend\\s+Yield\\s*\\(12M\\)'], '[+-]?\\s*\\d{1,4}(?:[,.]\\d+)?\\s*%');
  if (!dyDisplay) {
    const dyBlock = section.match(/Dividend\s+Yield\s+([+-]?\s*\d{1,4}(?:[,.]\d+)?\s*%)/i);
    if (dyBlock?.[1]) dyDisplay = cleanText(dyBlock[1]);
  }

  const out = {
    priceDisplay: priceDisplay.replace(/\s+/g, ' ').trim(),
    price: parseBrNumber(priceDisplay),
    changeDisplay: dayChange.replace(/\s+/g, ''),
    changePercent: parseBrNumber(dayChange),
    variation12mDisplay: variation12mDisplay.replace(/\s+/g, ''),
    variation12mPercent: parseBrNumber(variation12mDisplay),
    plDisplay,
    pl: parseBrNumber(plDisplay),
    pvpDisplay,
    pvp: parseBrNumber(pvpDisplay),
    dyDisplay: dyDisplay.replace(/\s+/g, ''),
    dy: parseBrNumber(dyDisplay)
  };
  return Object.fromEntries(Object.entries(out).filter(([, value]) => value !== null && value !== undefined && value !== ''));
}


function trimInvestidor10StockFundamentalsSection(plain = '', ticker = '') {
  const text = String(plain || '').replace(/\s+/g, ' ').trim();
  const symbol = String(ticker || '').toUpperCase();
  const starts = [
    text.search(new RegExp(`INDICADORES\\s+FUNDAMENTALISTAS\\s+${symbol}`, 'i')),
    text.search(/INDICADORES\s+FUNDAMENTALISTAS/i),
    text.search(/CONFIRA\s+OS\s+FUNDAMENTOS\s+DAS\s+A[ÇC][ÕO]ES/i),
    text.search(/Sem\s+comparativos/i)
  ].filter(index => index >= 0);
  const start = starts.length ? Math.min(...starts) : 0;
  let section = text.slice(start, start + 14000);
  const endPatterns = [
    /HIST[ÓO]RICO\s+DE\s+INDICADORES/i,
    /Rentabilidade\s+de/i,
    /Receitas\s+e\s+Lucros/i,
    /Resultados\s+e\s+Balan[çc]os/i,
    /SOBRE\s+A\s+EMPRESA/i,
    /DIVIDENDOS/i,
    /COMUNICADOS/i
  ];
  const end = endPatterns.map(re => section.search(re)).filter(index => index > 360).sort((a, b) => a - b)[0];
  if (Number.isFinite(end)) section = section.slice(0, end);
  return section;
}

function displayFundamentalValue(rawValue = '', valueKind = 'decimal') {
  const raw = cleanText(rawValue).replace(/\s+/g, ' ').trim();
  if (!raw || raw === '-' || raw === '—') return '—';
  if (valueKind === 'percent' && !raw.includes('%')) return `${raw}%`;
  return raw.replace(/\s+%/g, '%');
}

function findStockFundamentalValue(section = '', spec = {}) {
  const valuePattern = '([+-]?\\s*(?:R\\$\\s*)?\\d{1,3}(?:\\.\\d{3})*(?:,\\d+)?\\s*%?|[+-]?\\s*\\d+(?:[,.]\\d+)?\\s*%?)';
  for (const alias of spec.aliases || []) {
    const re = new RegExp(`(?:^|\\s)${alias}(?=\\s|:|$)\\s*:?\\s*${valuePattern}`, 'i');
    const match = String(section || '').match(re);
    if (match?.[1]) return displayFundamentalValue(match[1], spec.valueKind);
  }
  return '';
}

export function extractInvestidor10StockFundamentalIndicators(html = '', ticker = '', quickMetrics = {}) {
  const plain = htmlToPlainText(html);
  const section = trimInvestidor10StockFundamentalsSection(plain, ticker);
  const byId = new Map();
  for (const spec of STOCK_FUNDAMENTAL_SPECS) {
    let value = findStockFundamentalValue(section, spec);
    if (!value && spec.id === 'pl' && quickMetrics.plDisplay) value = displayFundamentalValue(quickMetrics.plDisplay, spec.valueKind);
    if (!value && spec.id === 'pvp' && quickMetrics.pvpDisplay) value = displayFundamentalValue(quickMetrics.pvpDisplay, spec.valueKind);
    if (!value && spec.id === 'dividend_yield' && quickMetrics.dyDisplay) value = displayFundamentalValue(quickMetrics.dyDisplay, spec.valueKind);
    if (!value) continue;
    const numeric = parseBrNumber(value);
    byId.set(spec.id, {
      id: spec.id,
      label: spec.label,
      value,
      numericValue: Number.isFinite(Number(numeric)) ? round(Number(numeric), 4) : null,
      valueKind: spec.valueKind,
      group: spec.group,
      source: 'Investidor10 indicadores fundamentalistas'
    });
  }

  const items = STOCK_FUNDAMENTAL_SPECS.map(spec => byId.get(spec.id)).filter(Boolean);
  const groups = STOCK_FUNDAMENTAL_GROUPS.map(group => ({
    ...group,
    items: items.filter(item => item.group === group.id)
  })).filter(group => group.items.length);

  return {
    id: 'stock_fundamental_indicators',
    title: `Indicadores fundamentalistas ${String(ticker || '').toUpperCase()}`.trim(),
    subtitle: `Confira os fundamentos das ações ${String(ticker || '').toUpperCase()}`.trim(),
    status: items.length ? 'OK' : 'EMPTY',
    source: 'Investidor10 indicadores fundamentalistas',
    comparator: {
      selected: 'Sem comparativos',
      options: ['Sem comparativos'],
      source: 'Investidor10'
    },
    displayModes: ['grid', 'list'],
    groups,
    items,
    diagnostics: {
      expected: STOCK_FUNDAMENTAL_SPECS.length,
      extracted: items.length,
      sectionChars: section.length
    }
  };
}

function returnsRowsFromInvestidor10Profitability(canonical = {}) {
  const profitability = canonical?.profitability || {};
  const periods = Array.isArray(profitability.periods) && profitability.periods.length
    ? profitability.periods
    : STOCK_MODAL_PERIODS.map(period => period.label);
  const nominalByPeriod = new Map((profitability.nominal || []).map(item => [item.period || item.label, item]));
  const realByPeriod = new Map((profitability.real || []).map(item => [item.period || item.label, item]));
  return periods.map(label => {
    const nominal = nominalByPeriod.get(label);
    const real = realByPeriod.get(label);
    const key = metricId(label);
    return {
      key,
      label,
      returnPercent: Number.isFinite(Number(nominal?.valuePercent)) ? round(Number(nominal.valuePercent), 4) : null,
      returnDisplay: nominal?.raw || (Number.isFinite(Number(nominal?.valuePercent)) ? formatPercent(Number(nominal.valuePercent)) : '—'),
      realReturnPercent: Number.isFinite(Number(real?.valuePercent)) ? round(Number(real.valuePercent), 4) : null,
      realReturnDisplay: real?.raw || (Number.isFinite(Number(real?.valuePercent)) ? formatPercent(Number(real.valuePercent)) : '—'),
      inflationDisplay: 'Investidor10',
      source: 'Investidor10'
    };
  }).filter(row => row.returnPercent !== null || row.realReturnPercent !== null);
}

function chartPointFromYahoo(point, index = 0) {
  const close = Number(point?.close ?? point?.price ?? point?.value ?? point?.adjClose);
  if (!Number.isFinite(close) || close <= 0) return null;
  const rawDate = String(point?.date || point?.timestamp || point?.time || '');
  const time = Date.parse(rawDate);
  return {
    date: Number.isFinite(time) ? new Date(time).toISOString().slice(0, 10) : rawDate.slice(0, 10),
    timestamp: Number.isFinite(time) ? Math.floor(time / 1000) : index,
    close: round(close, 4),
    value: round(close, 4)
  };
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

function performanceFromHistory(history) {
  const points = Array.isArray(history?.points) ? history.points.map(chartPointFromYahoo).filter(Boolean) : [];
  if (points.length < 2) return null;
  const first = Number(points[0].close);
  const last = Number(points.at(-1).close);
  if (!Number.isFinite(first) || !Number.isFinite(last) || first <= 0 || last <= 0) return null;
  return round(((last / first) - 1) * 100, 4);
}

function accumulatedIpcaPercent(ipcaPoints = [], months = 12) {
  const clean = Array.isArray(ipcaPoints) ? ipcaPoints.filter(point => Number.isFinite(Number(point?.monthlyPercent))).slice(-months) : [];
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



function formatCompactMoney(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  const abs = Math.abs(n);
  const dec = (v, d = 2) => v.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
  if (abs >= 1_000_000_000_000) return `R$ ${dec(n / 1_000_000_000_000, 2)} tri`;
  if (abs >= 1_000_000_000) return `R$ ${dec(n / 1_000_000_000, 2)} B`;
  if (abs >= 1_000_000) return `R$ ${dec(n / 1_000_000, 2)} M`;
  return `R$ ${dec(n, 2)}`;
}

function returnPointFromClose(point, firstClose, fallbackIndex = 0, source = '') {
  const close = Number(point?.close ?? point?.value ?? point?.adjClose);
  if (!Number.isFinite(close) || close <= 0 || !Number.isFinite(firstClose) || firstClose <= 0) return null;
  const rawDate = String(point?.date || point?.timestamp || point?.time || '');
  const time = Date.parse(rawDate);
  const ts = Number.isFinite(time) ? Math.floor(time / 1000) : fallbackIndex;
  const ret = round(((close / firstClose) - 1) * 100, 4);
  return {
    date: Number.isFinite(time) ? new Date(time).toISOString().slice(0, 10) : rawDate.slice(0, 10),
    timestamp: ts,
    close: round(close, 4),
    value: ret,
    returnPercent: ret,
    source
  };
}

function stockComparisonFetchPlans(period = {}) {
  const primary = { range: period.range || '5Y', interval: period.interval || '1mo', fallback: false };
  const alternates = [];
  if (period.key === '2y') alternates.push(
    { range: period.range || '2Y', interval: '1mo', fallback: true },
    { range: period.range || '2Y', interval: '1wk', fallback: true },
    { range: period.range || '2Y', interval: '1d', fallback: true }
  );
  if (period.key === '5y') alternates.push(
    { range: period.range || '5Y', interval: '1mo', fallback: true },
    { range: period.range || '5Y', interval: '1wk', fallback: true },
    { range: period.range || '5Y', interval: '1d', fallback: true }
  );
  if (period.key === '10y') alternates.push(
    { range: period.range || '10Y', interval: '1mo', fallback: true },
    { range: period.range || '10Y', interval: '1wk', fallback: true },
    { range: period.range || '10Y', interval: '1d', fallback: true }
  );
  const seen = new Set();
  return [primary, ...alternates].filter(plan => {
    const key = `${plan.range}|${plan.interval}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function stockReturnHistoryRangeForPeriod(period = {}) {
  const months = Number(period.months || 60);
  if (months <= 12) return '1Y';
  if (months <= 60) return '5Y';
  return 'MAX';
}

function normalizeStockComparisonHistoryPoints(history = {}, period = {}, source = '') {
  const rows = history.points || history.history || history.series || history.prices || history.chartHistory || [];
  const clean = (Array.isArray(rows) ? rows : [])
    .map((point, index) => {
      const rawDate = point.date || point.time || point.timestamp || point.month || '';
      const millis = typeof rawDate === 'number'
        ? (rawDate > 10000000000 ? rawDate : rawDate * 1000)
        : Date.parse(/^\d{4}-\d{2}$/.test(String(rawDate)) ? `${rawDate}-01T00:00:00.000Z` : String(rawDate));
      const close = Number(point.close ?? point.value ?? point.adjClose ?? point.price);
      if (!Number.isFinite(millis) || !Number.isFinite(close) || close <= 0) return null;
      return { date: new Date(millis).toISOString().slice(0, 10), timestamp: Math.floor(millis / 1000), close, source: point.source || source || history.source || '', index };
    })
    .filter(Boolean)
    .sort((a, b) => a.timestamp - b.timestamp || a.index - b.index);
  if (clean.length < 2) return [];
  const last = clean.at(-1);
  const months = Number(period.months || 60);
  const cutoffDate = new Date(last.timestamp * 1000);
  cutoffDate.setUTCMonth(cutoffDate.getUTCMonth() - Math.max(1, months));
  const cutoff = Math.floor(cutoffDate.getTime() / 1000);
  let sliced = clean.filter(point => point.timestamp >= cutoff);
  if (sliced.length < 2) sliced = clean.slice(-Math.min(clean.length, Math.max(2, months + 1)));
  if (sliced.length < 2) return [];
  const first = Number(sliced[0].close);
  if (!Number.isFinite(first) || first <= 0) return [];
  return sliced.map((point, index) => returnPointFromClose(point, first, index, point.source || history.source || source || 'Retorno/Proxy getAssetHistory')).filter(Boolean);
}

async function officialReturnComparisonSeries({ code, label, ticker, yahooSymbol, period, timeoutMs = 5200, primary = false } = {}) {
  const cleanCode = String(code || ticker || yahooSymbol || '').trim().toUpperCase();
  if (!cleanCode) return null;
  const history = await getAssetHistory({
    ticker: cleanCode,
    range: stockReturnHistoryRangeForPeriod(period),
    timeoutMs,
    limit: period?.key === '10y' ? 260 : 520,
    bypassCache: false
  }).catch(error => ({ status: 'ERROR', ok: false, points: [], error: error?.message || String(error) }));
  const points = normalizeStockComparisonHistoryPoints(history, period, history?.source || 'Retorno/Proxy getAssetHistory');
  if (points.length < 2) return null;
  return {
    id: String(code || ticker || label || '').toLowerCase(),
    code,
    ticker: ticker || code,
    label: label || code,
    periodKey: period.key,
    source: `${history?.source || 'Retorno/Proxy getAssetHistory'} · mesmo provedor da página Retorno`,
    yahooSymbol: history?.yahooSymbol || yahooSymbol,
    primary: Boolean(primary),
    points,
    reusedReturnProxy: true
  };
}

async function yahooComparisonSeries({ code, label, ticker, yahooSymbol, period, timeoutMs = 5200, primary = false } = {}) {
  const symbols = [yahooSymbol, ticker, code]
    .filter(Boolean)
    .map(value => String(value).trim())
    .filter(Boolean);
  const uniqueSymbols = [...new Set(symbols)];
  for (const symbol of uniqueSymbols) {
    for (const plan of stockComparisonFetchPlans(period)) {
      const history = await fetchYahooHistory(symbol, {
        range: plan.range,
        interval: plan.interval || '1mo',
        timeoutMs,
        limit: period.key === '10y' ? 260 : 520,
        cache: true
      }).catch(error => ({ ok: false, points: [], error: error?.message || String(error) }));
      const pointsRaw = (history.points || []).filter(p => Number.isFinite(Number(p.close)) && Number(p.close) > 0);
      if (pointsRaw.length < 2) continue;
      const first = Number(pointsRaw[0].close);
      const points = pointsRaw.map((point, index) => returnPointFromClose(point, first, index, history.source || 'Yahoo Finance Chart API')).filter(Boolean);
      if (points.length < 2) continue;
      return {
        id: String(code || ticker || label || '').toLowerCase(),
        code,
        ticker: ticker || code,
        label: label || code,
        periodKey: period.key,
        source: history.source || 'Yahoo Finance Chart API',
        yahooSymbol: history.symbol || symbol,
        primary: Boolean(primary),
        plan,
        points
      };
    }
  }
  return null;
}

async function stockComparisonSeries(args = {}) {
  const code = String(args.code || '').toUpperCase();
  const useReturnProxy = args.primary || ['IBOV', 'IFIX', 'SMLL', 'IDIV'].includes(code);
  if (useReturnProxy) {
    const official = await officialReturnComparisonSeries(args);
    if (official) return official;
  }
  return yahooComparisonSeries(args);
}

function macroSeriesFromAccumulated({ code, label, points = [], period, source = '' } = {}) {
  const arr = (points || []).slice(-Math.max(1, Number(period?.months || 60))).map((point, index) => {
    const date = point.date || (point.month ? `${point.month}-01` : '');
    const time = Date.parse(date);
    const ret = Number(point.accumulatedPercent ?? point.returnPercent ?? point.value);
    if (!Number.isFinite(ret)) return null;
    return {
      date: date ? String(date).slice(0, 10) : '',
      timestamp: Number.isFinite(time) ? Math.floor(time / 1000) : index,
      close: null,
      value: round(ret, 4),
      returnPercent: round(ret, 4),
      source
    };
  }).filter(Boolean);
  if (arr.length < 2) return null;
  return { id: code.toLowerCase(), code, ticker: code, label, periodKey: period.key, source, points: arr };
}

function comparisonItemFromSeries(series, periodKey, baseInvestment = 1000) {
  const last = series?.points?.at?.(-1);
  const ret = Number(last?.returnPercent ?? last?.value);
  const investedValue = Number.isFinite(ret) ? round(baseInvestment * (1 + ret / 100), 2) : null;
  return {
    id: String(series.code || series.id || '').toLowerCase(),
    code: series.code,
    label: series.label,
    periodKey,
    returnPercent: Number.isFinite(ret) ? round(ret, 4) : null,
    returnDisplay: Number.isFinite(ret) ? formatPercent(ret) : '—',
    investedValue,
    investedValueDisplay: Number.isFinite(investedValue) ? formatMoney(investedValue) : '—',
    source: series.source
  };
}






function emptyStockCommodityComparison(ticker = '') {
  return {
    id: 'stock_asset_vs_brent_oil',
    title: 'Comparação com Petróleo Brent removida',
    status: 'REMOVED',
    defaultPeriod: '5y',
    periods: STOCK_COMPARISON_PERIODS,
    series: [],
    items: [],
    seriesByPeriod: {},
    itemsByPeriod: {},
    source: 'Removido por configuração do modal único de ações'
  };
}


async function buildStockIndexComparison(ticker, timeoutMs = 8500) {
  const baseInvestment = 1000;
  const indexQuotesPromise = Promise.all(STOCK_INDEX_BENCHMARKS.map(async item => {
    if (!item.yahooSymbol) return null;
    const quote = await fetchYahooQuote(item.yahooSymbol, { timeoutMs: Math.min(4200, timeoutMs), interval: item.code === 'IFIX' || item.code === 'SMLL' || item.code === 'IDIV' ? '1d' : '5m' }).catch(() => null);
    return {
      id: item.code.toLowerCase(), code: item.code, label: item.label,
      value: finiteNumberOrNull(quote?.price) === null ? null : round(Number(quote.price), 4),
      valueDisplay: finiteNumberOrNull(quote?.price) === null ? '—' : formatNumber(Number(quote.price), 2),
      variationPercent: finiteNumberOrNull(quote?.variationPct) === null ? null : round(Number(quote.variationPct), 4),
      variationDisplay: finiteNumberOrNull(quote?.variationPct) === null ? '—' : formatPercent(Number(quote.variationPct), true),
      yahooSymbol: item.yahooSymbol, source: item.source
    };
  }));
  const macroMonths = 128;
  const [cdi, ipca] = await Promise.all([
    getCdiAccumulatedSeries(macroMonths, Math.min(5200, timeoutMs)).catch(error => ({ status: 'ERROR', points: [], error: error?.message || String(error), source: 'BancoCentralSGS CDI' })),
    getIpcaSeries(macroMonths).catch(error => ({ status: 'ERROR', points: [], error: error?.message || String(error), source: 'BancoCentralSGS IPCA' }))
  ]);
  const order = [ticker, 'IBOV', 'CDI', 'IPCA', 'SMLL', 'IFIX', 'IDIV', 'IVVB11'];
  const sortSeries = (list = []) => [...list].sort((a, b) => {
    const ia = order.indexOf(a.code);
    const ib = order.indexOf(b.code);
    return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib);
  });

  // Os períodos são independentes e agora executam em paralelo. Isso mantém o produtor
  // dentro do deadline do modal e permite recuperação dirigida somente desta seção.
  const periodEntries = await Promise.all(STOCK_COMPARISON_PERIODS.map(async period => {
    const yahooSeries = await Promise.all([
      stockComparisonSeries({ code: ticker, label: ticker, ticker, yahooSymbol: `${ticker}.SA`, period, timeoutMs: Math.min(6200, timeoutMs), primary: true }),
      ...STOCK_INDEX_BENCHMARKS.filter(item => item.yahooSymbol).map(item => stockComparisonSeries({ ...item, period, timeoutMs: Math.min(6200, timeoutMs) }))
    ]);
    const macro = [
      macroSeriesFromAccumulated({ code: 'CDI', label: 'CDI', points: cdi.points || cdi.series || [], period, source: cdi.source || 'BancoCentralSGS CDI' }),
      macroSeriesFromAccumulated({ code: 'IPCA', label: 'IPCA', points: ipca.points || ipca.series || [], period, source: ipca.source || 'BancoCentralSGS IPCA' })
    ];
    const series = sortSeries(alignComparisonSeriesToSharedWindow([...yahooSeries, ...macro].filter(Boolean)));
    const items = series.map(seriesItem => comparisonItemFromSeries(seriesItem, period.key, baseInvestment));
    return [period.key, { series, items }];
  }));
  const seriesByPeriod = Object.fromEntries(periodEntries);
  const itemsByPeriod = Object.fromEntries(periodEntries.map(([key, value]) => [key, value.items]));
  const active = seriesByPeriod['5y'] || Object.values(seriesByPeriod)[0] || { series: [], items: [] };
  const indexQuotes = await indexQuotesPromise;
  return {
    id: 'stock_asset_vs_indices_selector', title: `Comparação de ${ticker} com índices`,
    subtitle: 'Séries restritas à mesma janela temporal real e normalizadas em retorno percentual.',
    status: (active.series || []).length >= 2 ? 'OK' : ((active.series || []).length ? 'PARTIAL' : 'EMPTY'),
    defaultPeriod: '5y', baseInvestment, baseInvestmentDisplay: formatMoney(baseInvestment),
    periods: STOCK_COMPARISON_PERIODS, series: active.series || [], items: active.items || [],
    seriesByPeriod, itemsByPeriod, indexQuotes: indexQuotes.filter(Boolean),
    selectorOptions: [{ code: ticker, label: ticker, required: true }, ...STOCK_INDEX_BENCHMARKS.map(item => ({ code: item.code, label: item.label, required: ['IBOV', 'IFIX'].includes(item.code) }))].map(item => ({ id: String(item.code).toLowerCase(), ...item })),
    source: 'Retorno/Proxy getAssetHistory + Yahoo Finance Chart API + Banco Central SGS',
    sourcePolicy: 'Comparação por timestamps reais em janela temporal comum, sem interpolação, fallback estático ou dados de exemplo.'
  };
}

async function buildStockCommodityComparison(ticker, companyName = '', timeoutMs = 8500) {
  const seriesByPeriod = {};
  const itemsByPeriod = {};
  for (const period of STOCK_COMPARISON_PERIODS) {
    let series = (await Promise.all([
      yahooComparisonSeries({ code: ticker, label: ticker, ticker, period, timeoutMs: Math.min(5200, timeoutMs), primary: true }),
      yahooComparisonSeries({ ...STOCK_BRENT_BENCHMARK, period, timeoutMs: Math.min(5200, timeoutMs) })
    ])).filter(Boolean);
    seriesByPeriod[period.key] = series;
    itemsByPeriod[period.key] = series.map(seriesItem => comparisonItemFromSeries(seriesItem, period.key, 1000));
  }
  const active = seriesByPeriod['5y'] || [];
  const titleName = companyName && companyName !== ticker ? companyName.toUpperCase().split(' ')[0] : String(ticker || '').toUpperCase();
  return {
    id: 'stock_asset_vs_brent_oil',
    title: `Comparando ${titleName} com Petróleo Brent`,
    subtitle: 'Cotação padrão; série normalizada em retorno percentual para comparar direção do ativo e do Brent.',
    status: active.length >= 2 ? 'OK' : (active.length ? 'PARTIAL' : 'EMPTY'),
    defaultPeriod: '5y',
    baseInvestment: 1000,
    baseInvestmentDisplay: formatMoney(1000),
    periods: STOCK_COMPARISON_PERIODS,
    series: active,
    items: itemsByPeriod['5y'] || [],
    seriesByPeriod,
    itemsByPeriod,
    indexQuotes: [],
    selectorOptions: [{ id: ticker.toLowerCase(), code: ticker, label: ticker, required: true }, { id: 'brent', code: 'BRENT', label: 'Petróleo Brent', required: true }],
    source: 'Yahoo Finance Chart API',
    sourcePolicy: 'Comparação com commodity fica vazia quando a fonte real não entregar série suficiente; sem dados de exemplo.'
  };
}

function stockMetricByLabel(fundamentalIndicators = {}, label = '') {
  const wanted = compactKey(label);
  const items = Array.isArray(fundamentalIndicators?.items) ? fundamentalIndicators.items : [];
  return items.find(item => compactKey(item.label || item.id) === wanted || compactKey(item.id) === wanted);
}

function stockMetricById(fundamentalIndicators = {}, id = '') {
  const wanted = compactKey(id);
  const items = Array.isArray(fundamentalIndicators?.items) ? fundamentalIndicators.items : [];
  return items.find(item => compactKey(item.id || '') === wanted || compactKey(item.label || '') === wanted);
}

function enrichStockQuickMetrics(rawQuick = {}, fundamentalIndicators = {}, ticker = '') {
  const quick = { ...(rawQuick || {}) };
  const pl = stockMetricById(fundamentalIndicators, 'pl') || stockMetricByLabel(fundamentalIndicators, 'P/L');
  const pvp = stockMetricById(fundamentalIndicators, 'pvp') || stockMetricByLabel(fundamentalIndicators, 'P/VP');
  const dy = stockMetricById(fundamentalIndicators, 'dividend_yield') || stockMetricByLabel(fundamentalIndicators, 'Dividend Yield');
  if (!quick.plDisplay && pl?.value) quick.plDisplay = pl.value;
  if (finiteNumberOrNull(quick.pl) === null && finiteNumberOrNull(pl?.numericValue) !== null) quick.pl = finiteNumberOrNull(pl.numericValue);
  if (!quick.pvpDisplay && pvp?.value) quick.pvpDisplay = pvp.value;
  if (finiteNumberOrNull(quick.pvp) === null && finiteNumberOrNull(pvp?.numericValue) !== null) quick.pvp = finiteNumberOrNull(pvp.numericValue);
  if (!quick.dyDisplay && dy?.value) quick.dyDisplay = dy.value;
  if (finiteNumberOrNull(quick.dy) === null && finiteNumberOrNull(dy?.numericValue) !== null) quick.dy = finiteNumberOrNull(dy.numericValue);
  return quick;
}





function findBestPlainSectionStart(plain = '', startPattern, validatorPattern, maxLen = 6200) {
  const source = String(plain || '');
  const flags = startPattern.flags.includes('g') ? startPattern.flags : `${startPattern.flags}g`;
  const re = new RegExp(startPattern.source, flags);
  const starts = [...source.matchAll(re)].map(match => match.index ?? -1).filter(index => index >= 0);
  if (!starts.length) return -1;
  const validated = starts.filter(index => validatorPattern.test(source.slice(index, index + maxLen)));
  if (validated.length) return validated[validated.length - 1];
  return starts[starts.length - 1];
}

function extractInvestidor10StockPeerComparison(html = '', ticker = '', quickMetrics = {}, fundamentalIndicators = {}) {
  const plain = htmlToPlainText(html);
  const symbol = String(ticker || '').toUpperCase();
  const start = findBestPlainSectionStart(
    plain,
    /COMPARADOR DE A[ÇC][ÕO]ES/i,
    /(?:P\s*\/\s*L[\s\S]{0,280}P\s*\/\s*VP[\s\S]{0,280}ROE[\s\S]{0,280}DY[\s\S]{0,640}Valor\s+de\s+Mercado|[A-Z]{4}\d{1,2}\s+[+-]?(?:\d{1,3}(?:\.\d{3})+|\d+)(?:,\d+)?\s+[+-]?(?:\d{1,3}(?:\.\d{3})+|\d+)(?:,\d+)?\s+[+-]?(?:\d{1,3}(?:\.\d{3})+|\d+)(?:,\d+)?\s*%)/i,
    7200
  );
  let section = start >= 0 ? plain.slice(start, start + 7200) : '';
  const end = section.search(/(?:COMPARA[ÇC][ÃA]O\s+DE\s+[A-Z0-9]{4,6}\s+COM\s+[ÍI]NDICES|COMPARANDO\s+|Resultados\s+|BALAN[ÇC]O|COMUNICADOS)/i);
  if (end > 300) section = section.slice(0, end);
  const columns = [
    { key: 'pl', label: 'P/L' },
    { key: 'pvp', label: 'P/VP' },
    { key: 'roe', label: 'ROE' },
    { key: 'dy', label: 'DY' },
    { key: 'market_value', label: 'Valor de Mercado' },
    { key: 'margin_liquid', label: 'Margem Líquida' }
  ];
  const brNumPattern = String.raw`[+-]?(?:\d{1,3}(?:\.\d{3})+|\d+)(?:,\d+)?`;
  const brPercentPattern = String.raw`${brNumPattern}\s*%`;
  const moneyPattern = String.raw`R\$\s*${brNumPattern}\s*(?:B|M|K|mi|bi|mil|Bilhões|Bilhoes|Bilhão|Bilhao|Milhões|Milhoes|Milhão|Milhao)?`;
  const rowPattern = new RegExp(String.raw`\b([A-Z]{4}\d{1,2})\b\s+(${brNumPattern})\s+(${brNumPattern})\s+(${brPercentPattern})\s+(${brPercentPattern})\s+(${moneyPattern})\s+(${brPercentPattern})`, 'gi');
  const rows = [];
  const pushPeerRow = (row) => {
    if (!row?.ticker || rows.some(existing => existing.ticker === row.ticker)) return;
    rows.push(row);
  };
  for (const match of section.matchAll(rowPattern)) {
    const rowTicker = match[1].toUpperCase();
    pushPeerRow({
      ticker: rowTicker,
      isReference: rowTicker === symbol,
      pl: parseBrNumber(match[2]),
      plDisplay: match[2],
      pvp: parseBrNumber(match[3]),
      pvpDisplay: match[3],
      roe: parseBrNumber(match[4]),
      roeDisplay: match[4],
      dividendYield: parseBrNumber(match[5]),
      dividendYieldDisplay: match[5],
      marketValueDisplay: match[6],
      marginLiquid: parseBrNumber(match[7]),
      marginLiquidDisplay: match[7],
      highlights: [],
      source: 'Investidor10 comparador de ações'
    });
  }
  if (rows.length < 2 && section) {
    const tickerMatches = [...section.matchAll(/\b([A-Z]{4}\d{1,2})\b/g)].filter(match => match.index !== undefined);
    for (let i = 0; i < tickerMatches.length; i += 1) {
      const rowTicker = tickerMatches[i][1].toUpperCase();
      const from = tickerMatches[i].index || 0;
      const to = tickerMatches[i + 1]?.index || Math.min(section.length, from + 900);
      const chunk = section.slice(from, to);
      const money = chunk.match(new RegExp(moneyPattern, 'i'))?.[0] || '';
      const percents = [...chunk.matchAll(new RegExp(brPercentPattern, 'gi'))].map(m => m[0]);
      const numericTokens = [...chunk.replace(money, ' ').replace(/\b[A-Z]{4}\d{1,2}\b/g, ' ').matchAll(new RegExp(brNumPattern, 'gi'))]
        .map(m => m[0])
        .filter(value => !/%/.test(value) && parseBrNumber(value) !== null);
      if (numericTokens.length < 2 || percents.length < 2) continue;
      pushPeerRow({
        ticker: rowTicker,
        isReference: rowTicker === symbol,
        pl: parseBrNumber(numericTokens[0]),
        plDisplay: numericTokens[0],
        pvp: parseBrNumber(numericTokens[1]),
        pvpDisplay: numericTokens[1],
        roe: parseBrNumber(percents[0]),
        roeDisplay: percents[0],
        dividendYield: parseBrNumber(percents[1]),
        dividendYieldDisplay: percents[1],
        marketValueDisplay: money,
        marginLiquid: parseBrNumber(percents[2]),
        marginLiquidDisplay: percents[2] || '—',
        highlights: [],
        source: 'Investidor10 comparador de ações'
      });
    }
  }
  const bestMin = (field) => {
    const values = rows.map(row => row[field]).filter(Number.isFinite);
    return values.length ? Math.min(...values) : null;
  };
  const bestMax = (field) => {
    const values = rows.map(row => row[field]).filter(Number.isFinite);
    return values.length ? Math.max(...values) : null;
  };
  const minPl = bestMin('pl'); const minPvp = bestMin('pvp'); const maxRoe = bestMax('roe'); const maxDy = bestMax('dividendYield'); const maxMargin = bestMax('marginLiquid');
  rows.forEach(row => {
    const highlights = [];
    if (Number.isFinite(row.pl) && row.pl === minPl) highlights.push('pl');
    if (Number.isFinite(row.pvp) && row.pvp === minPvp) highlights.push('pvp');
    if (Number.isFinite(row.roe) && row.roe === maxRoe) highlights.push('roe');
    if (Number.isFinite(row.dividendYield) && row.dividendYield === maxDy) highlights.push('dy');
    if (Number.isFinite(row.marginLiquid) && row.marginLiquid === maxMargin) highlights.push('margin_liquid');
    row.highlights = highlights;
  });
  return {
    id: 'stock_peer_comparison',
    title: 'Comparador de ações',
    subtitle: 'Pares setoriais capturados diretamente do Investidor10; sem dados locais quando a fonte não entregar a tabela.',
    filterLabel: 'Mesmo setor/segmento do ativo',
    source: 'Investidor10 comparador de ações',
    status: rows.length >= 2 ? 'OK' : (rows.length ? 'PARTIAL' : 'EMPTY'),
    columns,
    rows: rows.slice(0, 12),
    diagnostics: { parsedRows: rows.length, sectionStart: start, policy: 'no_static_substitution' }
  };
}



function stripRepeatedSectionPrefixes(value = '') {
  return cleanText(value)
    .replace(/^(?:SOBRE\s+A\s+EMPRESA\s*)+/i, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function extractHtmlParagraphsFromSlice(htmlSlice = '') {
  const out = [];
  const blockPattern = /<(p|li|h2|h3|h4)[^>]*>([\s\S]*?)<\/\1>/gi;
  for (const match of htmlSlice.matchAll(blockPattern)) {
    const value = stripRepeatedSectionPrefixes(match[2]);
    if (value && value.length > 18 && !/^\d{4}$/.test(value) && !/^Avalie|^Seguir/i.test(value)) out.push(value);
  }
  return out.filter((value, index, arr) => arr.findIndex(item => compactKey(item) === compactKey(value)) === index);
}

function sentenceParagraphsFromPlain(section = '') {
  const clean = stripRepeatedSectionPrefixes(section);
  if (!clean) return [];
  const protectedText = clean.replace(/\bS\.A\./g, 'S_A_').replace(/\bS\.A\b/g, 'S_A');
  const sentences = protectedText.split(/(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÂÊÔÃÕÀÇ0-9])/).map(part => part.replace(/S_A_/g, 'S.A.').replace(/S_A/g, 'S.A').trim()).filter(Boolean);
  const chunks = [];
  let current = '';
  for (const sentence of sentences) {
    if ((current + ' ' + sentence).trim().length > 260 && current) {
      chunks.push(current.trim());
      current = sentence;
    } else {
      current = (current ? `${current} ${sentence}` : sentence).trim();
    }
  }
  if (current) chunks.push(current);
  return chunks.filter(value => value.length > 25);
}

function stockLogoTokenMismatch(haystack = '', symbol = '') {
  const text = String(haystack || '').toUpperCase();
  const currentBase = String(symbol || '').toUpperCase().replace(/\d+$/, '');
  const knownBases = ['PETR', 'VALE', 'ITUB', 'BBDC', 'BBAS', 'ABEV', 'WEGE', 'PRIO', 'VBBR', 'UGPA', 'CSAN', 'BRAV', 'RECV', 'CMIN', 'GGBR', 'GOAU', 'USIM', 'CSNA', 'SUZB', 'KLBN'];
  return knownBases.some(base => base !== currentBase && new RegExp(`\\b${base}\\d{0,2}\\b|${base.toLowerCase()}\\d{0,2}`, 'i').test(text));
}

function isSafeStockLogoCandidate(url = '', haystack = '', ticker = '', name = '') {
  let raw = String(url || '').trim();
  if (!raw) return false;
  if (raw.startsWith('//')) raw = `https:${raw}`;
  if (raw.startsWith('/')) raw = `https://investidor10.com.br${raw}`;
  if (!/^https?:\/\//i.test(raw)) return false;
  const symbol = String(ticker || '').toUpperCase();
  const base = symbol.replace(/\d+$/, '');
  const nameTokens = cleanText(name).split(/\s+/).filter(token => token.length >= 4).slice(0, 4);
  const check = `${haystack} ${raw}`;
  const bad = /(?:avatar|user|banner|placeholder|sprite|favicon|apple-touch|qr|qrcode|google|facebook|twitter|ads?|patrimonio-campeao|minha-carteira|icon-[0-9])/i;
  if (bad.test(check)) return false;
  if (stockLogoTokenMismatch(check, symbol)) return false;
  const hasIdentity = [symbol, base, ...nameTokens].filter(Boolean).some(token => new RegExp(escapeRegExp(token), 'i').test(check));
  return hasIdentity;
}

function extractStockCompanyLogoUrl(html = '', ticker = '', name = '') {
  const candidates = [];
  const symbol = String(ticker || '').toUpperCase();
  const base = symbol.replace(/\d+$/, '');
  const nameTokens = cleanText(name).split(/\s+/).filter(token => token.length >= 4).slice(0, 4);
  const wanted = [symbol, base, ...nameTokens, 'logo'].filter(Boolean).map(token => escapeRegExp(token));
  const wantedRe = wanted.length ? new RegExp(wanted.join('|'), 'i') : /logo/i;
  for (const match of String(html || '').matchAll(/<img[^>]*>/gi)) {
    const tag = match[0];
    const alt = decodeHtmlEntities(tag.match(/\b(?:alt|title)=(["'])(.*?)\1/i)?.[2] || '');
    const src = decodeHtmlEntities(tag.match(/\bsrc=(["'])(.*?)\1/i)?.[2] || '');
    const srcset = decodeHtmlEntities(tag.match(/\bsrcset=(["'])(.*?)\1/i)?.[2] || '');
    const firstSrcSet = srcset.split(',')[0]?.trim().split(/\s+/)[0] || '';
    const haystack = `${alt} ${src} ${firstSrcSet}`;
    if (!wantedRe.test(haystack)) continue;
    for (const url of [src, firstSrcSet]) {
      if (isSafeStockLogoCandidate(url, haystack, symbol, name)) candidates.push(url);
    }
  }
  const normalized = candidates.map(candidate => {
    let raw = String(candidate || '').trim();
    if (raw.startsWith('//')) raw = `https:${raw}`;
    if (raw.startsWith('/')) raw = `https://investidor10.com.br${raw}`;
    return raw;
  }).filter(Boolean);
  return normalized[0] || '';
}


function stockSectionSliceByHeadings(plain = '', startPattern, endPatterns = []) {
  const source = String(plain || '');
  const start = source.search(startPattern);
  if (start < 0) return '';
  const rest = source.slice(start);
  const endCandidates = endPatterns
    .map(pattern => rest.search(pattern))
    .filter(index => index > 20);
  const end = endCandidates.length ? Math.min(...endCandidates) : rest.length;
  return cleanText(rest.slice(0, end));
}

function stockCompanyDataField(section = '', labelPattern, nextLabelPatterns = []) {
  const next = nextLabelPatterns.length ? nextLabelPatterns.join('|') : '$^';
  const re = new RegExp(`${labelPattern}\\s*:?\\s*([\\s\\S]*?)(?=\\s+(?:${next})\\s*:?|$)`, 'i');
  const match = String(section || '').match(re);
  return cleanText(match?.[1] || '');
}

function stockCompanyDataTickersFromSlice(slice = '') {
  const tickers = [];
  const seen = new Set();
  for (const match of String(slice || '').toUpperCase().matchAll(/\b[A-Z]{4}\d{1,2}F?\b/g)) {
    const value = match[0];
    if (seen.has(value)) continue;
    seen.add(value);
    tickers.push(value);
  }
  return tickers;
}

function extractStockCompanyData(html = '', ticker = '', fallbackName = '') {
  const plain = htmlToPlainText(html);
  const symbol = String(ticker || '').toUpperCase();
  const section = stockSectionSliceByHeadings(
    plain,
    /DADOS\s+SOBRE\s+A\s+EMPRESA/i,
    [/INFORMA[ÇC][ÕO]ES\s+SOBRE\s+A\s+EMPRESA/i, /REGI[ÕO]ES\s+ONDE/i, /NEG[ÓO]CIOS\s+QUE\s+GERAM/i]
  );
  if (!section) {
    return {
      id: 'stock_company_data',
      title: 'Dados sobre a empresa',
      ticker: symbol,
      status: 'EMPTY',
      source: 'Investidor10 dados sobre a empresa',
      facts: [],
      companyPapers: [],
      fractionalPapers: [],
      sections: []
    };
  }
  const labels = [
    'Nome\\s+da\\s+Empresa',
    'CNPJ',
    'Ano\\s+de\\s+estreia\\s+na\\s+bolsa',
    'N[úu]mero\\s+de\\s+funcion[áa]rios',
    'Ano\\s+de\\s+funda[çc][ãa]o',
    'Pap[ée]is\\s+da\\s+empresa',
    'Pap[ée]is\\s+Fracionados'
  ];
  const name = stockCompanyDataField(section, labels[0], labels.slice(1)) || cleanText(fallbackName);
  const cnpj = stockCompanyDataField(section, labels[1], labels.slice(2));
  const listingYear = stockCompanyDataField(section, labels[2], labels.slice(3));
  const employees = stockCompanyDataField(section, labels[3], labels.slice(4));
  const foundingYear = stockCompanyDataField(section, labels[4], labels.slice(5));

  const companyPapersSlice = stockCompanyDataField(section, labels[5], [labels[6]]);
  const fractionalPapersSlice = stockCompanyDataField(section, labels[6], []);
  const companyPapers = stockCompanyDataTickersFromSlice(companyPapersSlice).filter(value => !value.endsWith('F'));
  const fractionalPapers = stockCompanyDataTickersFromSlice(fractionalPapersSlice).filter(value => value.endsWith('F'));

  const facts = [
    name ? { id: 'company_name', label: 'Nome da Empresa', value: name, source: 'Investidor10 dados sobre a empresa' } : null,
    cnpj ? { id: 'cnpj', label: 'CNPJ', value: cnpj, source: 'Investidor10 dados sobre a empresa' } : null,
    listingYear ? { id: 'listing_year', label: 'Ano de estreia na bolsa', value: listingYear, source: 'Investidor10 dados sobre a empresa' } : null,
    employees ? { id: 'employees', label: 'Número de funcionários', value: employees, source: 'Investidor10 dados sobre a empresa' } : null,
    foundingYear ? { id: 'foundation_year', label: 'Ano de fundação', value: foundingYear, source: 'Investidor10 dados sobre a empresa' } : null
  ].filter(Boolean);

  return {
    id: 'stock_company_data',
    title: 'Dados sobre a empresa',
    ticker: symbol,
    status: facts.length || companyPapers.length || fractionalPapers.length ? 'OK' : 'EMPTY',
    source: 'Investidor10 dados sobre a empresa',
    facts,
    companyPapers,
    fractionalPapers,
    sections: [
      companyPapers.length ? { id: 'company_papers', title: 'Papéis da empresa', values: companyPapers } : null,
      fractionalPapers.length ? { id: 'fractional_papers', title: 'Papéis Fracionados', values: fractionalPapers } : null
    ].filter(Boolean)
  };
}


function stockCompanyInformationNumberFromDisplay(value = '') {
  const text = cleanText(value);
  if (!text || text === '—') return null;
  const numberMatch = text.match(/-?(?:\d{1,3}(?:\.\d{3})+|\d+)(?:,\d+)?/);
  const n = numberMatch ? parseBrNumber(numberMatch[0]) : parseBrNumber(text);
  if (!Number.isFinite(Number(n))) return null;
  const lower = text.toLowerCase();
  let multiplier = 1;
  if (/trilh(?:ão|ao|ões|oes)|\btri\b|\bt\b/i.test(lower)) multiplier = 1_000_000_000_000;
  else if (/bilh(?:ão|ao|ões|oes)|\bbi\b|\bb\b/i.test(lower)) multiplier = 1_000_000_000;
  else if (/milh(?:ão|ao|ões|oes)|\bmi\b|\bm\b/i.test(lower)) multiplier = 1_000_000;
  else if (/\bmil\b|\bk\b/i.test(lower)) multiplier = 1_000;
  return round(Number(n) * multiplier, 2);
}

function stockCompanyInformationValuesFromSlice(slice = '', kind = 'money') {
  const text = cleanText(slice)
    .replace(/^(?:Valores\s+simples\s+Valores\s+detalhados|Valores\s+simples|Valores\s+detalhados)\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) return { value: '', detailedValue: '', numericValue: null, numericDetailedValue: null };

  if (kind === 'money') {
    const moneyPattern = /R\$\s*(?:\d{1,3}(?:\.\d{3})+|\d+)(?:,\d+)?\s*(?:Trilh(?:ão|ao|ões|oes)|Bilhões|Bilhoes|Bilhão|Bilhao|Milhões|Milhoes|Milhão|Milhao|Bilhão|Bilhao|B|M|mi|bi|mil)?/gi;
    const values = Array.from(text.matchAll(moneyPattern)).map(match => cleanText(match[0]));
    const value = values[0] || '';
    const detailedValue = values[1] || '';
    return {
      value,
      detailedValue,
      numericValue: value ? stockCompanyInformationNumberFromDisplay(value) : null,
      numericDetailedValue: detailedValue ? stockCompanyInformationNumberFromDisplay(detailedValue) : null
    };
  }

  if (kind === 'quantity') {
    const quantityPattern = /(?:\d{1,3}(?:\.\d{3})+|\d+)(?:,\d+)?\s*(?:Trilh(?:ão|ao|ões|oes)|Bilhões|Bilhoes|Bilhão|Bilhao|Milhões|Milhoes|Milhão|Milhao|B|M|mi|bi|mil)?/gi;
    const values = Array.from(text.matchAll(quantityPattern)).map(match => cleanText(match[0]));
    const value = values[0] || '';
    const detailedValue = values[1] || '';
    return {
      value,
      detailedValue,
      numericValue: value ? stockCompanyInformationNumberFromDisplay(value) : null,
      numericDetailedValue: detailedValue ? stockCompanyInformationNumberFromDisplay(detailedValue) : null
    };
  }

  if (kind === 'percent') {
    const percentMatch = text.match(/-?\d{1,3}(?:[,.]\d+)?\s*%/);
    const value = percentMatch ? cleanText(percentMatch[0]).replace('.', ',').replace(/\s+/g, '') : text;
    return {
      value,
      detailedValue: '',
      numericValue: parseBrNumber(value),
      numericDetailedValue: null
    };
  }

  return {
    value: text,
    detailedValue: '',
    numericValue: null,
    numericDetailedValue: null
  };
}

function extractStockCompanyInformation(html = '', ticker = '') {
  const plain = htmlToPlainText(html);
  const symbol = String(ticker || '').toUpperCase();
  const section = stockSectionSliceByHeadings(
    plain,
    /INFORMA[ÇC][ÕO]ES\s+SOBRE\s+A\s+EMPRESA/i,
    [/REGI[ÕO]ES\s+ONDE/i, /NEG[ÓO]CIOS\s+QUE\s+GERAM/i, /POSI[ÇC][ÃA]O\s+ACION[ÁA]RIA/i, /Receitas\s+e\s+Lucros/i, /BALAN[ÇC]O\s+PATRIMONIAL/i]
  );
  const basePayload = {
    id: 'stock_company_information',
    title: 'Informações sobre a empresa',
    ticker: symbol,
    status: 'EMPTY',
    source: 'Investidor10 informações sobre a empresa',
    facts: [],
    groups: []
  };
  if (!section) return basePayload;

  const specs = [
    { id: 'market_value', label: 'Valor de mercado', pattern: 'Valor\\s+de\\s+mercado', kind: 'money', group: 'valuation', groupTitle: 'Valor e estrutura' },
    { id: 'enterprise_value', label: 'Valor de firma', pattern: 'Valor\\s+de\\s+firma', kind: 'money', group: 'valuation', groupTitle: 'Valor e estrutura' },
    { id: 'equity', label: 'Patrimônio Líquido', pattern: 'Patrim[ôo]nio\\s+L[ií]quido', kind: 'money', group: 'valuation', groupTitle: 'Valor e estrutura' },
    { id: 'shares_total', label: 'Nº total de papéis', pattern: 'N[ºo°]?\\s*total\\s+de\\s+pap[ée]is', kind: 'quantity', group: 'capital', groupTitle: 'Capital e listagem' },
    { id: 'assets', label: 'Ativos', pattern: 'Ativos(?!\\s+Circulante)', kind: 'money', group: 'balance', groupTitle: 'Ativos e dívida' },
    { id: 'current_assets', label: 'Ativo Circulante', pattern: 'Ativo\\s+Circulante', kind: 'money', group: 'balance', groupTitle: 'Ativos e dívida' },
    { id: 'gross_debt', label: 'Dívida Bruta', pattern: 'D[ií]vida\\s+Bruta', kind: 'money', group: 'debt', groupTitle: 'Endividamento e liquidez' },
    { id: 'net_debt', label: 'Dívida Líquida', pattern: 'D[ií]vida\\s+L[ií]quida', kind: 'money', group: 'debt', groupTitle: 'Endividamento e liquidez' },
    { id: 'cash', label: 'Disponibilidade', pattern: 'Disponibilidade', kind: 'money', group: 'debt', groupTitle: 'Endividamento e liquidez' },
    { id: 'listing_segment', label: 'Segmento de Listagem', pattern: 'Segmento\\s+de\\s+Listagem', kind: 'text', group: 'capital', groupTitle: 'Capital e listagem' },
    { id: 'free_float', label: 'Free Float', pattern: 'Free\\s+Float', kind: 'percent', group: 'capital', groupTitle: 'Capital e listagem' },
    { id: 'tag_along', label: 'Tag Along', pattern: 'Tag\\s+Along', kind: 'percent', group: 'capital', groupTitle: 'Capital e listagem' },
    { id: 'average_daily_liquidity', label: 'Liquidez Média Diária', pattern: 'Liquidez\\s+M[eé]dia\\s+Di[áa]ria', kind: 'money', group: 'capital', groupTitle: 'Capital e listagem' },
    { id: 'sector', label: 'Setor', pattern: 'Setor(?!\\s+de)', kind: 'text', group: 'classification', groupTitle: 'Classificação' },
    { id: 'segment', label: 'Segmento', pattern: 'Segmento(?!\\s+de\\s+Listagem)', kind: 'text', group: 'classification', groupTitle: 'Classificação' }
  ];

  const facts = [];
  for (let i = 0; i < specs.length; i += 1) {
    const spec = specs[i];
    const nextPatterns = specs.slice(i + 1).map(item => item.pattern);
    const rawSlice = stockCompanyDataField(section, spec.pattern, nextPatterns);
    const parsed = stockCompanyInformationValuesFromSlice(rawSlice, spec.kind);
    if (!parsed.value || /^[-—]$/.test(parsed.value)) continue;
    facts.push({
      id: spec.id,
      label: spec.label,
      value: parsed.value,
      detailedValue: parsed.detailedValue || '',
      numericValue: Number.isFinite(Number(parsed.numericValue)) ? parsed.numericValue : null,
      numericDetailedValue: Number.isFinite(Number(parsed.numericDetailedValue)) ? parsed.numericDetailedValue : null,
      group: spec.group,
      source: 'Investidor10 informações sobre a empresa'
    });
  }

  const groupSpecs = [];
  for (const spec of specs) {
    if (!groupSpecs.some(item => item.id === spec.group)) groupSpecs.push({ id: spec.group, title: spec.groupTitle });
  }
  const groups = groupSpecs
    .map(group => ({
      id: group.id,
      title: group.title,
      facts: facts.filter(item => item.group === group.id)
    }))
    .filter(group => group.facts.length);

  return {
    ...basePayload,
    status: facts.length ? 'OK' : 'EMPTY',
    facts,
    groups
  };
}

function extractStockCompanyProfile(html = '', ticker = '', name = '', quickMetrics = {}, fundamentalIndicators = {}) {
  const plain = htmlToPlainText(html);
  const symbol = String(ticker || '').toUpperCase();
  const startCandidates = [
    plain.search(/SOBRE\s+A\s+EMPRESA/i),
    plain.search(/Hist[óo]ria\s+e\s+quando\s+foi\s+criada/i)
  ].filter(i => i >= 0);
  const start = startCandidates.length ? Math.min(...startCandidates) : -1;
  const endCandidates = start >= 0 ? [
    plain.slice(start).search(/REGI[ÕO]ES\s+ONDE/i),
    plain.slice(start).search(/NEG[ÓO]CIOS\s+QUE\s+GERAM/i),
    plain.slice(start).search(/COMPARADOR\s+DE\s+A[ÇC][ÕO]ES/i),
    plain.slice(start).search(/Receitas\s+e\s+Lucros/i)
  ].filter(i => i > 600) : [];
  const end = start >= 0 ? start + (endCandidates.length ? Math.min(...endCandidates) : 9000) : -1;
  const plainSection = start >= 0 ? plain.slice(start, end) : '';

  let htmlSlice = '';
  const htmlStart = String(html || '').search(/SOBRE\s+A\s+EMPRESA|Hist[óo]ria\s+e\s+quando/i);
  if (htmlStart >= 0) {
    const relative = String(html || '').slice(htmlStart).search(/REGI[ÕO]ES\s+ONDE|NEG[ÓO]CIOS\s+QUE\s+GERAM|COMPARADOR\s+DE\s+A[ÇC][ÕO]ES/i);
    htmlSlice = String(html || '').slice(htmlStart, relative > 0 ? htmlStart + relative : htmlStart + 30000);
  }

  const rawParagraphs = extractHtmlParagraphsFromSlice(htmlSlice);
  const fallbackParagraphs = rawParagraphs.length >= 3 ? [] : sentenceParagraphsFromPlain(plainSection);
  const allParagraphs = [...rawParagraphs, ...fallbackParagraphs]
    .map(stripRepeatedSectionPrefixes)
    .filter(value => value.length > 25 && !/^(Avalie|Seguir|M[eé]dia de avalia[çc][õo]es)/i.test(value));
  const paragraphs = allParagraphs.filter((value, index, arr) => arr.findIndex(item => compactKey(item) === compactKey(value)) === index).slice(0, 18);

  const historyIndex = paragraphs.findIndex(value => /fundada|criada|Get[úu]lio|hist[óo]ria|primeiros anos|anos 1970/i.test(value));
  const infoIndex = paragraphs.findIndex(value => /valor de mercado|patrim[oô]nio|funcion[aá]rios|B3|setor|segmento/i.test(value));
  const aboutParagraphs = historyIndex > 0 ? paragraphs.slice(0, historyIndex) : paragraphs.slice(0, Math.min(7, paragraphs.length));
  const historyParagraphs = historyIndex >= 0 ? paragraphs.slice(historyIndex, infoIndex > historyIndex ? infoIndex : Math.min(paragraphs.length, historyIndex + 8)) : [];
  const additionalParagraphs = infoIndex >= 0 ? paragraphs.slice(infoIndex, Math.min(paragraphs.length, infoIndex + 5)) : [];

  const sections = [];
  if (aboutParagraphs.length) sections.push({ id: 'about_company', title: 'Sobre a empresa', paragraphs: aboutParagraphs });
  if (historyParagraphs.length) sections.push({ id: 'company_history', title: `História e quando foi criada a ${name || symbol}`, paragraphs: historyParagraphs });
  if (additionalParagraphs.length) sections.push({ id: 'additional_info', title: 'Informações adicionais', paragraphs: additionalParagraphs });

  const marketValue = stockMetricByLabel(fundamentalIndicators, 'Valor de Mercado')?.value || '';
  const facts = [
    quickMetrics?.priceDisplay ? { id: 'quote', label: 'Cotação', value: quickMetrics.priceDisplay } : null,
    quickMetrics?.variation12mDisplay ? { id: 'variation_12m', label: 'Variação 12M', value: quickMetrics.variation12mDisplay } : null,
    marketValue ? { id: 'market_value', label: 'Valor de mercado', value: marketValue } : null
  ].filter(Boolean);

  const cleanedName = cleanText(name);
  const titleName = cleanedName && cleanedName.toUpperCase() !== symbol ? cleanedName : (symbol || 'empresa');
  return {
    id: 'stock_company_profile',
    title: `Sobre a empresa ${titleName}`.trim(),
    ticker: symbol,
    name: titleName,
    logoUrl: extractStockCompanyLogoUrl(html, symbol, titleName) || '',
    ratingLabel: 'Média de avaliações dos usuários',
    status: sections.length ? 'OK' : 'EMPTY',
    source: 'Investidor10 sobre a empresa',
    facts,
    sections
  };
}

function compactMoneyFromDisplay(value = '') {
  const text = cleanText(value);
  const n = parseBrNumber(text);
  if (!Number.isFinite(Number(n))) return null;
  const lower = text.toLowerCase();
  let multiplier = 1;
  if (/bilh|bi\b| b\b/i.test(lower)) multiplier = 1_000_000_000;
  else if (/milh|mi\b| m\b/i.test(lower)) multiplier = 1_000_000;
  return round(Number(n) * multiplier, 2);
}

function parseStockRevenueRowsFromSection(section = '', fallbackPeriod = '') {
  const rows = [];
  const source = String(section || '').replace(/\s+/g, ' ');
  const amountPattern = String.raw`R\$\s*(?:\d{1,3}(?:\.\d{3})+|\d+)(?:,\d+)?\s*(?:Bilhões|Bilhoes|Bilhão|Bilhao|Milhões|Milhoes|Milhão|Milhao|B|M|K|mi|bi|mil)?`;
  const pctPattern = String.raw`(?:\d{1,3}(?:[,.]\d+)?\s*%)`;
  const re = new RegExp(String.raw`([^$%]{2,96}?)\s+(${amountPattern})[\s.,;:–—-]+(${pctPattern})`, 'gi');
  for (const match of source.matchAll(re)) {
    let label = cleanText(match[1])
      .replace(/^(?:REGI[ÕO]ES\s+ONDE\s+[^0-9]+|NEG[ÓO]CIOS\s+QUE\s+GERAM\s+[^0-9]+)\s*/i, '')
      .replace(/^(?:\d{4}\s*)+/, '')
      .replace(/^(?:Total\s*\([^)]+\)\s*)/i, '')
      .trim();
    const tailMatch = label.match(/([A-ZÁÉÍÓÚÂÊÔÃÕÀÇ][A-Za-zÀ-ÿ0-9().,/+\-\s]{1,56})$/);
    label = cleanText(tailMatch?.[1] || label).replace(/[\s.,;:–—-]+$/g, '').trim();
    if (!label || /^(Total|Ano|Selecione|REGI|NEG[ÓO]CIOS|Acionista|ARRASTE|Image)$/i.test(label)) continue;
    if (label.length > 58) label = label.slice(-58).replace(/^\S+\s+/, '').trim();
    const percent = parseBrNumber(match[3]);
    if (!Number.isFinite(Number(percent)) || percent <= 0 || percent > 100) continue;
    rows.push({
      id: metricId(label),
      label,
      amountDisplay: match[2].replace(/\s+/g, ' ').trim(),
      amount: compactMoneyFromDisplay(match[2]),
      percent: round(Number(percent), 4),
      percentDisplay: match[3].replace('.', ',').replace(/\s+/g, ''),
      source: 'Investidor10 distribuição de receitas'
    });
  }
  const deduped = [];
  const seen = new Set();
  for (const row of rows) {
    const key = compactKey(row.label);
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(row);
  }
  return deduped.slice(0, 12);
}

function totalFromStockRevenueSection(section = '') {
  const match = String(section || '').match(/Total\s*\(([^)]+)\)\s*(R\$\s*[\d.,]+\s*(?:Bilhões|Bilh[oõ]es|Milhões|Milhoes|B|M|mi|bi)?)/i)
    || String(section || '').match(/\bTotal\b\s*(R\$\s*[\d.,]+\s*(?:Bilhões|Bilh[oõ]es|Milhões|Milhoes|B|M|mi|bi)?)/i);
  if (!match) return { totalLabel: '', totalAmountDisplay: '—', totalAmount: null };
  const label = match.length > 2 ? `Total (${cleanText(match[1])})` : 'Total';
  const amount = match.length > 2 ? match[2] : match[1];
  return { totalLabel: label, totalAmountDisplay: cleanText(amount), totalAmount: compactMoneyFromDisplay(amount) };
}



function stockRevenueAmountPattern() {
  return String.raw`R\$\s*(?:\d{1,3}(?:\.\d{3})+|\d+)(?:,\d+)?\s*(?:Trilh(?:ão|ao|ões|oes)|Bilhões|Bilhoes|Bilhão|Bilhao|Milhões|Milhoes|Milhão|Milhao|B|M|K|mi|bi|mil)?`;
}

function extractRevenueAmountDisplayFromText(value = '') {
  const match = String(value || '').match(new RegExp(stockRevenueAmountPattern(), 'i'));
  return match ? cleanText(match[0]) : '';
}

function extractRevenuePercentDisplayFromText(value = '') {
  const match = String(value || '').match(/(?:\d{1,3}(?:[,.]\d+)?\s*%)/i);
  return match ? cleanText(match[0]).replace('.', ',').replace(/\s+/g, '') : '';
}

function stripRevenueDecorationsFromLabel(value = '') {
  let label = cleanText(value);
  label = label.replace(new RegExp(stockRevenueAmountPattern(), 'ig'), ' ');
  label = label.replace(/(?:\d{1,3}(?:[,.]\d+)?\s*%)/g, ' ');
  label = label.replace(/\b20\d{2}\b/g, ' ');
  label = label.replace(/\b(?:total|trimestral|anual|valor|receita|percentual|participa(?:ç|c)[aã]o)\b/ig, ' ');
  return cleanText(label);
}

function nestedRevenueValue(node = {}, paths = []) {
  for (const path of paths) {
    const parts = String(path).split('.');
    let curr = node;
    for (const part of parts) {
      if (!curr || typeof curr !== 'object') { curr = undefined; break; }
      curr = curr[part];
    }
    if (curr != null && curr !== '') return curr;
  }
  return undefined;
}

function revenueYearFromCandidate(candidate = {}) {
  const seen = new Set();
  const visit = (node, depth = 0) => {
    if (node == null || depth > 5) return '';
    if (typeof node !== 'object') return String(node || '').match(/\b(20\d{2})\b/)?.[1] || '';
    if (seen.has(node)) return '';
    seen.add(node);
    if (Array.isArray(node)) {
      for (const item of node.slice(0, 60)) {
        const found = visit(item, depth + 1);
        if (found) return found;
      }
      return '';
    }
    const direct = node.selectedYear || node.year || node.ano || node.period || node.periodo || node.label || node.name;
    const directMatch = String(direct || '').match(/\b(20\d{2})\b/);
    if (directMatch) return directMatch[1];
    const yearKeys = Object.keys(node || {}).filter(key => /^20\d{2}$/.test(String(key))).sort((a, b) => Number(b) - Number(a));
    if (yearKeys.length) return String(yearKeys[0]);
    for (const arr of [node.years, node.anos, node.periods, node.periodos]) {
      if (Array.isArray(arr)) {
        const found = arr
          .map(value => String(value || '').match(/\b(20\d{2})\b/)?.[1])
          .filter(Boolean)
          .sort((a, b) => Number(b) - Number(a))[0];
        if (found) return found;
      }
    }
    const series = [node.datasets, node.series, node.dataSeries, node.chart?.datasets, node.chart?.series]
      .filter(Array.isArray).flat();
    for (const serie of series) {
      const label = String(serie?.label || serie?.name || serie?.ano || serie?.year || '');
      const match = label.match(/\b(20\d{2})\b/);
      if (match) return match[1];
    }
    for (const value of Object.values(node).slice(0, 80)) {
      const found = visit(value, depth + 1);
      if (found) return found;
    }
    return '';
  };
  return visit(candidate, 0);
}



const STOCK_REVENUE_FORBIDDEN_LABEL_RE = /^(?:is[_\s-]*active|active|ticker|symbol|codigo|c[oó]digo|acao|a[cç][aã]o|asset|type|tipo|category|categoria|setor|subsetor|segmento|segment|tag[_\s-]*along|free[_\s-]*float|float|p[_\s\/-]*l|p[_\s\/-]*vp|p[_\s\/-]*receita|psr|dy|dividend[_\s-]*yield|yield|roe|roic|roa|vpa|lpa|payout|ev[_\s\/-]*ebitda|ev[_\s\/-]*ebit|ebitda|ebit|gross[_\s-]*margin|ebitda[_\s-]*margin|ebit[_\s-]*margin|net[_\s-]*margin|margem(?:\s+(?:bruta|ebitda|ebit|l[ií]quida))?|variation[_\s-]*(?:5|30|90|180|360|12m|month|year|days?)|variacao|varia[cç][aã]o|cotacao|cota[cç][aã]o|price|pre[cç]o|market[_\s-]*(?:cap|value)|valor[_\s-]*(?:de[_\s-]*)?mercado|liquidez|liquidity|volume|shares?|pap[eé]is|patrimonio|patrim[oô]nio|ativos?|assets?|passivos?|debt|d[ií]vida|cash|caixa|disponibilidade|lucro|profit|receita[_\s-]*(?:liquida|total)|revenue[_\s-]*(?:total|net)|cagr.*|ranking|score)$/i;
const STOCK_REVENUE_FORBIDDEN_TOKEN_RE = /\b(?:tag[_\s-]*along|free[_\s-]*float|p[_\s\/-]*l|p[_\s\/-]*vp|p[_\s\/-]*receita|psr|dividend[_\s-]*yield|roe|roic|roa|ev[_\s\/-]*ebitda|ev[_\s\/-]*ebit|gross[_\s-]*margin|ebitda[_\s-]*margin|ebit[_\s-]*margin|net[_\s-]*margin|margem\s+(?:bruta|ebitda|ebit|l[ií]quida)|variation[_\s-]*\d+[_\s-]*days?|variacao|varia[cç][aã]o|liquidez|liquidity|valor\s+de\s+mercado|market\s+cap|segmento\s+de\s+listagem)\b/i;

function looksLikeInvalidStockRevenueLabel(value = '') {
  const raw = cleanText(value).trim();
  if (!raw || raw.length < 2 || raw.length > 80) return true;
  const compact = compactKey(raw);
  const snakeMachineKey = /^[a-z][a-z0-9]*(?:_[a-z0-9]+)+$/.test(raw.trim());
  if (snakeMachineKey) return true;
  if (STOCK_REVENUE_FORBIDDEN_LABEL_RE.test(raw) || STOCK_REVENUE_FORBIDDEN_LABEL_RE.test(compact)) return true;
  if (STOCK_REVENUE_FORBIDDEN_TOKEN_RE.test(raw) || STOCK_REVENUE_FORBIDDEN_TOKEN_RE.test(compact)) return true;
  if (/^(?:true|false|null|undefined|sim|n[aã]o|yes|no)$/i.test(raw)) return true;
  if (/^\d+(?:[,.]\d+)?\s*%?$/.test(raw)) return true;
  if (/^[a-z0-9_.-]+$/i.test(raw) && /[_]/.test(raw)) return true;
  return false;
}

function stockRevenueRowsQuality(rows = [], kind = 'business') {
  const validRows = (Array.isArray(rows) ? rows : []).filter(row => row && !looksLikeInvalidStockRevenueLabel(row.label));
  if (!validRows.length) return { rows: [], invalidCount: rows.length, accepted: false };
  const sum = validRows.reduce((acc, row) => acc + (Number(row.percent) || 0), 0);
  const hasAmount = validRows.some(row => row.amountDisplay && row.amountDisplay !== '—' && /R\$|bilh|milh|trilh|mi\b|bi\b/i.test(row.amountDisplay));
  const wholeMachineLabels = validRows.filter(row => /^[a-z][a-z0-9]*(?:_[a-z0-9]+)+$/.test(String(row.label || ''))).length;
  const accepted = hasAmount || validRows.length >= 2 || sum > 25 || kind === 'region';
  if (wholeMachineLabels && wholeMachineLabels >= validRows.length) return { rows: [], invalidCount: rows.length, accepted: false };
  return { rows: validRows, invalidCount: rows.length - validRows.length, accepted };
}

function normalizeRevenueCandidateRow(node = {}, index = 0, kind = 'region', source = 'Investidor10 distribuição de receitas API') {
  if (!node || typeof node !== 'object') return null;
  const rawLabel = cleanText(
    node.label || node.name || node.nome || node.title || node.description || node.descricao || node.descrição || node.nome_pt || node.name_pt
    || node.region || node.regiao || node.região || node.nomeRegiao || node.regiaoNome || node.nome_regiao || node.geography || node.geografia || node.geographicArea || node.areaGeografica || node.area_geografica || node.local || node.localidade || node.location || node.market || node.mercado || node.country || node.pais || node.país || node.area || node.territory || node.destination || node.destino || node.uf || node.estado
    || node.segment || node.segmento || node.nomeSegmento || node.segmentName || node.business || node.bussines || node.businessName || node.negocio || node.negócio || node.nomeNegocio || node.nome_negocio || node.product || node.produto || node.nomeProduto || node.nome_produto || node.descricaoProduto || node.descProduto || node.category || node.categoria || node.activity || node.atividade || node.grupoReceita || node.grupo_receita || node.linha || node.linhaNegocio || node.linha_negocio || node.businessLine || node.businessUnit || node.unidadeNegocio || node.unidade_negocio || node.x || ''
  );
  const embeddedAmountDisplay = extractRevenueAmountDisplayFromText(rawLabel);
  const embeddedPercentDisplay = extractRevenuePercentDisplayFromText(rawLabel);
  const label = stripRevenueDecorationsFromLabel(rawLabel);
  if (!label || /^(total|ano|year|data|value|valor|percentual|percent)$/i.test(label) || label.length > 80) return null;
  if (looksLikeInvalidStockRevenueLabel(rawLabel) || looksLikeInvalidStockRevenueLabel(label)) return null;
  const explicitPercentRaw = node.percentDisplay || node.percentualDisplay || node.percentageDisplay || node.shareDisplay || node.participationDisplay || node.participacaoDisplay || embeddedPercentDisplay || node.percentual || node.porcentual || node.porcentagem || node.percentualReceita || node.receitaPercentual || node.participacaoReceita || node.valorPercentual || node.percent_value || node.percent || node.percentage || node.percentageValue || node.sharePercent || node.share || node.shareValue || node.shareRevenue || node.revenueShare || node.percentRevenue || node.revenuePercent || node.yPercent || node.y_percentage || node.pct || node.participation || node.participacao || node.participação || node.custom?.percent || node.custom?.percentage || node.custom?.percentual || node.custom?.percentualReceita || node.custom?.receitaPercentual || node.extra?.percent || node.meta?.percent || node.y;
  let percentRaw = explicitPercentRaw;
  let percent = parseBrNumber(percentRaw);
  const valueAsPercent = (percent == null || !Number.isFinite(Number(percent))) && Number.isFinite(Number(node.value)) && Math.abs(Number(node.value)) <= 100;
  if (valueAsPercent) {
    percentRaw = node.value;
    percent = Number(node.value);
  }
  if (percent == null || !Number.isFinite(Number(percent)) || percent <= 0 || percent > 100) return null;
  const amountRaw = node.amountDisplay || node.valorDisplay || node.valueDisplay || node.totalDisplay || node.receitaDisplay || node.revenueDisplay || node.formattedValue || node.formatted_value || node.displayValue || node.display_value || node.dataLabel || node.data_label || embeddedAmountDisplay || nestedRevenueValue(node, ['custom.amountDisplay','custom.valorDisplay','custom.valueDisplay','custom.receitaDisplay','custom.revenueDisplay','custom.valor','custom.valorReceita','custom.receitaBruta','custom.netRevenue','extra.amountDisplay','extra.valorDisplay','extra.valorReceita','meta.amountDisplay','meta.valorDisplay','meta.valorReceita']) || node.amount || node.valor || node.total || node.receita || node.revenue || node.valorReceita || node.receitaValor || node.vlReceita || node.receitaBruta || node.receitaLiquida || node.grossRevenue || node.netRevenue || node.totalRevenue || node.custom?.amount || node.custom?.valor || node.custom?.receita || node.extra?.amount || node.meta?.amount || (!valueAsPercent ? (node.value || node.custom?.value) : '');
  const amountDisplay = cleanText(amountRaw || '');
  const percentDisplay = /%/.test(String(percentRaw || ''))
    ? cleanText(percentRaw).replace('.', ',').replace(/\s+/g, '')
    : (Number.isInteger(Number(percent)) ? `${Number(percent)}%` : formatPercent(Number(percent)).replace('+', ''));
  return {
    id: `${kind}_${index}_${metricId(label)}`,
    label,
    amountDisplay: amountDisplay || '—',
    amount: amountDisplay ? compactMoneyFromDisplay(amountDisplay) : (Number.isFinite(Number(node.amount || node.valor || node.receita || node.revenue)) ? round(Number(node.amount || node.valor || node.receita || node.revenue), 2) : null),
    percent: round(Number(percent), 4),
    percentDisplay,
    source
  };
}

function pickRevenueLabelsFromCandidate(candidate = {}) {
  if (!candidate || typeof candidate !== 'object') return [];
  const paths = [
    candidate.labels,
    candidate.categories,
    candidate.names,
    candidate.xAxis?.categories,
    candidate.xaxis?.categories,
    candidate.options?.labels,
    candidate.options?.xaxis?.categories,
    candidate.chart?.labels,
    candidate.chart?.categories,
    candidate.chartData?.labels,
    candidate.chartData?.categories,
    candidate.data?.labels,
    candidate.data?.categories,
    candidate.payload?.labels,
    candidate.payload?.categories
  ];
  for (const value of paths) {
    if (Array.isArray(value) && value.some(v => cleanText(v))) return value.map(v => cleanText(v));
  }
  return [];
}

function pickRevenueSeriesValuesFromCandidate(candidate = {}) {
  if (!candidate || typeof candidate !== 'object') return [];
  const candidates = [candidate.series, candidate.data, candidate.values, candidate.datasets, candidate.chartData?.series, candidate.chartData?.data, candidate.chartData?.datasets, candidate.payload?.series, candidate.payload?.data, candidate.payload?.datasets];
  for (const value of candidates) {
    if (!Array.isArray(value)) continue;
    if (value.every(item => item == null || typeof item !== 'object')) return value;
    const firstDataObject = value.find(item => Array.isArray(item?.data) || Array.isArray(item?.values));
    if (firstDataObject) return firstDataObject.data || firstDataObject.values || [];
  }
  return [];
}

function pairedRevenueRowsFromCandidate(candidate, kind = 'region', source = 'Investidor10 distribuição de receitas API') {
  const labels = pickRevenueLabelsFromCandidate(candidate);
  const values = pickRevenueSeriesValuesFromCandidate(candidate);
  if (!labels.length || !values.length) return [];
  return labels.map((label, index) => {
    const rawValue = values[index];
    const numeric = typeof rawValue === 'object' ? parseBrNumber(rawValue?.y ?? rawValue?.value ?? rawValue?.percent ?? rawValue?.percentage) : parseBrNumber(rawValue);
    if (!Number.isFinite(Number(numeric)) || Number(numeric) <= 0 || Number(numeric) > 100) return null;
    return normalizeRevenueCandidateRow({ label, percent: numeric, amountDisplay: revenueAmountDisplayFromCandidate(candidate, index) }, index, kind, source);
  }).filter(Boolean);
}


function revenueAmountDisplayFromCandidate(candidate = {}, index = 0) {
  if (!candidate || typeof candidate !== 'object') return '';
  const arrays = [
    candidate.amountsDisplay, candidate.amountDisplays, candidate.valoresDisplay, candidate.valuesDisplay,
    candidate.receitasDisplay, candidate.revenuesDisplay, candidate.amounts, candidate.valores, candidate.receitas,
    candidate.revenues, candidate.formattedValues, candidate.formattedData, candidate.displayValues, candidate.dataLabels, candidate.valueLabels, candidate.labelsDisplay, candidate.customData, candidate.tooltips, candidate.tooltipData, candidate.legends, candidate.legendData, candidate.metaData
  ];
  for (const arr of arrays) {
    if (!Array.isArray(arr)) continue;
    const raw = arr[index];
    if (raw == null) continue;
    if (typeof raw === 'object') {
      const value = raw.amountDisplay || raw.valorDisplay || raw.valueDisplay || raw.receitaDisplay || raw.revenueDisplay || raw.amount || raw.valor || raw.value || raw.receita || raw.revenue;
      if (value != null && String(value).trim()) return cleanText(value);
    } else if (String(raw).trim()) {
      return cleanText(raw);
    }
  }
  return '';
}

function parseRevenueAmountNumber(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const text = cleanText(value);
  if (!text || /%/.test(text)) return null;
  const numeric = parseBrNumber(text);
  if (!Number.isFinite(Number(numeric))) return null;
  const lower = text.toLowerCase();
  let multiplier = 1;
  if (/trilh|\btri\b|\bt\b/.test(lower)) multiplier = 1_000_000_000_000;
  else if (/bilh|\bbi\b|\bb\b/.test(lower)) multiplier = 1_000_000_000;
  else if (/milh|\bmi\b|\bm\b/.test(lower)) multiplier = 1_000_000;
  else if (/\bmil\b|\bk\b/.test(lower)) multiplier = 1_000;
  return Number(numeric) * multiplier;
}

function formatRevenueMoneyAbbrev(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '';
  const abs = Math.abs(n);
  const dec = (v, d = 2) => v.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
  if (abs >= 1_000_000_000_000) return `R$ ${dec(n / 1_000_000_000_000, 2)} Trilhões`;
  if (abs >= 1_000_000_000) return `R$ ${dec(n / 1_000_000_000, 2)} Bilhões`;
  if (abs >= 1_000_000) return `R$ ${dec(n / 1_000_000, 2)} Milhões`;
  if (abs >= 1_000) return `R$ ${dec(n / 1_000, 2)} Mil`;
  return formatMoney(n);
}

function firstRevenueAliasValue(node = {}, aliases = []) {
  if (!node || typeof node !== 'object') return undefined;
  const byCompact = new Map(Object.entries(node).map(([key, value]) => [compactKey(key), value]));
  for (const alias of aliases) {
    if (Object.prototype.hasOwnProperty.call(node, alias)) return node[alias];
    const compact = compactKey(alias);
    if (byCompact.has(compact)) return byCompact.get(compact);
  }
  return undefined;
}

function revenueNestedAliasValue(node = {}, aliases = [], maxDepth = 3) {
  const direct = firstRevenueAliasValue(node, aliases);
  if (direct !== undefined && direct !== null && direct !== '') return direct;
  if (!node || typeof node !== 'object' || maxDepth <= 0) return undefined;
  const nestedKeys = ['custom', 'extra', 'meta', 'metadata', 'data', 'datum', 'point', 'options', 'tooltip', 'dataLabels', 'labelData', 'raw', 'payload', 'props'];
  for (const key of nestedKeys) {
    const value = node[key];
    if (value && typeof value === 'object') {
      const nested = revenueNestedAliasValue(value, aliases, maxDepth - 1);
      if (nested !== undefined && nested !== null && nested !== '') return nested;
    }
  }
  return undefined;
}

function revenueLabelFromNode(node = {}, kind = 'region') {
  const aliases = kind === 'business'
    ? ['label','name','nome','title','titulo','segment','segmento','business','bussines','negocio','negócio','produto','product','category','categoria','activity','atividade','linhaNegocio','linha_negocio','businessLine','business_line','description','descricao']
    : ['label','name','nome','title','titulo','region','regiao','região','geography','geografia','local','localidade','location','country','pais','país','mercado','market','description','descricao'];
  const raw = revenueNestedAliasValue(node, aliases);
  const label = stripRevenueDecorationsFromLabel(raw || '');
  if (!label || /^(total|ano|year|data|value|valor|percentual|percent|receita)$/i.test(label) || label.length > 90) return '';
  return label;
}

function revenuePercentFromNode(node = {}) {
  const value = revenueNestedAliasValue(node, [
    'percentDisplay','percentualDisplay','percentageDisplay','shareDisplay','participationDisplay','participacaoDisplay','participaçãoDisplay',
    'percentual','porcentual','porcentagem','percent','percentage','sharePercent','share','participation','participacao','participação',
    'representatividade','representatividadePercentual','participacaoReceita','participaçãoReceita','revenueShare','valuePercent','valorPercentual','shareValue','share_value','part','parts','percentValue','percent_value','yPercent','y_percentage','pct','pctDisplay'
  ]);
  const n = parseBrNumber(value);
  return Number.isFinite(Number(n)) && Number(n) > 0 && Number(n) <= 100 ? Number(n) : null;
}

function revenueAmountFromNode(node = {}) {
  const value = revenueNestedAliasValue(node, [
    'amountDisplay','valorDisplay','valueDisplay','totalDisplay','receitaDisplay','revenueDisplay','formattedValue','formatted_value','displayValue','display_value','dataLabel','data_label',
    'amount','valor','value','total','receita','revenue','grossRevenue','gross_revenue','netRevenue','net_revenue','receitaLiquida','receita_liquida','receitaBruta','receita_bruta','valorReceita','valor_receita','vendas','sales','sale','y'
  ]);
  const numeric = parseRevenueAmountNumber(value);
  const display = value == null || value === '' ? '' : cleanText(value);
  return { raw: value, amount: numeric, amountDisplay: display && !/^\d+(?:[,.]\d+)?$/.test(display) ? display : '' };
}

function revenueTotalNumberFromCandidate(candidate = {}) {
  const total = revenueTotalFromCandidate(candidate);
  if (Number.isFinite(Number(total?.totalAmount))) return Number(total.totalAmount);
  if (!candidate || typeof candidate !== 'object') return null;
  const direct = firstRevenueAliasValue(candidate, ['totalAmount','total','valorTotal','receitaTotal','revenueTotal','totalValue','sum','soma']);
  const numeric = parseRevenueAmountNumber(direct);
  return Number.isFinite(Number(numeric)) ? Number(numeric) : null;
}

function revenueRowsFromAmountSharesCandidate(candidate, kind = 'region', source = 'Investidor10 distribuição de receitas API') {
  if (!candidate || typeof candidate !== 'object') return [];
  const arrays = [];
  const maybeAddArray = (value) => { if (Array.isArray(value)) arrays.push(value); };
  maybeAddArray(candidate);
  for (const key of ['items','rows','data','values','segments','series','datasets','children','pontos','pontosGrafico','chartData','payload','result','results','response']) {
    const value = candidate?.[key];
    maybeAddArray(value);
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      for (const child of Object.values(value).slice(0, 40)) maybeAddArray(child);
    }
  }
  for (const key of Object.keys(candidate || {})) {
    if (/^20\d{2}$/.test(key)) maybeAddArray(candidate[key]);
  }
  const rows = [];
  for (const arr of arrays) {
    const staged = [];
    for (const node of arr.slice(0, 80)) {
      if (!node || typeof node !== 'object' || Array.isArray(node)) continue;
      const label = revenueLabelFromNode(node, kind);
      if (!label) continue;
      const explicitPercent = revenuePercentFromNode(node);
      const amountInfo = revenueAmountFromNode(node);
      if (explicitPercent != null) {
        const normalized = normalizeRevenueCandidateRow({ ...node, label, percent: explicitPercent, amountDisplay: amountInfo.amountDisplay || node.amountDisplay || node.valorDisplay || node.receitaDisplay || node.revenueDisplay || '' }, rows.length, kind, source);
        if (normalized) rows.push(normalized);
        continue;
      }
      if (Number.isFinite(Number(amountInfo.amount)) && Number(amountInfo.amount) > 0) {
        staged.push({ node, label, amount: Number(amountInfo.amount), amountDisplay: amountInfo.amountDisplay });
      }
    }
    if (!staged.length) continue;
    const total = revenueTotalNumberFromCandidate(candidate) || staged.reduce((sum, row) => sum + row.amount, 0);
    if (!Number.isFinite(Number(total)) || total <= 0) continue;
    for (const row of staged) {
      const percent = round((row.amount / total) * 100, 4);
      if (!Number.isFinite(Number(percent)) || percent <= 0 || percent > 100) continue;
      rows.push({
        id: `${kind}_${rows.length}_${metricId(row.label)}`,
        label: row.label,
        amountDisplay: row.amountDisplay || formatRevenueMoneyAbbrev(row.amount) || '—',
        amount: round(row.amount, 2),
        percent,
        percentDisplay: formatPercent(percent).replace('+', ''),
        source
      });
    }
  }
  return rows.filter(Boolean);
}


function normalizeRevenueChartEntries(entries = [], kind = 'region', source = 'Investidor10 distribuição de receitas API', candidate = {}) {
  const isPositiveNumber = value => value != null && value !== '' && Number.isFinite(Number(value)) && Number(value) > 0;
  const isValidPercent = value => isPositiveNumber(value) && Number(value) <= 100;
  const cleaned = entries.map((entry, index) => {
    const label = stripRevenueDecorationsFromLabel(entry?.label || '');
    if (!label || looksLikeInvalidStockRevenueLabel(label)) return null;
    const rawValue = entry?.rawValue ?? entry?.value ?? entry?.percent ?? entry?.amount;
    const parsedNumeric = rawValue == null || rawValue === '' ? null : parseBrNumber(rawValue);
    const amountDisplay = cleanText(entry?.amountDisplay || extractRevenueAmountDisplayFromText(entry?.label || '') || extractRevenueAmountDisplayFromText(rawValue || ''));
    const explicitPercentDisplay = cleanText(entry?.percentDisplay || extractRevenuePercentDisplayFromText(entry?.label || '') || extractRevenuePercentDisplayFromText(rawValue || ''));
    const parsedExplicitPercent = explicitPercentDisplay
      ? parseBrNumber(explicitPercentDisplay)
      : (entry?.explicitPercent == null || entry?.explicitPercent === '' ? null : parseBrNumber(entry.explicitPercent));
    return {
      index,
      label,
      numeric: parsedNumeric != null && Number.isFinite(Number(parsedNumeric)) ? Number(parsedNumeric) : null,
      amountDisplay,
      explicitPercent: parsedExplicitPercent != null && Number.isFinite(Number(parsedExplicitPercent)) ? Number(parsedExplicitPercent) : null,
      explicitPercentDisplay
    };
  }).filter(Boolean);
  if (!cleaned.length) return [];

  const candidateTotal = revenueTotalNumberFromCandidate(candidate);
  const hasMoneyDisplays = cleaned.some(row => /R\$|bilh|milh|trilh|mi\b|bi\b|mil\b/i.test(row.amountDisplay || ''));
  const numericValues = cleaned.map(row => row.numeric).filter(isPositiveNumber);
  const numericSum = numericValues.reduce((sum, value) => sum + Number(value), 0);
  const looksPercentSeries = !hasMoneyDisplays
    && numericValues.length === cleaned.length
    && numericValues.every(isValidPercent)
    && numericSum <= 130;
  const amountTotal = isPositiveNumber(candidateTotal)
    ? Number(candidateTotal)
    : numericSum > 0 ? numericSum : null;

  return cleaned.map((row, outIndex) => {
    let percent = row.explicitPercent;
    let amount = null;
    let amountDisplay = row.amountDisplay || '';
    if (!isValidPercent(percent)) {
      const parsedAmount = parseRevenueAmountNumber(amountDisplay);
      const amountFromDisplay = isPositiveNumber(parsedAmount) ? Number(parsedAmount) : null;
      const displayImpliedPercent = isPositiveNumber(amountFromDisplay) && isPositiveNumber(amountTotal)
        ? (Number(amountFromDisplay) / Number(amountTotal)) * 100
        : null;
      const rawLooksLikePercent = isValidPercent(row.numeric)
        && (!isPositiveNumber(displayImpliedPercent) || Math.abs(Number(row.numeric) - Number(displayImpliedPercent)) <= Math.max(1.5, Number(displayImpliedPercent) * 0.035));
      if ((looksPercentSeries || rawLooksLikePercent) && isPositiveNumber(row.numeric)) {
        percent = Number(row.numeric);
        amount = amountFromDisplay;
      } else {
        amount = amountFromDisplay;
        if (!isPositiveNumber(amount) && isPositiveNumber(row.numeric)) amount = Number(row.numeric);
        if (isPositiveNumber(amount) && isPositiveNumber(amountTotal)) {
          percent = (Number(amount) / Number(amountTotal)) * 100;
          if (!amountDisplay) amountDisplay = formatRevenueMoneyAbbrev(Number(amount));
        }
      }
    }
    if (!isValidPercent(percent)) return null;
    return {
      id: `${kind}_${outIndex}_${metricId(row.label)}`,
      label: row.label,
      amountDisplay: amountDisplay || '—',
      amount: isPositiveNumber(amount) ? round(Number(amount), 2) : (amountDisplay ? compactMoneyFromDisplay(amountDisplay) : null),
      percent: round(Number(percent), 4),
      percentDisplay: row.explicitPercentDisplay || (Number.isInteger(Number(percent)) ? `${Number(percent)}%` : formatPercent(Number(percent)).replace('+', '')),
      source
    };
  }).filter(Boolean);
}

function highchartsRevenueRowsFromCandidate(candidate, kind = 'region', source = 'Investidor10 distribuição de receitas API') {
  if (!candidate || typeof candidate !== 'object') return [];
  const entries = [];
  const series = [];
  if (Array.isArray(candidate.series)) series.push(...candidate.series);
  if (Array.isArray(candidate.datasets)) series.push(...candidate.datasets);
  if (candidate.chart && Array.isArray(candidate.chart.series)) series.push(...candidate.chart.series);
  for (const serie of series) {
    if (!serie || typeof serie !== 'object') continue;
    const data = Array.isArray(serie.data) ? serie.data : Array.isArray(serie.values) ? serie.values : [];
    for (const point of data) {
      if (Array.isArray(point)) {
        entries.push({ label: point[0], rawValue: point[1], explicitPercent: point[2], amountDisplay: extractRevenueAmountDisplayFromText(point.slice(1).join(' ')), percentDisplay: extractRevenuePercentDisplayFromText(point.slice(1).join(' ')) });
      } else if (point && typeof point === 'object') {
        const label = revenueLabelFromNode(point, kind) || point.name || point.label || point.category || point.categoria || point.x || point.region || point.regiao || point.country || point.pais || point.segment || point.segmento || point.business || point.negocio || point.product || point.produto || point.activity || point.atividade;
        const explicitPercent = revenueNestedAliasValue(point, ['percent','percentage','percentual','porcentagem','share','revenueShare','participation','participacao','participação','percentDisplay','percentualDisplay','percentageDisplay','pct']);
        const rawValue = revenueNestedAliasValue(point, ['y','value','valor','amount','receita','revenue','valorReceita','receitaLiquida','grossRevenue','netRevenue']) ?? explicitPercent;
        const amountDisplay = revenueNestedAliasValue(point, ['amountDisplay','valorDisplay','valueDisplay','receitaDisplay','revenueDisplay','formattedValue','formatted_value','dataLabel','data_label','displayValue','display_value','label']);
        const percentDisplay = revenueNestedAliasValue(point, ['percentDisplay','percentualDisplay','percentageDisplay','shareDisplay','participationDisplay','pctDisplay']);
        entries.push({ ...point, label, rawValue, explicitPercent, amountDisplay, percentDisplay });
      }
    }
  }
  return normalizeRevenueChartEntries(entries, kind, source, candidate);
}

function chartJsRevenueRowsFromCandidate(candidate, kind = 'region', source = 'Investidor10 distribuição de receitas API') {
  if (!candidate || typeof candidate !== 'object') return [];
  const labels = pickRevenueLabelsFromCandidate(candidate);
  if (!labels.length) return [];
  const datasets = [candidate.datasets, candidate.series, candidate.dataSeries, candidate.chart?.datasets, candidate.chart?.series]
    .filter(Array.isArray).flat();
  const amountDisplays = [candidate.amountsDisplay, candidate.amountDisplays, candidate.valoresDisplay, candidate.valuesDisplay, candidate.receitasDisplay, candidate.revenuesDisplay, candidate.formattedValues, candidate.formattedData, candidate.displayValues, candidate.dataLabels, candidate.valueLabels]
    .find(Array.isArray) || [];
  for (const dataset of datasets) {
    const values = Array.isArray(dataset?.data) ? dataset.data : Array.isArray(dataset?.values) ? dataset.values : Array.isArray(dataset) ? dataset : [];
    if (!values.length) continue;
    const entries = labels.map((label, index) => {
      const rawValue = values[index];
      if (rawValue && typeof rawValue === 'object') {
        return {
          ...rawValue,
          label: revenueLabelFromNode(rawValue, kind) || rawValue.name || rawValue.label || label,
          rawValue: revenueNestedAliasValue(rawValue, ['y','value','valor','amount','receita','revenue','valorReceita','receitaLiquida','grossRevenue','netRevenue','percent','percentage']),
          explicitPercent: revenueNestedAliasValue(rawValue, ['percent','percentage','percentual','porcentagem','share','revenueShare','participation','participacao','participação','percentDisplay','percentualDisplay','percentageDisplay','pct']),
          amountDisplay: revenueNestedAliasValue(rawValue, ['amountDisplay','valorDisplay','valueDisplay','receitaDisplay','revenueDisplay','formattedValue','formatted_value','displayValue','display_value','dataLabel','data_label']) || amountDisplays[index] || revenueAmountDisplayFromCandidate(candidate, index),
          percentDisplay: revenueNestedAliasValue(rawValue, ['percentDisplay','percentualDisplay','percentageDisplay','shareDisplay','participationDisplay','pctDisplay'])
        };
      }
      return { label, rawValue, amountDisplay: amountDisplays[index] || revenueAmountDisplayFromCandidate(candidate, index) };
    });
    const rows = normalizeRevenueChartEntries(entries, kind, source, candidate);
    if (rows.length) return rows;
  }
  const values = pickRevenueSeriesValuesFromCandidate(candidate);
  if (values.length) {
    return normalizeRevenueChartEntries(labels.map((label, index) => ({ label, rawValue: values[index], amountDisplay: amountDisplays[index] || revenueAmountDisplayFromCandidate(candidate, index) })), kind, source, candidate);
  }
  return [];
}

function revenuePlainObjectEntries(candidate = {}) {
  return candidate && typeof candidate === 'object' && !Array.isArray(candidate) ? Object.entries(candidate) : [];
}

function revenueYearBucketEntries(candidate = {}) {
  const entries = revenuePlainObjectEntries(candidate)
    .filter(([key, value]) => /^20\d{2}$/.test(String(key)) && value && typeof value === 'object')
    .sort((a, b) => Number(b[0]) - Number(a[0]));
  return entries;
}

function objectMapRevenueRowsFromCandidate(candidate, kind = 'region', source = 'Investidor10 distribuição de receitas API') {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return [];
  const yearBuckets = revenueYearBucketEntries(candidate);
  if (yearBuckets.length) {
    for (const [period, bucket] of yearBuckets) {
      const bucketRows = objectMapRevenueRowsFromCandidate(bucket, kind, source)
        .map((row) => ({ ...row, period, year: period }));
      if (bucketRows.length) return bucketRows;
    }
  }
  const ignored = new Set(['labels','categories','names','series','datasets','data','values','items','rows','children','options','chart','xAxis','xaxis','custom','extra','meta','metadata','raw','payload','props','total','totalAmountDisplay','totalDisplay','valorTotal','receitaTotal','revenueTotal','year','ano','period','periodo','title','id','source','status']);
  const rows = [];
  for (const [key, value] of Object.entries(candidate)) {
    if (ignored.has(key) || /^20\d{2}$/.test(String(key)) || /(display|formatted|label|percentual|percent|percentage|share|participa|amount|valor|receita|revenue|total)$/i.test(String(key))) continue;
    const label = cleanText(key);
    if (!label || label.length > 70 || looksLikeInvalidStockRevenueLabel(label)) continue;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const row = normalizeRevenueCandidateRow({ ...value, label }, rows.length, kind, source);
      if (row) rows.push(row);
      continue;
    }
    const numeric = parseBrNumber(value);
    if (Number.isFinite(Number(numeric)) && Number(numeric) > 0 && Number(numeric) <= 100) {
      rows.push(normalizeRevenueCandidateRow({ label, percent: numeric }, rows.length, kind, source));
    }
  }
  return rows.filter(Boolean);
}


function tupleRevenueRowsFromCandidate(candidate, kind = 'region', source = 'Investidor10 distribuição de receitas API') {
  const rows = [];
  const walk = (node) => {
    if (!node) return;
    if (Array.isArray(node)) {
      const primitive = node.filter(x => x != null && typeof x !== 'object').map(x => cleanText(x)).filter(Boolean);
      if (primitive.length >= 2) {
        const hasTextLabel = primitive.some(x => !/^(?:R\$|\d{1,3}(?:[,.]\d+)?%?|20\d{2})$/i.test(x));
        if (!hasTextLabel) {
          node.forEach(walk);
          return;
        }
        const joined = primitive.join(' ');
        const parsed = parseStockRevenueRowsFromSection(joined).map(row => ({ ...row, id: `${kind}_${rows.length}_${metricId(row.label)}`, source }));
        if (parsed.length) {
          rows.push(...parsed);
          return;
        }
        const label = stripRevenueDecorationsFromLabel(primitive.find(x => !/^R\$|\d/.test(x)) || primitive[0] || '');
        const amountDisplay = primitive.map(extractRevenueAmountDisplayFromText).find(Boolean) || '';
        const percentDisplay = primitive.map(extractRevenuePercentDisplayFromText).find(Boolean) || '';
        const percent = parseBrNumber(percentDisplay || primitive.find(x => /^\d{1,3}(?:[,.]\d+)?$/.test(x)) || '');
        const row = normalizeRevenueCandidateRow({ label, amountDisplay, percentDisplay: percentDisplay || undefined, percent: Number.isFinite(Number(percent)) ? percent : undefined }, rows.length, kind, source);
        if (row) rows.push(row);
        return;
      }
      node.forEach(walk);
      return;
    }
    if (typeof node !== 'object') return;
    for (const key of ['rows', 'items', 'data', 'values', 'series', 'datasets', 'children', 'pontos', 'pontosGrafico', 'chartData', 'payload']) {
      if (node[key]) walk(node[key]);
    }
  };
  walk(candidate);
  return rows.filter(Boolean);
}


function revenueDataTableColumnRole(column = {}, index = 0, kind = 'region') {
  const title = cleanText(column.title || column.label || column.name || column.header || column.text || column.data || column.field || column.key || column.id || index);
  const key = compactKey(title);
  const rawData = String(column.data ?? column.field ?? column.key ?? column.id ?? index);
  const labelRe = kind === 'business'
    ? /(negocio|business|bussines|segmento|segment|produto|product|atividade|activity|linha)/i
    : /(regiao|region|geograph|geografia|country|pais|mercado|local)/i;
  if (labelRe.test(key) || (/^(?:0|name|nome|label|title|descricao|description)$/i.test(rawData) && index === 0)) return { role: 'label', dataKey: rawData };
  if (/(percent|percentual|porcent|participa|share|%)/i.test(key) || /^(?:2|percent|percentage|percentual|share)$/i.test(rawData)) return { role: 'percent', dataKey: rawData };
  if (/(valor|receita|revenue|amount|total|r\$)/i.test(key) || /^(?:1|valor|value|amount|receita|revenue)$/i.test(rawData)) return { role: 'amount', dataKey: rawData };
  if (index === 0) return { role: 'label', dataKey: rawData };
  if (index === 1) return { role: 'amount', dataKey: rawData };
  if (index === 2) return { role: 'percent', dataKey: rawData };
  return { role: '', dataKey: rawData };
}

function revenueIndexedCell(row, key, index) {
  if (!row || typeof row !== 'object') return undefined;
  if (Array.isArray(row)) return row[index];
  const candidates = [key, String(key), index, String(index)].filter(value => value !== undefined && value !== null && value !== '');
  for (const candidate of candidates) {
    if (Object.prototype.hasOwnProperty.call(row, candidate)) return row[candidate];
  }
  return undefined;
}

function indexedRevenueRowsFromCandidate(candidate, kind = 'region', source = 'Investidor10 distribuição de receitas API') {
  if (!candidate || typeof candidate !== 'object') return [];
  const columns = Array.isArray(candidate.columns) ? candidate.columns : Array.isArray(candidate.cols) ? candidate.cols : Array.isArray(candidate.headers) ? candidate.headers : [];
  const sourceRows = [candidate.data, candidate.rows, candidate.items, candidate.values, candidate.result?.data, candidate.payload?.data, candidate.response?.data]
    .find(Array.isArray) || (Array.isArray(candidate) ? candidate : []);
  if (!sourceRows.length) return [];
  const normalizedColumns = (columns.length ? columns : [{ data: '0', title: kind === 'business' ? 'Negócio' : 'Região' }, { data: '1', title: 'Receita' }, { data: '2', title: '%' }])
    .map((column, index) => revenueDataTableColumnRole(typeof column === 'object' ? column : { data: index, title: column }, index, kind));
  const labelColumns = normalizedColumns.filter(col => col.role === 'label');
  const amountColumns = normalizedColumns.filter(col => col.role === 'amount');
  const percentColumns = normalizedColumns.filter(col => col.role === 'percent');
  const rows = [];
  sourceRows.slice(0, 80).forEach((row, rowIndex) => {
    if (!row || (typeof row !== 'object' && !Array.isArray(row))) return;
    const labelRaw = labelColumns.map(col => revenueIndexedCell(row, col.dataKey, normalizedColumns.indexOf(col))).map(cleanText).find(Boolean)
      || revenueIndexedCell(row, '0', 0);
    const amountRaw = amountColumns.map(col => revenueIndexedCell(row, col.dataKey, normalizedColumns.indexOf(col))).map(cleanText).find(Boolean)
      || revenueIndexedCell(row, '1', 1);
    const percentRaw = percentColumns.map(col => revenueIndexedCell(row, col.dataKey, normalizedColumns.indexOf(col))).map(cleanText).find(Boolean)
      || revenueIndexedCell(row, '2', 2)
      || extractRevenuePercentDisplayFromText(cleanText(amountRaw || ''));
    const rowObject = {
      label: labelRaw,
      amountDisplay: amountRaw,
      percentDisplay: percentRaw,
      percent: parseBrNumber(percentRaw),
      value: parseBrNumber(percentRaw)
    };
    const normalized = normalizeRevenueCandidateRow(rowObject, rowIndex, kind, source);
    if (normalized) rows.push(normalized);
  });
  return rows;
}


function revenueKeyMatchesKind(key = '', kind = 'region') {
  const k = compactKey(key);
  if (!k) return false;
  if (kind === 'business') {
    return /(negocio|negocios|business|bussines|segment|segmento|segmentos|product|produto|produtos|activity|atividade|receitapornegocio|receitaspornegocio|revenuebybusiness|businessrevenue|revenuesegment|segmentrevenue|productrevenue|companybusiness|bussinessrevenue|salesbybusiness|salesbysegment|operatingsegment|segmentoperacional|linhanegocio|linhasdenegocio|linhaoperacional|businessline|businessunit|unidadeoperacional|atividadeeconomica|produtoseservicos)/i.test(k);
  }
  return /(regiao|regioes|region|regions|geograph|geography|geographic|geograf|geografia|geografica|country|countries|pais|paises|localidade|mercado|mercados|receitaporregiao|receitasporregiao|revenuebyregion|regionrevenue|revenuegeography|geographyrevenue|geographicrevenue|companyrevenueschartpie|salesbyregion|salesbycountry|revenuecountry|geographicarea|areageografica|geographicalarea|localidade|localidades|origemreceita|destinoreceita|mercadoreceita|revenuebylocation|salesbylocation)/i.test(k);
}

function revenueNodeLooksLikeKind(node = {}, kind = 'region') {
  if (!node || typeof node !== 'object') return false;
  const keys = Object.keys(node).map(compactKey);
  if (kind === 'business') {
    return keys.some(k => /(negocio|business|bussines|segmento|segment|produto|product|atividade|activity)/i.test(k));
  }
  return keys.some(k => /(regiao|region|geograph|country|pais|local)/i.test(k));
}

function revenueCandidateValuesFromNode(root, kind = 'region') {
  const out = [];
  const seen = new Set();
  const add = (value) => {
    if (value == null) return;
    if (typeof value === 'object') {
      if (seen.has(value)) return;
      seen.add(value);
    }
    out.push(value);
  };
  const walk = (node, depth = 0, keyHint = '') => {
    if (node == null || depth > 7) return;
    if (Array.isArray(node)) {
      const hintedArray = keyHint && (revenueKeyMatchesKind(keyHint, kind) || /^20\d{2}$/.test(String(keyHint)) || /^(?:payload|result|results|response|chart|chartData|data|items|rows|series|datasets|values|segments|anos|years)$/i.test(String(keyHint)));
      const typedArray = node.slice(0, 20).some(item => item && typeof item === 'object' && revenueNodeLooksLikeKind(item, kind));
      if (hintedArray || typedArray) add(node);
      node.slice(0, 80).forEach(item => walk(item, depth + 1, keyHint));
      return;
    }
    if (typeof node !== 'object') return;
    if (keyHint && revenueKeyMatchesKind(keyHint, kind)) add(node);
    if (revenueNodeLooksLikeKind(node, kind)) add(node);
    for (const [key, value] of Object.entries(node).slice(0, 160)) {
      if (revenueKeyMatchesKind(key, kind)) add(value);
      if (/^(?:payload|result|results|response|chart|chartData|data|items|rows|series|datasets|values|years|anos|periods|periodos)$/i.test(key) || /^20\d{2}$/.test(key) || revenueKeyMatchesKind(key, kind)) {
        walk(value, depth + 1, key);
      } else if (depth < 3 && typeof value === 'object') {
        // RESTs grandes do Investidor10 costumam aninhar dados em objetos sem nomes estáveis.
        walk(value, depth + 1, key);
      }
    }
  };
  walk(root, 0, '');
  return out;
}

function rowsFromRevenueCandidate(candidate, kind = 'region', source = 'Investidor10 distribuição de receitas API') {
  const expandedCandidates = [candidate, ...revenueCandidateValuesFromNode(candidate, kind)];
  const rows = [];
  for (const sourceCandidate of expandedCandidates) {
    const pairedRows = pairedRevenueRowsFromCandidate(sourceCandidate, kind, source);
    rows.push(
      ...indexedRevenueRowsFromCandidate(sourceCandidate, kind, source),
      ...chartJsRevenueRowsFromCandidate(sourceCandidate, kind, source),
      ...highchartsRevenueRowsFromCandidate(sourceCandidate, kind, source),
      ...objectMapRevenueRowsFromCandidate(sourceCandidate, kind, source),
      ...tupleRevenueRowsFromCandidate(sourceCandidate, kind, source),
      ...revenueRowsFromAmountSharesCandidate(sourceCandidate, kind, source),
      ...pairedRows
    );
  }
  const visited = new Set();
  const walk = (node, keyHint = '') => {
    if (!node) return;
    if (typeof node === 'object') {
      if (visited.has(node)) return;
      visited.add(node);
    }
    if (Array.isArray(node)) {
      node.forEach(item => walk(item, keyHint));
      return;
    }
    if (typeof node !== 'object') return;
    const direct = normalizeRevenueCandidateRow(node, rows.length, kind, source);
    if (direct) rows.push(direct);
    for (const [key, value] of Object.entries(node)) {
      if (['rows', 'items', 'data', 'values', 'series', 'datasets', 'children', 'pontos', 'pontosGrafico', 'chartData', 'payload', 'result', 'results', 'response', 'chart', 'anos', 'years', 'periods', 'periodos'].includes(key)
        || /^20\d{2}$/.test(key)
        || revenueKeyMatchesKind(key, kind)
        || revenueKeyMatchesKind(keyHint, kind)) {
        walk(value, key);
      }
    }
  };
  walk(candidate);
  const seen = new Set();
  const deduped = rows
    .filter(row => {
      if (!row || looksLikeInvalidStockRevenueLabel(row.label)) return false;
      const key = compactKey(row.label);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => Number(b.percent || 0) - Number(a.percent || 0))
    .slice(0, 12);
  const quality = stockRevenueRowsQuality(deduped, kind);
  return quality.accepted ? quality.rows : [];
}

function revenueTotalFromCandidate(candidate = {}) {
  const seen = new Set();
  const visit = (node, depth = 0) => {
    if (!node || typeof node !== 'object' || depth > 5) return null;
    if (seen.has(node)) return null;
    seen.add(node);
    if (Array.isArray(node)) {
      for (const item of node.slice(0, 50)) {
        const found = visit(item, depth + 1);
        if (found) return found;
      }
      return null;
    }
    const totalRaw = node.totalAmountDisplay || node.totalDisplay || node.totalValueDisplay || node.valorTotalDisplay || node.receitaTotalDisplay || node.revenueTotalDisplay || node.totalAmount || node.totalValue || node.valorTotal || node.receitaTotal || node.revenueTotal || node.total || '';
    const totalDisplay = cleanText(totalRaw || '');
    if (totalDisplay) {
      const totalAmount = parseRevenueAmountNumber(totalRaw) ?? compactMoneyFromDisplay(totalDisplay);
      return {
        totalLabel: node.totalLabel || node.total_label || 'Total (trimestral)',
        totalAmountDisplay: /R\$|bilh|milh|trilh|mi|bi/i.test(totalDisplay) ? totalDisplay : (Number.isFinite(Number(totalAmount)) ? formatRevenueMoneyAbbrev(totalAmount) : totalDisplay),
        totalAmount
      };
    }
    for (const value of Object.values(node).slice(0, 80)) {
      const found = visit(value, depth + 1);
      if (found) return found;
    }
    return null;
  };
  return visit(candidate, 0);
}

function sectionBetweenPlain(plain = '', startRe, endReList = []) {
  const start = plain.search(startRe);
  if (start < 0) return '';
  let section = plain.slice(start, start + 7000);
  const end = endReList.map(re => section.search(re)).filter(i => i > 300).sort((a, b) => a - b)[0];
  if (Number.isFinite(end)) section = section.slice(0, end);
  return section;
}

function stockRevenueSectionBetweenPlain(plain = '', startRe, endReList = []) {
  const start = plain.search(startRe);
  if (start < 0) return '';
  let section = plain.slice(start, start + 7000);
  const end = endReList.map(re => section.search(re)).filter(i => i > 24).sort((a, b) => a - b)[0];
  if (Number.isFinite(end)) section = section.slice(0, end);
  return section;
}

function buildStockRevenueBreakdownPayload({ html = '', canonical = {}, ticker = '', name = '' } = {}, kind = 'region') {
  const bodyPlain = htmlToPlainText(html);
  const searchablePlain = stockRevenueSearchableText(html);
  const plainCandidates = [bodyPlain, searchablePlain].filter(Boolean);
  const isRegion = kind === 'region';
  const title = isRegion
    ? `Regiões onde ${name || ticker || 'a empresa'} gera receita`
    : `Negócios que geram receita para ${name || ticker || 'a empresa'}`;
  const sectionFromPlain = (plain = '') => isRegion
    ? stockRevenueSectionBetweenPlain(plain, /REGI[ÕO]ES\s+ONDE\s+.*?GERA\s+RECEITA/i, [/NEG[ÓO]CIOS\s+QUE\s+GERAM/i, /POSI[ÇC][ÃA]O\s+ACION[ÁA]RIA/i, /Receitas\s+e\s+Lucros/i])
    : stockRevenueSectionBetweenPlain(plain, /NEG[ÓO]CIOS\s+QUE\s+GERAM\s+RECEITA/i, [/POSI[ÇC][ÃA]O\s+ACION[ÁA]RIA/i, /Receitas\s+e\s+Lucros/i, /LUCRO\s+X\s+COTA[ÇC][ÃA]O/i]);
  let section = '';
  let year = '';
  let rejectedItems = 0;
  let items = [];
  let total = { totalLabel: '', totalAmountDisplay: '—', totalAmount: null };
  for (const plain of plainCandidates) {
    const candidateSection = sectionFromPlain(plain);
    if (!candidateSection) continue;
    if (!section) section = candidateSection;
    const candidateYear = candidateSection.match(/\b(20\d{2})\b/)?.[1] || year || '';
    const candidateRows = parseStockRevenueRowsFromSection(candidateSection, candidateYear).filter(row => !looksLikeInvalidStockRevenueLabel(row.label));
    const htmlQuality = stockRevenueRowsQuality(candidateRows, kind);
    rejectedItems += htmlQuality.invalidCount;
    const candidateTotal = totalFromStockRevenueSection(candidateSection);
    if (candidateTotal.totalAmountDisplay && candidateTotal.totalAmountDisplay !== '—') total = candidateTotal;
    if (htmlQuality.accepted && htmlQuality.rows.length) {
      section = candidateSection;
      year = candidateYear;
      items = htmlQuality.rows;
      break;
    }
    if (!year) year = candidateYear;
  }

  const embedded = html ? extractInvestidor10StockEmbeddedAnalysisData(html) : {};
  const dedicatedRevenueSources = isRegion
    ? (Array.isArray(canonical?.rawJson?.revenueGeographySources) ? canonical.rawJson.revenueGeographySources : [])
    : (Array.isArray(canonical?.rawJson?.revenueSegmentSources) ? canonical.rawJson.revenueSegmentSources : []);
  const restSources = [
    canonical?.rawJson?.assetTickerRest,
    ...(Array.isArray(canonical?.rawJson?.assetTickerRestSources) ? canonical.rawJson.assetTickerRestSources : []),
    ...dedicatedRevenueSources,
    canonical?.assetTickerRest,
    ...(Array.isArray(canonical?.assetTickerRestSources) ? canonical.assetTickerRestSources : [])
  ].filter(Boolean);
  const restRevenueCandidates = restSources.flatMap(source => revenueCandidateValuesFromNode(source, kind));
  const canonicalCandidates = isRegion
    ? [canonical?.revenueRegion, canonical?.revenueGeography, canonical?.revenueByRegion, canonical?.regionRevenue, canonical?.geographicRevenue, canonical?.geographyRevenue, canonical?.regioesReceita, canonical?.regioesOndeGeraReceita, canonical?.receitaPorRegiao, canonical?.receitasPorRegiao, canonical?.revenueBreakdowns?.region, canonical?.revenueBreakdowns?.geography, canonical?.revenueBreakdowns?.byRegion, canonical?.embedded?.revenueGeography, canonical?.embedded?.revenueRegion, canonical?.embedded?.revenueByRegion, embedded?.revenueGeography, ...dedicatedRevenueSources, ...restRevenueCandidates]
    : [canonical?.revenueBusiness, canonical?.revenueSegment, canonical?.revenueByBusiness, canonical?.businessRevenue, canonical?.segmentRevenue, canonical?.productRevenue, canonical?.businessSegments, canonical?.businessBreakdown, canonical?.segmentBreakdown, canonical?.productBreakdown, canonical?.negociosReceita, canonical?.negociosQueGeramReceita, canonical?.receitaPorNegocio, canonical?.receitasPorNegocio, canonical?.produtosReceita, canonical?.receitaPorProduto, canonical?.revenueBreakdowns?.business, canonical?.revenueBreakdowns?.segment, canonical?.revenueBreakdowns?.byBusiness, canonical?.embedded?.revenueSegment, canonical?.embedded?.revenueBusiness, canonical?.embedded?.revenueByBusiness, canonical?.embedded?.businessRevenue, canonical?.embedded?.segmentRevenue, canonical?.embedded?.productRevenue, embedded?.revenueSegment, embedded?.businessRevenue, embedded?.segmentRevenue, embedded?.productRevenue, ...dedicatedRevenueSources, ...restRevenueCandidates];
  let canonicalTotal = null;
  let canonicalYear = '';
  if (!items.length) {
    for (const candidate of canonicalCandidates) {
      if (!candidate || (typeof candidate === 'object' && !Object.keys(candidate).length)) continue;
      const candidateRows = rowsFromRevenueCandidate(candidate, kind, 'Investidor10 distribuição de receitas API');
      if (candidateRows.length) {
        const quality = stockRevenueRowsQuality(candidateRows, kind);
        rejectedItems += quality.invalidCount;
        if (quality.accepted && quality.rows.length) {
          items = quality.rows;
          canonicalTotal = revenueTotalFromCandidate(candidate);
          canonicalYear = revenueYearFromCandidate(candidate) || canonicalYear;
          break;
        }
      }
      const jsonText = JSON.stringify(candidate || {});
      if (!jsonText || jsonText === '{}') continue;
      items = parseStockRevenueRowsFromSection(htmlToPlainText(jsonText), year);
      if (items.length) {
        const quality = stockRevenueRowsQuality(items, kind);
        rejectedItems += quality.invalidCount;
        if (quality.accepted && quality.rows.length) {
          items = quality.rows;
          canonicalTotal = revenueTotalFromCandidate(candidate);
          canonicalYear = revenueYearFromCandidate(candidate) || canonicalYear;
          break;
        }
        items = [];
      }
    }
  }
  let selectedYear = year || canonicalYear || 'Atual';
  let totalAmountDisplay = total.totalAmountDisplay && total.totalAmountDisplay !== '—' ? total.totalAmountDisplay : (canonicalTotal?.totalAmountDisplay || '—');
  let totalAmount = Number.isFinite(Number(total.totalAmount)) ? total.totalAmount : (canonicalTotal?.totalAmount ?? null);
  return {
    id: isRegion ? 'stock_revenue_by_region' : 'stock_revenue_by_business',
    title,
    status: items.length ? 'OK' : 'EMPTY',
    source: items.some(item => /API/i.test(item.source || '')) ? 'Investidor10 distribuição de receitas API' : 'Investidor10 distribuição de receitas',
    selectedYear,
    years: selectedYear && selectedYear !== 'Atual' ? [selectedYear] : [],
    totalLabel: total.totalLabel || 'Total (trimestral)',
    totalAmountDisplay,
    totalAmount,
    items,
    diagnostics: {
      rejectedItems,
      strictRevenueOnly: true
    }
  };
}


const STOCK_SHAREHOLDER_COLUMNS = Object.freeze([
  { key: 'shareholder', label: 'Acionista' },
  { key: 'onPercent', label: '% ON' },
  { key: 'pnPercent', label: '% PN' },
  { key: 'totalPercent', label: '% Total' }
]);


function shareholdingAliasValue(row = {}, aliases = []) {
  if (!row || typeof row !== 'object') return '';
  for (const alias of aliases) {
    if (Object.prototype.hasOwnProperty.call(row, alias) && row[alias] != null && row[alias] !== '') return row[alias];
  }
  const normalizedAliases = aliases.map(compactKey);
  for (const [key, value] of Object.entries(row)) {
    if (value == null || value === '') continue;
    const normalizedKey = compactKey(key);
    if (normalizedAliases.includes(normalizedKey)) return value;
  }
  return '';
}

function looksLikeInvalidShareholderLabel(label = '') {
  const raw = cleanText(label).replace(/\s+/g, ' ').trim();
  const normalized = compactKey(raw);
  if (!raw || raw.length < 2 || raw.length > 96) return true;
  if (/^(Acionista|Posi[çc][ãa]o acion[áa]ria|Total|% ON|% PN|% Total|ON|PN)$/i.test(raw)) return true;
  if (/^(P\/?L|P\/?VP|P\/?Receita|PSR|DY|ROE|ROIC|ROA|VPA|LPA|EV\/?Ebitda|EV\/?Ebit|P\/?Ebitda|P\/?Ebit|Dividend Yield|Payout|Margem.*|Liquidez.*|CAGR.*|Setor|Subsetor|Segmento|Valor(?:\s+de\s+Mercado)?|Cotação|Preço|Variação.*)$/i.test(raw)) return true;
  if (/\b(vou|vender|comprar|iniciante|dinheiro|comentarios?|comentários?|respostas?|enviar|carregar|press[- ]?release|divulgacao|divulgação|selic|duvida|dúvida|pergunta|alguem|alguém|nao consigo|não consigo|avise|banco safra|fii?s? de tijolo|quota|queda da|recuperacao|recuperação|carteira|recomenda(?:cao|ção)|dividendos?|proventos?|not[ií]cias?|rentabilidade|retorno|ibov|ifix|idiv|smll|cdi|ipca|pre[çc]o\s+teto|bazin|graham)\b/i.test(raw)) return true;
  if (/\b(P\/?VP|P\/?L|P\/?Receita|PSR|DY|ROE|ROIC|ROA|Dividend Yield|Payout|Margem|Ebitda|Ebit|CAGR|EV\/?Ebit|VPA|LPA|Liquidez|Cotação|Variação)\b/i.test(raw)) return true;
  if (/^\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}\b/.test(raw)) return true;
  if (/^(?:\d+\s+){2,}/.test(raw)) return true;
  if (/[!?]{1,}|(?:\.\.\.|…)/.test(raw)) return true;
  if (/https?:\/\/|www\.|@/.test(raw)) return true;
  if (!/[A-Za-zÀ-ÿ]/.test(raw)) return true;
  // Acionistas reais costumam ser nomes de pessoas jurídicas, pessoas ou buckets oficiais; frases corridas não.
  const words = raw.split(/\s+/).filter(Boolean);
  const lowerWords = words.filter(word => /^[a-záéíóúâêôãõàç]{3,}$/.test(word));
  if (words.length >= 5 && lowerWords.length / Math.max(1, words.length) > 0.55 && !/\b(S\.?A\.?|S\/?A|LTDA|LLC|INC|LTD|PLC|LP|BNDES|BNDESPAR|UNI[ÃA]O|FEDERAL|PREVI|PETROS|FUNCEF|BLACKROCK|VANGUARD|BANK|BANCO|CAIXA|OUTROS|CONTROLADOR(?:ES)?)\b/i.test(raw)) return true;
  return false;
}

function shareholdingFinitePercentCount(...values) {
  return values.map(parseBrNumber).filter(Number.isFinite).length;
}

function normalizeShareholdingRow(row = {}, index = 0, source = 'Investidor10 posição acionária') {
  const shareholder = cleanText(shareholdingAliasValue(row, [
    'shareholder', 'acionista', 'nomeAcionista', 'nome_acionista', 'investor', 'holder', 'titular',
    'nomeRazaoSocial', 'razaoSocial', 'razao_social', 'entityName', 'holderName', 'name', 'nome', 'label', 'title', 'Acionista'
  ]));
  if (looksLikeInvalidShareholderLabel(shareholder)) return null;
  const onDisplay = shareholdingAliasValue(row, [
    'onPercentDisplay', 'onDisplay', 'percentOnDisplay', '% ON', '%ON', 'ON', 'onPercent', 'percentOn', 'percent_on', 'on_percent',
    'participacaoOn', 'participacao_on', 'participationOn', 'participation_on', 'ordinarias', 'ordinariasPercent', 'ordinarias_percent', 'acoesOrdinarias', 'acoes_ordinarias', 'common', 'commonPercent', 'common_percent'
  ]);
  const pnDisplay = shareholdingAliasValue(row, [
    'pnPercentDisplay', 'pnDisplay', 'percentPnDisplay', '% PN', '%PN', 'PN', 'pnPercent', 'percentPn', 'percent_pn', 'pn_percent',
    'participacaoPn', 'participacao_pn', 'participationPn', 'participation_pn', 'preferenciais', 'preferenciaisPercent', 'preferenciais_percent', 'acoesPreferenciais', 'acoes_preferenciais', 'preferred', 'preferredPercent', 'preferred_percent'
  ]);
  const totalDisplay = shareholdingAliasValue(row, [
    'totalPercentDisplay', 'totalDisplay', 'percentTotalDisplay', '% Total', '%TOTAL', 'Total', 'totalPercent', 'percentTotal', 'percent_total', 'total_percent',
    'participacaoTotal', 'participacao_total', 'participationTotal', 'participacao', 'participation', 'participationPercent'
  ]);
  const onPercent = parseBrNumber(onDisplay);
  const pnPercent = parseBrNumber(pnDisplay);
  const totalPercent = parseBrNumber(totalDisplay);
  if (shareholdingFinitePercentCount(onDisplay, pnDisplay, totalDisplay) < 2) return null;
  const allValues = [onPercent, pnPercent, totalPercent].filter(Number.isFinite);
  if (allValues.some(value => value < 0 || value > 100)) return null;
  const pct = value => Number.isFinite(Number(value)) ? formatPercent(Number(value)).replace('+', '') : '—';
  return {
    id: `shareholder_${index}_${metricId(shareholder)}`,
    shareholder,
    onPercent: Number.isFinite(Number(onPercent)) ? round(Number(onPercent), 4) : null,
    onPercentDisplay: pct(onPercent),
    pnPercent: Number.isFinite(Number(pnPercent)) ? round(Number(pnPercent), 4) : null,
    pnPercentDisplay: pct(pnPercent),
    totalPercent: Number.isFinite(Number(totalPercent)) ? round(Number(totalPercent), 4) : null,
    totalPercentDisplay: pct(totalPercent),
    source
  };
}

function decodeJavascriptEscapedText(value = '') {
  let text = decodeHtmlEntities(String(value || ''));
  try { text = JSON.parse(`"${text.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r')}"`); } catch {}
  return String(text || '')
    .replace(/\\u([0-9a-f]{4})/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\\x([0-9a-f]{2})/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\\\//g, '/')
    .replace(/["'`{}\[\]:,]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeShareholdingParseSlice(section = '') {
  return decodeJavascriptEscapedText(section)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>(?=.)/gi, '\n')
    .replace(/<\/tr>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/Acionista\s*%?\s*ON\s*%?\s*PN\s*%?\s*Total/gi, '\n')
    .replace(/POSI[ÇC][ÃA]O\s+ACION[ÁA]RIA(?:\s+DA\s+[A-Z0-9]+)?/gi, '\n')
    .replace(/[\u00a0\t]+/g, ' ')
    .replace(/\s*[,;|]\s*/g, ' ; ')
    .replace(/\s+/g, ' ')
    .trim();
}

function pushUniqueShareholdingRow(rows, candidate) {
  if (!candidate) return;
  const key = compactKey(candidate.shareholder);
  if (!key || rows.some(row => compactKey(row.shareholder) === key)) return;
  rows.push(candidate);
}

function parseStockShareholdingRowsFromSection(section = '') {
  const rows = [];
  const normalized = normalizeShareholdingParseSlice(section);
  if (!normalized) return rows;
  const pct = String.raw`(?:-|—|[+-]?(?:\d{1,3}(?:[.,]\d{1,4})?|\d+)\s*%?)`;
  const parseCandidate = (label, onValue, pnValue, totalValue = '') => {
    if (shareholdingFinitePercentCount(onValue, pnValue, totalValue) < 2) return;
    const cleanLabel = cleanText(label)
      .replace(/^(?:Acionista|%\s*ON|%\s*PN|%\s*Total)\s*/i, '')
      .replace(/\b(?:ON|PN|Total)\b\s*$/i, '')
      .trim();
    const normalizedRow = normalizeShareholdingRow({
      shareholder: cleanLabel,
      onPercentDisplay: onValue,
      pnPercentDisplay: pnValue,
      totalPercentDisplay: totalValue
    }, rows.length, 'Investidor10 posição acionária');
    pushUniqueShareholdingRow(rows, normalizedRow);
  };

  const delimitedRe = new RegExp(String.raw`(?:^|\s;\s)\s*([A-ZÁÉÍÓÚÂÊÔÃÕÀÇ0-9][A-ZÁÉÍÓÚÂÊÔÃÕÀÇ0-9a-záéíóúâêôãõàç\s.&'’/()\-]{1,150}?)\s;\s(${pct})\s;\s(${pct})(?:\s;\s(${pct}))?(?=\s;\s[A-ZÁÉÍÓÚÂÊÔÃÕÀÇ0-9]|\s*$)`, 'g');
  for (const match of normalized.matchAll(delimitedRe)) parseCandidate(match[1], match[2], match[3], match[4] || '');

  if (!rows.length) {
    const spaced = normalized.replace(/\s;\s/g, ' ');
    const spacedRe = new RegExp(String.raw`([A-ZÁÉÍÓÚÂÊÔÃÕÀÇ0-9][A-ZÁÉÍÓÚÂÊÔÃÕÀÇ0-9a-záéíóúâêôãõàç\s.&'’/()\-]{1,150}?)\s+(${pct})\s+(${pct})(?:\s+(${pct}))?(?=\s+[A-ZÁÉÍÓÚÂÊÔÃÕÀÇ0-9]|\s*$)`, 'g');
    for (const match of spaced.matchAll(spacedRe)) parseCandidate(match[1], match[2], match[3], match[4] || '');
  }

  return rows.slice(0, 20);
}

function stockShareholdingHtmlSlice(html = '') {
  const source = String(html || '');
  if (!source) return '';
  const specificMatches = [
    ...source.matchAll(/posi(?:ç|c|&ccedil;)[ãa]o\s+acion(?:á|a|&aacute;)ria(?:\s+da\s+[A-Z0-9]+)?/gi),
    ...source.matchAll(/shareholding(?:Position|Chart|Table)?/gi),
    ...source.matchAll(/(?:posicaoAcionaria|posicao_acionaria|posiçãoAcionaria)/gi)
  ];
  const specificStart = specificMatches.length ? Math.min(...specificMatches.map(match => match.index ?? Number.MAX_SAFE_INTEGER)) : -1;
  if (specificStart < 0 && !/Acionista\s*%?\s*ON\s*%?\s*PN\s*%?\s*Total/i.test(source)) return '';
  const genericStart = specificStart >= 0 ? specificStart : source.search(/Acionista\s*%?\s*ON\s*%?\s*PN\s*%?\s*Total/i);
  if (genericStart < 0) return '';
  const tail = source.slice(genericStart);
  const endMatch = tail.slice(500).search(/<h[1-4][^>]*>\s*(?:Receitas\s+e\s+Lucros|LUCRO\s+X\s+COTA|Resultados|BALAN[ÇC]O|COMUNICADOS)|##\s*(?:Receitas\s+e\s+Lucros|LUCRO\s+X\s+COTA|Resultados)/i);
  const end = endMatch >= 0 ? 500 + endMatch : 80000;
  return tail.slice(0, Math.min(end, 80000));
}


function stockShareholdingPlainSlice(plain = '', ticker = '') {
  const text = String(plain || '').replace(/\s+/g, ' ');
  const symbol = String(ticker || '').toUpperCase();
  const startRe = symbol
    ? new RegExp(`POSI[ÇC][ÃA]O\s+ACION[ÁA]RIA\s+DA\s+${escapeRegExp(symbol)}|POSI[ÇC][ÃA]O\s+ACION[ÁA]RIA`, 'i')
    : /POSI[ÇC][ÃA]O\s+ACION[ÁA]RIA/i;
  const start = text.search(startRe);
  if (start < 0) return '';
  let section = text.slice(start, start + 3600);
  const end = section.slice(160).search(/Receitas\s+e\s+Lucros|LUCRO\s+X\s+COTA[ÇC][ÃA]O|Resultados\s+|EVOLU[ÇC][ÃA]O\s+DO\s+PATRIM[ÔO]NIO|BALAN[ÇC]O\s+PATRIMONIAL|COMUNICADOS|Not[íi]cias|Discuss[ãa]o/i);
  if (end >= 0) section = section.slice(0, 160 + end);
  return section;
}

function parseStockShareholdingRowsFromHtml(html = '') {
  const slice = stockShareholdingHtmlSlice(html);
  if (!slice) return [];
  const rows = [];
  const trRe = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
  for (const tr of slice.matchAll(trRe)) {
    const cells = [...tr[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)]
      .map(match => cleanText(match[1]).replace(/\s+/g, ' ').trim())
      .filter(Boolean);
    if (cells.length < 2) continue;
    const shareholder = cells[0];
    if (!shareholder || /^(Acionista|P\/L|P\/VP|ROE|DY|Valor|Margem|Ano|Data|%\s*ON|%\s*PN|%\s*Total)$/i.test(shareholder)) continue;
    const percentCells = cells.slice(1).filter(value => /(?:-|—|\d)/.test(value));
    if (!percentCells.length) continue;
    const normalized = normalizeShareholdingRow({
      shareholder,
      onPercentDisplay: percentCells[0] || '',
      pnPercentDisplay: percentCells[1] || '',
      totalPercentDisplay: percentCells[2] || ''
    }, rows.length, 'Investidor10 posição acionária HTML');
    pushUniqueShareholdingRow(rows, normalized);
  }
  if (!rows.length) {
    parseStockShareholdingRowsFromSection(slice).forEach(row => pushUniqueShareholdingRow(rows, { ...row, source: 'Investidor10 posição acionária HTML' }));
  }
  return rows.slice(0, 20);
}

function rowsFromShareholdingCandidate(candidate, source = 'Investidor10 posição acionária') {
  const rows = [];
  const shareholdingHeaderLabel = cell => {
    if (cell && typeof cell === 'object' && !Array.isArray(cell)) {
      return cleanText(cell.label || cell.title || cell.name || cell.text || cell.data || cell.field || cell.key || cell.value || cell.id || '');
    }
    return cleanText(cell);
  };
  const shareholdingHeaderDataKey = cell => {
    if (cell && typeof cell === 'object' && !Array.isArray(cell)) {
      return cleanText(cell.data || cell.field || cell.key || cell.name || cell.id || cell.label || cell.title || '');
    }
    return shareholdingHeaderLabel(cell);
  };
  const headerLooksLikeShareholding = header => {
    const labels = (header || []).map(shareholdingHeaderLabel).filter(Boolean);
    const joined = labels.join(' ').toLowerCase();
    return /acionista|shareholder|titular|holder/.test(joined)
      && /%?\s*on|ordin[áa]ria|common/.test(joined)
      && /%?\s*pn|preferencial|preferred/.test(joined)
      && /total|participa[cç][aã]o/.test(joined);
  };
  const keyLooksLikeShareholdingContainer = key => /^(?:shareholding|shareholdingPosition|shareholders|ownership|holderComposition|holder_position|acionistas|acionista|posicaoAcionaria|posicao_acionaria|posi[cç][aã]oAcionaria|composicaoAcionaria|composicao_acionaria|quadroAcionario|estruturaAcionaria)$/i.test(String(key || ''));
  const rowHasExplicitShareholdingKeys = node => {
    if (!node || typeof node !== 'object' || Array.isArray(node)) return false;
    const keys = Object.keys(node).map(compactKey).join(' ');
    const hasHolder = /shareholder|acionista|nomeacionista|holder|titular|investor|razaosocial|entityname|holdername/.test(keys);
    const hasOn = /onpercent|percenton|ordinarias|acoesordinarias|commonpercent/.test(keys);
    const hasPn = /pnpercent|percentpn|preferenciais|acoespreferenciais|preferredpercent/.test(keys);
    const hasTotal = /totalpercent|percenttotal|participacaototal|participationtotal|participationpercent/.test(keys);
    return hasHolder && ((hasOn && hasPn) || (hasOn && hasTotal) || (hasPn && hasTotal));
  };
  const rowFromHeader = (header = [], values = []) => {
    const obj = {};
    const readValue = (index, label, dataKey) => {
      if (Array.isArray(values)) return values[index];
      if (!values || typeof values !== 'object') return undefined;
      const directKeys = [String(index), index, dataKey, label, compactKey(dataKey), compactKey(label)].filter(key => key !== undefined && key !== null && String(key) !== '');
      for (const key of directKeys) {
        if (Object.prototype.hasOwnProperty.call(values, key)) return values[key];
      }
      for (const [key, value] of Object.entries(values)) {
        const normalizedKey = compactKey(key);
        if (normalizedKey === compactKey(dataKey) || normalizedKey === compactKey(label)) return value;
      }
      return undefined;
    };
    header.forEach((cell, index) => {
      const label = shareholdingHeaderLabel(cell) || `col_${index}`;
      const dataKey = shareholdingHeaderDataKey(cell) || label;
      obj[label] = readValue(index, label, dataKey);
      if (dataKey && dataKey !== label) obj[dataKey] = obj[label];
    });
    if (!obj.shareholder && values && typeof values === 'object' && !Array.isArray(values)) obj.shareholder = values['0'] ?? values[0] ?? values.shareholder ?? values.acionista;
    if (!obj.onPercentDisplay && values && typeof values === 'object' && !Array.isArray(values)) obj.onPercentDisplay = values['1'] ?? values[1] ?? values.onPercentDisplay ?? values.onPercent;
    if (!obj.pnPercentDisplay && values && typeof values === 'object' && !Array.isArray(values)) obj.pnPercentDisplay = values['2'] ?? values[2] ?? values.pnPercentDisplay ?? values.pnPercent;
    if (!obj.totalPercentDisplay && values && typeof values === 'object' && !Array.isArray(values)) obj.totalPercentDisplay = values['3'] ?? values[3] ?? values.totalPercentDisplay ?? values.totalPercent;
    return obj;
  };
  const walk = (node, inShareholdingScope = false) => {
    if (!node) return;
    if (Array.isArray(node)) {
      if (node.length >= 2 && Array.isArray(node[0]) && headerLooksLikeShareholding(node[0])) {
        const header = node[0];
        node.slice(1).forEach(item => {
          if (!Array.isArray(item)) return;
          const normalized = normalizeShareholdingRow(rowFromHeader(header, item), rows.length, source);
          if (normalized) rows.push(normalized);
        });
        return;
      }
      if (inShareholdingScope && node.every(item => item == null || typeof item !== 'object') && node.length >= 4) {
        const percentCells = node.slice(1);
        const normalized = normalizeShareholdingRow({
          shareholder: node[0],
          onPercentDisplay: percentCells[0] || '',
          pnPercentDisplay: percentCells[1] || '',
          totalPercentDisplay: percentCells[2] || ''
        }, rows.length, source);
        if (normalized) rows.push(normalized);
        return;
      }
      node.forEach(item => walk(item, inShareholdingScope));
      return;
    }
    if (typeof node === 'string') {
      if (!inShareholdingScope && !/Acionista\s*%?\s*ON\s*%?\s*PN\s*%?\s*Total|POSI[ÇC][ÃA]O\s+ACION[ÁA]RIA/i.test(node)) return;
      parseStockShareholdingRowsFromSection(decodeJavascriptEscapedText(node)).forEach(row => rows.push({ ...row, source }));
      return;
    }
    if (typeof node !== 'object') return;
    const header = node.columns || node.headers || node.cabecalho || node.header;
    const dataRows = node.rows || node.items || node.data || node.values || node.valores || node.acionistas || node.shareholders || node.ownership || node.posicaoAcionaria;
    const tableScope = Array.isArray(header) && Array.isArray(dataRows) && headerLooksLikeShareholding(header);
    if (tableScope) {
      dataRows.forEach(item => {
        const normalized = normalizeShareholdingRow(rowFromHeader(header, item), rows.length, source);
        if (normalized) rows.push(normalized);
      });
      return;
    }
    if (inShareholdingScope || rowHasExplicitShareholdingKeys(node)) {
      const direct = normalizeShareholdingRow(node, rows.length, source);
      if (direct) rows.push(direct);
    }
    for (const [key, value] of Object.entries(node)) {
      const nextScope = inShareholdingScope || keyLooksLikeShareholdingContainer(key);
      if (!nextScope && !Array.isArray(value)) continue;
      if (!nextScope && Array.isArray(value) && !(value.length >= 2 && Array.isArray(value[0]) && headerLooksLikeShareholding(value[0]))) continue;
      walk(value, nextScope);
    }
  };
  walk(candidate, false);
  const seen = new Set();
  return rows.filter(row => {
    const key = compactKey(row.shareholder);
    if (!key || seen.has(key) || looksLikeInvalidShareholderLabel(row.shareholder)) return false;
    seen.add(key);
    return shareholdingFinitePercentCount(row.onPercentDisplay, row.pnPercentDisplay, row.totalPercentDisplay) >= 2;
  }).slice(0, 20);
}

function extractStockShareholdingJsonCandidatesFromHtml(html = '') {
  const source = String(html || '');
  const candidates = [];
  if (!source) return candidates;
  for (const script of source.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) {
    const body = script[1] || '';
    if (!/(acionista|acionaria|acionária|shareholder|shareholding|%\s*ON|%\s*PN)/i.test(body)) continue;
    const decoded = decodeJavascriptEscapedText(body);
    const parsedRows = parseStockShareholdingRowsFromSection(decoded);
    if (parsedRows.length) candidates.push(parsedRows);
    const jsonLike = body.match(/(?:posicaoAcionaria|posiçãoAcionaria|acionistas|shareholders|shareholding)\s*[:=]\s*([\[{][\s\S]{0,80000}?[\]}])/i)?.[1];
    const parsed = jsonLike ? parseInvestidor10InlineJsonLiteral(jsonLike) : null;
    if (parsed) candidates.push(parsed);
  }
  return candidates;
}

function buildStockShareholdingPayload({ html = '', canonical = {}, ticker = '', raw = null } = {}) {
  const symbol = String(ticker || '').toUpperCase();
  const plain = htmlToPlainText(html);
  const section = sectionBetweenPlain(plain, /POSI[ÇC][ÃA]O\s+ACION[ÁA]RIA\s+DA\s+[A-Z0-9]+|POSI[ÇC][ÃA]O\s+ACION[ÁA]RIA/i, [/Receitas\s+e\s+Lucros/i, /LUCRO\s+X\s+COTA[ÇC][ÃA]O/i, /Resultados\s+/i, /EVOLU[ÇC][ÃA]O\s+DO\s+PATRIM[ÔO]NIO/i, /BALAN[ÇC]O\s+PATRIMONIAL/i, /COMUNICADOS/i, /Discuss[ãa]o/i]);
  const plainSection = stockShareholdingPlainSlice(plain, symbol);
  let rows = parseStockShareholdingRowsFromHtml(html);
  if (!rows.length) rows = parseStockShareholdingRowsFromSection(plainSection || section);
  const rawCandidates = Array.isArray(raw) ? raw : (raw ? [raw] : []);
  const canonicalCandidates = [
    ...rawCandidates,
    canonical?.ownership,
    canonical?.shareholders,
    canonical?.company?.ownership,
    canonical?.company?.shareholders,
    canonical?.company?.posicaoAcionaria,
    canonical?.posicaoAcionaria,
    canonical?.acionistas,
    canonical?.embedded?.shareholding,
    canonical?.rawJson?.assetTickerRest,
    ...(Array.isArray(canonical?.rawJson?.assetTickerRestSources) ? canonical.rawJson.assetTickerRestSources : []),
    canonical?.rawJson?.shareholdingPosition,
    ...(Array.isArray(canonical?.rawJson?.shareholdingSources) ? canonical.rawJson.shareholdingSources : []),
    ...extractStockShareholdingJsonCandidatesFromHtml(html)
  ];
  if (!rows.length) {
    for (const candidate of canonicalCandidates) {
      rows = rowsFromShareholdingCandidate(candidate, 'Investidor10 posição acionária');
      if (rows.length) break;
    }
  }
  const strictRows = rows.filter(row => row && !looksLikeInvalidShareholderLabel(row.shareholder));
  return {
    id: 'stock_shareholding_position',
    title: symbol ? `Posição acionária da ${symbol}` : 'Posição acionária',
    status: strictRows.length ? 'OK' : 'EMPTY',
    source: 'Investidor10 posição acionária',
    columns: STOCK_SHAREHOLDER_COLUMNS,
    rows: strictRows,
    diagnostics: {
      parsedRows: strictRows.length,
      discardedRows: Math.max(0, rows.length - strictRows.length),
      sourceCandidates: canonicalCandidates.filter(Boolean).length,
      policy: 'strict_scoped_section_or_shareholding_json_only_no_full_page_fallback'
    }
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

function stockAnnouncementKindFromUrl(url = '') {
  const clean = String(url || '');
  return /\.pdf(?:$|[?#])/i.test(clean)
    || /\/link_comunicado\//i.test(clean)
    || /downloadDocumento|download-documento|arquivo=.*pdf|file=.*pdf|documento/i.test(clean)
    ? 'pdf'
    : 'external';
}

function normalizeStockAnnouncementTitle(value = '', fallback = 'Comunicado') {
  return cleanText(value)
    .replace(/Data\s+de\s+Divulga(?:ç|c)[ãa]o\s*:?\s*\d{2}\/\d{2}\/\d{4}/gi, ' ')
    .replace(/\bABRIR\b/gi, ' ')
    .replace(/\bopen_in_new\b/gi, ' ')
    .replace(/\bPDF\b\s*$/gi, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim() || fallback;
}

function normalizeStockAnnouncementType(title = '', explicitType = '') {
  const cleanType = cleanText(explicitType);
  if (cleanType) return cleanType;
  const text = cleanText(title);
  const afterDash = text.match(/[-–—]\s*([^–—-]{3,90})$/)?.[1];
  if (afterDash) return cleanText(afterDash);
  if (/fato/i.test(text)) return 'Fatos Relevantes';
  if (/aviso/i.test(text)) return 'Aviso';
  if (/reuni[aã]o|administra/i.test(text)) return 'Reunião da Administração';
  if (/debentur/i.test(text)) return 'Debenturistas';
  if (/comunicado/i.test(text)) return 'Comunicado ao Mercado';
  return 'Comunicado';
}

function closestHtmlRowForStockAnnouncement(sectionHtml = '', anchorStart = 0, anchorEnd = anchorStart) {
  const before = sectionHtml.slice(0, anchorStart);
  const lowerBefore = before.toLowerCase();
  const candidates = ['<tr', '<li', '<article', '<div', '<p'];
  let rowStart = -1;
  for (const tag of candidates) {
    const idx = lowerBefore.lastIndexOf(tag);
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
  const rowEnd = closeOffset >= 0 ? anchorEnd + closeOffset : Math.min(sectionHtml.length, anchorEnd + 520);
  return sectionHtml.slice(rowStart, rowEnd);
}

function findStockAnnouncementsHtmlSection(html = '', ticker = '') {
  const source = String(html || '');
  if (!source) return '';
  const symbol = String(ticker || '').toUpperCase();
  const plain = htmlToPlainText(source);
  const headingRe = symbol
    ? new RegExp(`COMUNICADOS\\s+DO\\s+${escapeRegExp(symbol)}|COMUNICADOS`, 'i')
    : /COMUNICADOS/i;
  const plainStart = plain.search(headingRe);
  if (plainStart < 0) return '';
  const lower = source.toLowerCase();
  const headingCandidates = [
    lower.search(/comunicados\s+do\s+[a-z]{4}\d{1,2}/i),
    lower.indexOf('comunicados')
  ].filter(idx => idx >= 0);
  const htmlStart = headingCandidates.length ? Math.min(...headingCandidates) : 0;
  const tail = source.slice(htmlStart, htmlStart + 26000);
  const lowerTail = tail.toLowerCase();
  const stopPatterns = [
    /<h[1-6][^>]*>\s*(?:not[ií]cias|d[uú]vidas|discuss[aã]o|compare|avalie|ranking)/i,
    /not[ií]cias\s+sobre/i,
    /d[uú]vidas\s+comuns/i,
    /discuss[aã]o/i,
    /copyright/i
  ];
  let end = tail.length;
  for (const re of stopPatterns) {
    const match = lowerTail.match(re);
    if (match?.index && match.index > 80 && match.index < end) end = match.index;
  }
  return tail.slice(0, end);
}

function stockAnnouncementFromRow({ rowText = '', href = '', anchorText = '', ticker = '', index = 0, baseUrl = '' } = {}) {
  const symbol = String(ticker || '').toUpperCase();
  const cleanAnchor = normalizeStockAnnouncementTitle(anchorText || '', '');
  const rawRow = cleanText(rowText || '');
  const cleanRow = normalizeStockAnnouncementTitle(rowText || '', '');
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
  const documentKind = stockAnnouncementKindFromUrl(url);
  const title = normalizeStockAnnouncementTitle(titleCandidate, dateDisplay ? `Comunicado de ${dateDisplay}` : `Comunicado ${index + 1}`);
  const type = normalizeStockAnnouncementType(title);
  if (!title && !url) return null;
  return {
    id: `${symbol || 'stock'}_announcement_${index + 1}`.toLowerCase(),
    title,
    type,
    date: dateDisplay,
    dateDisplay: dateDisplay || '—',
    url: url || undefined,
    documentUrl: url || undefined,
    pdfUrl: documentKind === 'pdf' ? url : undefined,
    documentKind,
    buttonLabel: documentKind === 'pdf' ? 'Abrir PDF' : 'Abrir',
    source: 'Investidor10 comunicados de ações'
  };
}

function emptyStockAnnouncements(ticker = '', diagnostics = {}) {
  const symbol = String(ticker || '').toUpperCase();
  return {
    id: 'stock_announcements',
    title: symbol ? `Comunicados do ${symbol}` : 'Comunicados da ação',
    status: 'EMPTY',
    source: 'Investidor10',
    sourceUrl: symbol ? `https://investidor10.com.br/acoes/${symbol.toLowerCase()}/` : undefined,
    ticker: symbol,
    items: [],
    pagination: { page: 1, pageSize: 5, hasPrevious: false, hasNext: false },
    diagnostics
  };
}

function extractInvestidor10StockAnnouncements(html = '', ticker = '', sourceUrl = '') {
  const symbol = String(ticker || '').toUpperCase();
  const baseUrl = sourceUrl || (symbol ? `https://investidor10.com.br/acoes/${symbol.toLowerCase()}/` : 'https://investidor10.com.br/');
  const foundSectionHtml = findStockAnnouncementsHtmlSection(html, symbol);
  const wholeDocumentLooksLikeAnnouncements = /Data\s+de\s+Divulga(?:ç|c)[ãa]o|link_comunicado|COMUNICADOS|Fatos\s+Relevantes|Aviso\s+aos\s+Acionistas/i.test(String(html || ''));
  const sectionHtml = foundSectionHtml || (wholeDocumentLooksLikeAnnouncements ? String(html || '') : '');
  if (!sectionHtml) return emptyStockAnnouncements(symbol, { found: false, reason: 'section_not_found' });
  const items = [];
  const anchorRe = /<a\b([^>]*?)href=["']([^"']+)["']([^>]*)>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = anchorRe.exec(sectionHtml))) {
    const href = match[2] || '';
    const anchorText = htmlToPlainText(match[4] || '');
    const rowHtml = closestHtmlRowForStockAnnouncement(sectionHtml, match.index, anchorRe.lastIndex);
    const rowText = htmlToPlainText(rowHtml);
    if (!/abrir|pdf|comunicado|fato|aviso|relat[oó]rio|assembleia|administra|debentur|link_comunicado/i.test(`${anchorText} ${rowText} ${href}`)) continue;
    const item = stockAnnouncementFromRow({ rowText, href, anchorText, ticker: symbol, index: items.length, baseUrl });
    if (item?.title && !items.some(existing => (existing.url && existing.url === item.url) || (existing.title === item.title && existing.dateDisplay === item.dateDisplay))) {
      items.push(item);
    }
  }
  if (!items.length) {
    const text = htmlToPlainText(sectionHtml).replace(/\s+/g, ' ');
    const rowRe = /([^\n\r]{4,180}?)\s+Data\s+de\s+Divulga(?:ç|c)[ãa]o\s*:?\s*(\d{2}\/\d{2}\/\d{4})(?:\s+ABRIR)?/gi;
    let textMatch;
    while ((textMatch = rowRe.exec(text))) {
      const title = normalizeStockAnnouncementTitle(textMatch[1] || '', 'Comunicado');
      if (!title || /COMUNICADOS/i.test(title)) continue;
      const item = stockAnnouncementFromRow({ rowText: `${title} Data de Divulgação: ${textMatch[2]} ABRIR`, href: '', anchorText: title, ticker: symbol, index: items.length, baseUrl });
      if (item) items.push(item);
    }
  }
  return {
    id: 'stock_announcements',
    title: symbol ? `Comunicados do ${symbol}` : 'Comunicados da ação',
    status: items.length ? 'OK' : 'EMPTY',
    source: 'Investidor10',
    sourceUrl: baseUrl,
    ticker: symbol,
    items: items.slice(0, 60),
    pagination: { page: 1, pageSize: 5, hasPrevious: false, hasNext: items.length > 5 },
    diagnostics: { found: true, linksFound: items.filter(item => item.url).length, pdfLinksFound: items.filter(item => item.pdfUrl).length, totalItems: items.length }
  };
}

function mergeStockAnnouncementsPayloads(...payloads) {
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
      merged.push({ ...item, id: `${symbol || 'stock'}_announcement_${merged.length + 1}`.toLowerCase() });
    }
  }
  return {
    id: 'stock_announcements',
    title: symbol ? `Comunicados do ${symbol}` : 'Comunicados da ação',
    status: merged.length ? 'OK' : 'EMPTY',
    source: 'Investidor10',
    sourceUrl: base?.sourceUrl || (symbol ? `https://investidor10.com.br/acoes/${symbol.toLowerCase()}/` : undefined),
    ticker: symbol,
    items: merged.slice(0, 80),
    pagination: { page: 1, pageSize: 5, hasPrevious: false, hasNext: merged.length > 5 },
    diagnostics: { mergedPayloads: validPayloads.length, totalItems: merged.length, linksFound: merged.filter(item => item.url).length, pdfLinksFound: merged.filter(item => item.pdfUrl).length, sources: validPayloads.map(payload => payload?.diagnostics?.parsedFrom || payload?.sourceUrl || payload?.diagnostics?.reason || 'main_page') }
  };
}

async function fetchInvestidor10StockAnnouncementsPages(ticker, { timeoutMs = 4500, maxPages = 3 } = {}) {
  const symbol = String(ticker || '').toUpperCase();
  if (!symbol) return emptyStockAnnouncements(symbol, { reason: 'ticker_missing' });
  const pages = Array.from({ length: Math.max(1, Math.min(5, Number(maxPages) || 3)) }, (_, index) => index + 1);
  const payloads = (await Promise.all(pages.map(async page => {
    const url = `https://investidor10.com.br/communications/ticker/${symbol}/?page=${page}`;
    try {
      const response = await fetchText(url, {
        timeoutMs: Math.min(2600, Math.max(1100, Number(timeoutMs) || 2600)),
        ttlMs: 15 * 60 * 1000,
        staleMs: 24 * 60 * 60 * 1000,
        retries: 0,
        headers: { Accept: 'text/html,application/xhtml+xml,*/*;q=0.8', Referer: `https://investidor10.com.br/acoes/${symbol.toLowerCase()}/` }
      });
      const html = response?.text || '';
      if (!html) return null;
      const payload = extractInvestidor10StockAnnouncements(html, symbol, url);
      if (payload?.items?.length) return { ...payload, sourceUrl: url, diagnostics: { ...(payload.diagnostics || {}), parsedFrom: 'communications_route', page, status: response?.status, cacheStatus: response?.cacheStatus } };
    } catch {
      // A rota paginada de comunicados é complementar; a página principal segue como fonte base.
    }
    return null;
  }))).filter(Boolean);
  return payloads.length ? mergeStockAnnouncementsPayloads(...payloads) : emptyStockAnnouncements(symbol, { reason: 'communications_route_empty' });
}

function extractPdfUrlFromStockAnnouncementDocument(html = '', baseUrl = '') {
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

async function enrichInvestidor10StockAnnouncementPdfLinks(payload, { timeoutMs = 4500 } = {}) {
  if (!payload?.items?.length) return payload;
  const items = payload.items.slice();
  const candidates = [];
  for (let index = 0; index < Math.min(items.length, 8); index += 1) {
    const item = items[index];
    const url = item?.url || item?.documentUrl;
    if (!url || item.pdfUrl || /\.pdf(?:$|[?#])/i.test(url)) continue;
    if (!/investidor10\.com\.br|fnet\.b3\.com\.br|cvm\.gov\.br|sistemas\.cvm\.gov\.br/i.test(url)) continue;
    candidates.push({ index, item, url });
  }
  const results = await Promise.all(candidates.map(async ({ index, item, url }) => {
    try {
      const response = await fetchText(url, {
        timeoutMs: Math.min(2200, Math.max(1000, Number(timeoutMs) || 2200)),
        ttlMs: 30 * 60 * 1000,
        staleMs: 24 * 60 * 60 * 1000,
        retries: 0,
        headers: { Accept: 'text/html,application/xhtml+xml,application/pdf;q=0.9,*/*;q=0.8', Referer: payload.sourceUrl || 'https://investidor10.com.br/' }
      });
      const finalUrl = response?.finalUrl || url;
      const contentType = String(response?.contentType || '').toLowerCase();
      const finalKind = stockAnnouncementKindFromUrl(finalUrl);
      const isPdfResponse = finalKind === 'pdf' || /application\/pdf|octet-stream|documento|download/i.test(contentType);
      const pdfUrl = isPdfResponse ? safeAbsoluteHttpUrl(finalUrl, url) : extractPdfUrlFromStockAnnouncementDocument(response?.text || '', finalUrl || url);
      if (pdfUrl) return { index, resolved: true, item: { ...item, pdfUrl, documentUrl: pdfUrl, documentKind: 'pdf', buttonLabel: 'Abrir PDF' } };
      if (item.documentKind === 'pdf') return { index, resolved: false, item: { ...item, pdfUrl: item.pdfUrl || item.documentUrl || item.url, documentUrl: item.documentUrl || item.url, buttonLabel: 'Abrir PDF' } };
    } catch {
      // Mantém link oficial se a página intermediária não puder ser resolvida dentro do orçamento do modal.
    }
    return { index, resolved: false, item };
  }));
  let resolved = 0;
  for (const result of results) {
    if (result?.item) items[result.index] = result.item;
    if (result?.resolved) resolved += 1;
  }
  return { ...payload, items, diagnostics: { ...(payload.diagnostics || {}), pdfResolvedFromIntermediatePages: resolved, pdfLinksFound: items.filter(item => item.pdfUrl).length, pdfResolutionStrategy: 'parallel_top_8_v300' } };
}

async function buildStockAnnouncementsPayload({ ticker, html, timeoutMs = 4500 } = {}) {
  const symbol = String(ticker || '').toUpperCase();
  const main = extractInvestidor10StockAnnouncements(html || '', symbol);
  const route = await fetchInvestidor10StockAnnouncementsPages(symbol, { timeoutMs, maxPages: 3 }).catch(error => emptyStockAnnouncements(symbol, { reason: 'route_error', error: error?.message || String(error) }));
  return enrichInvestidor10StockAnnouncementPdfLinks(mergeStockAnnouncementsPayloads(main, route), { timeoutMs });
}


function parseJsonMaybe(text = '') {
  try { return JSON.parse(String(text || '')); } catch { return null; }
}

function extractBalancedLiteralAfter(source = '', startIndex = -1) {
  if (startIndex < 0) return '';
  const text = String(source || '');
  const openIndex = text.slice(startIndex).search(/[\[{]/);
  if (openIndex < 0) return '';
  const absStart = startIndex + openIndex;
  const open = text[absStart];
  const close = open === '{' ? '}' : ']';
  let depth = 0;
  let quote = '';
  let escaped = false;
  for (let i = absStart; i < Math.min(text.length, absStart + 220000); i += 1) {
    const ch = text[i];
    if (quote) {
      if (escaped) { escaped = false; continue; }
      if (ch === '\\') { escaped = true; continue; }
      if (ch === quote) quote = '';
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') { quote = ch; continue; }
    if (ch === open) depth += 1;
    if (ch === close) {
      depth -= 1;
      if (depth === 0) return text.slice(absStart, i + 1);
    }
  }
  return '';
}

function normalizeJsLikeJsonLiteral(raw = '') {
  let s = String(raw || '').trim();
  if (!s) return '';
  if (s.endsWith(';')) s = s.slice(0, -1).trim();
  s = s
    .replace(/\\\//g, '/')
    .replace(/\\u0026/g, '&')
    .replace(/\\u003d/g, '=')
    .replace(/\\u002f/gi, '/')
    .replace(/\bundefined\b/g, 'null')
    .replace(/\bNaN\b/g, 'null')
    .replace(/\bInfinity\b/g, 'null')
    .replace(/,\s*([}\]])/g, '$1');
  s = s.replace(/([{,]\s*)([A-Za-z_$][\w$-]*)(\s*:)/g, '$1"$2"$3');
  s = s.replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, (_, inner) => JSON.stringify(String(inner).replace(/\\'/g, "'")));
  return s;
}

function parseInvestidor10InlineJsonLiteral(literal = '') {
  const raw = decodeHtmlEntities(String(literal || '').trim())
    .replace(/\\\//g, '/')
    .replace(/\\u0026/g, '&')
    .replace(/\\u003d/g, '=')
    .replace(/\\u002f/gi, '/');
  if (!raw) return null;
  const direct = parseJsonMaybe(raw);
  if (direct) return direct;
  // Alguns blocos do Investidor10 aparecem em JSON dentro de strings, data attributes
  // ou como objeto JS (chaves sem aspas/strings com aspas simples). Não executamos JS:
  // apenas normalizamos literais seguros para JSON.
  const unwrapped = raw.replace(/^['"`]([\s\S]*)['"`]$/m, '$1');
  const unwrappedParsed = parseJsonMaybe(unwrapped);
  if (unwrappedParsed) return unwrappedParsed;
  const normalized = normalizeJsLikeJsonLiteral(unwrapped);
  return parseJsonMaybe(normalized);
}

function extractInvestidor10InlinePayload(html = '', names = []) {
  const source = String(html || '');
  for (const name of names) {
    const escaped = escapeRegExp(name);
    const jsonParseRe = new RegExp(`${escaped}\\s*=\\s*JSON\\.parse\\(\\s*([\"'\`])([\\s\\S]{0,220000}?)\\1\\s*\\)`, 'i');
    const parsedLiteral = source.match(jsonParseRe)?.[2];
    if (parsedLiteral) {
      const parsed = parseInvestidor10InlineJsonLiteral(`"${parsedLiteral}"`);
      if (parsed) return parsed;
    }
    const re = new RegExp(`(?:const|let|var|window\\.)?\\s*${escaped}\\s*[:=]`, 'gi');
    let match;
    while ((match = re.exec(source))) {
      const literal = extractBalancedLiteralAfter(source, match.index + match[0].length);
      const parsed = parseInvestidor10InlineJsonLiteral(literal);
      if (parsed) return parsed;
    }
    const attrRe = new RegExp(`data-(?:chart|json|payload|value|series)-${escaped.replace(/_/g, '[-_]')}=["']([^"']+)["']`, 'i');
    const attr = source.match(attrRe)?.[1];
    if (attr) {
      const parsed = parseInvestidor10InlineJsonLiteral(attr);
      if (parsed) return parsed;
    }
  }
  return null;
}


function extractInvestidor10RevenueChartFromSection(html = '', kind = 'region') {
  const source = String(html || '');
  const headingRe = kind === 'business'
    ? /<h[1-6][^>]*>\s*[^<]*(?:neg[oó]cios|segmentos|produtos)[^<]*(?:receita|receitas)[^<]*<\/h[1-6]>/i
    : /<h[1-6][^>]*>\s*[^<]*(?:regi[oõ]es|geografia|mercados|pa[ií]ses)[^<]*(?:receita|receitas)[^<]*<\/h[1-6]>/i;
  const start = source.search(headingRe);
  if (start < 0) return null;
  const rest = source.slice(start, start + 180000);
  const next = rest.slice(1000).search(/<h[1-6][^>]*>/i);
  const section = next > 0 ? rest.slice(0, next + 1000) : rest;
  const callRe = /(Highcharts\.chart|new\s+ApexCharts|new\s+Chart|Chart)\s*\(/gi;
  let match;
  while ((match = callRe.exec(section))) {
    const firstObjectIndex = section.indexOf('{', match.index);
    if (firstObjectIndex < 0) continue;
    const literal = extractBalancedLiteralAfter(section, firstObjectIndex);
    const parsed = parseInvestidor10InlineJsonLiteral(literal);
    if (parsed && rowsFromRevenueCandidate(parsed, kind).length) return parsed;
  }
  const dataAttr = section.match(/data-(?:chart|series|payload|json)=['"]([^'"]{20,220000})['"]/i)?.[1];
  if (dataAttr) {
    const parsed = parseInvestidor10InlineJsonLiteral(dataAttr);
    if (parsed && rowsFromRevenueCandidate(parsed, kind).length) return parsed;
  }
  return null;
}

function extractInvestidor10StockEmbeddedAnalysisData(html = '') {
  return {
    revenueGeography: extractInvestidor10InlinePayload(html, [
      'companyRevenuesChartPie',
      'companyRevenueChartPie',
      'companyGeographicRevenuesChartPie',
      'companyGeographyRevenuesChartPie',
      'companyRevenuesByRegionChartPie',
      'companyRevenuesByGeographyChartPie',
      'revenueGeography',
      'revenueByRegion',
      'regioesReceita'
    ]) || extractInvestidor10RevenueChartFromSection(html, 'region'),
    revenueSegment: extractInvestidor10InlinePayload(html, [
      'companyBussinesRevenuesChartPie',
      'companyBussinessRevenuesChartPie',
      'companyBusinessRevenuesChartPie',
      'companyBusinessRevenueChartPie',
      'companyBussinesRevenueChartPie',
      'companyBussinessRevenueChartPie',
      'companyBusinessRevenueChart',
      'companyBusinessRevenuesChart',
      'companyRevenuesByBusinessChartPie',
      'companyRevenuesBySegmentChartPie',
      'companyRevenuesByProductChartPie',
      'businessRevenuesChartPie',
      'bussinesRevenuesChartPie',
      'revenueSegment',
      'revenueByBusiness',
      'businessRevenue',
      'segmentRevenue',
      'productRevenue',
      'negociosReceita',
      'negociosQueGeramReceita',
      'receitaPorNegocio',
      'receitasPorNegocio'
    ]) || extractInvestidor10RevenueChartFromSection(html, 'business'),
    shareholding: extractInvestidor10InlinePayload(html, [
      'companyShareholders',
      'companyShareholding',
      'shareholdersChart',
      'shareholdingChart',
      'posicaoAcionaria',
      'acionistas'
    ])
  };
}

function stockI10ApiKeyFromUrl(url = '') {
  const clean = String(url || '').toLowerCase();
  if (/receitaliquida\/chart/i.test(clean)) return 'receitasLucros';
  if (/cotacao-lucro/i.test(clean)) return 'lucroCotacao';
  if (/(?:ativospassivos\/table|balancopatrimonial|patrimonial\/table)/i.test(clean)) return 'balanceSheetTable';
  if (/ativospassivos\/chart/i.test(clean)) return 'evolucaoPatrimonio';
  if (/resultado\/chart/i.test(clean)) return 'resultadoDre';
  if (/fluxocaixa\/chart/i.test(clean)) return 'fluxoCaixa';
  if (/api\/rest\/assets\/tickers/i.test(clean)) return 'assetTickerRest';
  if (/(?:balancos\/indicadores\/(?:chart|table)|historico-indicadores|hist[oó]rico-indicadores|indicadores-fundamentalistas)/i.test(clean)) return 'historicoIndicadores';
  if (/payout-chart/i.test(clean)) return 'payoutHistorico';
  if (/(?:regi[aã]o.*receita|regioes?.*receita|receita.*regi[aã]o|receita.*regioes?|geograph|geography|geografia|geografica|localidade|localidades|mercado|mercados|country|countries|pais|paises|region-revenue|revenue-region|revenue-geography|receitas-por-regiao|receitas-por-localidade|sales-by-region|sales-by-country|revenue-by-region|revenue-by-location)/i.test(clean)) return 'revenueGeography';
  if (/(?:neg[oó]cio.*receita|negocios?.*receita|receita.*neg[oó]cio|receita.*negocios?|business-revenue|revenue-business|businesses-revenue|segmentos?.*receita|receita.*segmentos?|produtos?.*receita|receita.*produtos?|revenue-segment|segment-revenue|product-revenue|revenue-by-business|revenue-by-segment|revenue-by-product|sales-by-business|sales-by-segment|operating-segment)/i.test(clean)) return 'revenueSegment';
  if (/(?:posicao-acionaria|posicao_acionaria|posi[cç][aã]o-acion[áa]ria|acionistas|shareholders|shareholding|ownership)/i.test(clean)) return 'shareholdingPosition';
  const suffix = String(url).split('/api/')[1] || 'chart';
  return `i10Api_${suffix.replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 70)}`;
}

function extractInvestidor10StockIdsFromPayload(payload, ticker = '') {
  const symbol = String(ticker || '').toUpperCase();
  const symbolLower = symbol.toLowerCase();
  const best = { companyId: '', tickerId: '', score: -1 };
  const seen = new Set();
  const idKeys = {
    company: /^(?:companyId|company_id|companyID|idCompany|empresaId|idEmpresa|id_empresa|empresa_id|company)$/i,
    ticker: /^(?:tickerId|ticker_id|idTicker|id_ticker|stockId|stock_id|acaoId|idAcao|id_acao|assetId|asset_id|papelId|papel_id)$/i
  };
  const textHasSymbol = (value) => symbolLower && String(value || '').toLowerCase().includes(symbolLower);
  const consider = (obj, extraScore = 0) => {
    if (!obj || typeof obj !== 'object') return;
    let score = extraScore;
    let companyId = '';
    let tickerId = '';
    for (const [key, value] of Object.entries(obj)) {
      if (idKeys.company.test(key) && /^\d+$/.test(String(value || ''))) companyId = String(value);
      if (idKeys.ticker.test(key) && /^\d+$/.test(String(value || ''))) tickerId = String(value);
      if (/^(?:ticker|symbol|codigo|codneg|code|slug|url|link|name|nome)$/i.test(key) && textHasSymbol(value)) score += 5;
    }
    const blob = JSON.stringify(obj).slice(0, 3000).toLowerCase();
    if (symbolLower && blob.includes(`/acoes/${symbolLower}`)) score += 8;
    if (symbolLower && blob.includes(symbolLower)) score += 2;
    if (companyId) score += 4;
    if (tickerId) score += 3;
    if ((companyId || tickerId) && score > best.score) {
      best.companyId = companyId || best.companyId;
      best.tickerId = tickerId || best.tickerId;
      best.score = score;
    }
  };
  const walk = (value, depth = 0) => {
    if (value == null || depth > 7) return;
    if (typeof value === 'string') {
      const decoded = value.replace(/\\\//g, '/');
      const bal = decoded.match(/\/api\/balancos\/(?:receitaliquida|ativospassivos|balancopatrimonial|patrimonial|resultado|fluxocaixa|indicadores)\/(?:chart|table)\/(\d+)\//i);
      const pay = decoded.match(/\/api\/acoes\/payout-chart\/(\d+)\/(\d+)\//i);
      if (bal?.[1]) consider({ companyId: bal[1], url: decoded }, 8);
      if (pay?.[1]) consider({ companyId: pay[1], tickerId: pay[2], url: decoded }, 9);
      return;
    }
    if (typeof value !== 'object') return;
    if (seen.has(value)) return;
    seen.add(value);
    if (Array.isArray(value)) {
      value.slice(0, 80).forEach(item => walk(item, depth + 1));
      return;
    }
    consider(value);
    for (const child of Object.values(value).slice(0, 120)) walk(child, depth + 1);
  };
  walk(payload);
  return { companyId: best.companyId || '', tickerId: best.tickerId || '' };
}

async function resolveInvestidor10StockIds({ ticker = '', html = '', timeoutMs = 4500 } = {}) {
  const symbol = String(ticker || '').toUpperCase();
  const fromHtml = extractInvestidor10ChartIds(html || '');
  if (fromHtml.companyId || fromHtml.tickerId) return cacheStockIds(symbol, fromHtml);
  const cached = getCachedStockIds(symbol);
  if (cached) return cached;
  const base = 'https://investidor10.com.br';
  const candidates = [
    `${base}/api/rest/assets/tickers/${encodeURIComponent(symbol)}`,
    `${base}/api/rest/assets/tickers/${encodeURIComponent(symbol)}/`,
    `${base}/api/rest/assets/tickers/${encodeURIComponent(symbol.toLowerCase())}`,
    `${base}/api/search?term=${encodeURIComponent(symbol)}`,
    `${base}/api/search?q=${encodeURIComponent(symbol)}`,
    `${base}/api/ativos/search?term=${encodeURIComponent(symbol)}`,
    `${base}/api/assets/search?term=${encodeURIComponent(symbol)}`,
    `${base}/api/acoes/${symbol.toLowerCase()}`
  ];
  const requestTimeoutMs = Math.min(2600, Math.max(1500, Number(timeoutMs) || 2400));
  const responses = await Promise.all(candidates.map(async url => {
    const result = await fetchText(url, {
      timeoutMs: requestTimeoutMs,
      ttlMs: STOCK_ID_CACHE_TTL_MS,
      staleMs: 24 * 60 * 60 * 1000,
      retries: 0,
      headers: { 'User-Agent': process.env.VALORAE_USER_AGENT || 'Mozilla/5.0', Accept: 'application/json, text/plain, */*', 'X-Requested-With': 'XMLHttpRequest', Referer: `${base}/acoes/${symbol.toLowerCase()}/` }
    }).catch(() => null);
    const raw = result?.text || '';
    if (!raw) return null;
    const json = parseJsonMaybe(raw);
    const ids = extractInvestidor10StockIdsFromPayload(json || raw, symbol);
    if (!ids.companyId && !ids.tickerId) return null;
    return { companyId: ids.companyId || '', tickerId: ids.tickerId || '', fiiId: fromHtml.fiiId || '' };
  }));
  const resolved = responses.find(ids => ids?.companyId) || responses.find(ids => ids?.tickerId) || fromHtml;
  return cacheStockIds(symbol, resolved);
}

function stockHistoricalIndicatorCoverageScore(table = {}) {
  const rows = Array.isArray(table?.rows) ? table.rows.length : 0;
  const columns = Array.isArray(table?.columns) ? table.columns.length : 0;
  const periods = Array.isArray(table?.periods) ? table.periods.length : 0;
  const tablePeriods = table?.tablesByPeriod && typeof table.tablesByPeriod === 'object' ? Object.keys(table.tablesByPeriod).length : 0;
  return rows * 10 + columns * 3 + periods * 6 + tablePeriods * 8;
}

function stockHistoricalIndicatorEndpointCandidates({ ticker = '', ids = {}, html = '' } = {}) {
  const symbol = String(ticker || '').toUpperCase();
  const base = 'https://investidor10.com.br';
  const candidates = [];
  const seen = new Set();
  const add = (url, key = 'historicoIndicadores') => {
    const finalUrl = String(url || '').trim();
    if (!finalUrl || seen.has(finalUrl)) return;
    seen.add(finalUrl);
    candidates.push({ key, url: finalUrl });
  };
  for (const url of discoverInvestidor10ChartApiUrls(html || '', symbol, 'ACAO')) {
    if (/balancos\/indicadores|historico-indicadores|indicadores-historicos|historicoIndicadores|historicalIndicators/i.test(url)) {
      add(url, 'historicoIndicadoresDiscovered');
    }
  }
  if (symbol) {
    add(`${base}/api/rest/assets/tickers/${encodeURIComponent(symbol)}`, 'assetTickerRestHistorical');
    add(`${base}/api/rest/assets/tickers/${encodeURIComponent(symbol)}/`, 'assetTickerRestHistorical');
    add(`${base}/api/rest/assets/tickers/${encodeURIComponent(symbol.toLowerCase())}`, 'assetTickerRestHistorical');
    add(`${base}/api/rest/assets/tickers/${encodeURIComponent(symbol.toLowerCase())}/`, 'assetTickerRestHistorical');
  }
  if (ids?.companyId) {
    if (ids?.tickerId && symbol) {
      add(`${base}/api/balancos/indicadores/table/${ids.companyId}/${ids.tickerId}/${symbol}/3650/`, 'historicoIndicadoresTickerTable');
      add(`${base}/api/balancos/indicadores/table/${ids.companyId}/${ids.tickerId}/${symbol}/3650/false/`, 'historicoIndicadoresTickerTable');
      add(`${base}/api/balancos/indicadores/chart/${ids.companyId}/${ids.tickerId}/${symbol}/3650/`, 'historicoIndicadoresTickerChart');
      add(`${base}/api/balancos/indicadores/chart/${ids.companyId}/${ids.tickerId}/${symbol}/3650/false/`, 'historicoIndicadoresTickerChart');
      add(`${base}/api/acoes/historico-indicadores/${ids.companyId}/${ids.tickerId}/${symbol}`, 'historicoIndicadoresTickerDedicated');
      add(`${base}/api/acoes/historico-indicadores/${ids.companyId}/${ids.tickerId}/${symbol.toLowerCase()}`, 'historicoIndicadoresTickerDedicated');
    }
    add(`${base}/api/balancos/indicadores/table/${ids.companyId}/3650/`, 'historicoIndicadoresCompanyTable');
    add(`${base}/api/balancos/indicadores/table/${ids.companyId}/3650/false/`, 'historicoIndicadoresCompanyTable');
    add(`${base}/api/balancos/indicadores/chart/${ids.companyId}/3650/`, 'historicoIndicadoresCompanyChart');
    add(`${base}/api/balancos/indicadores/chart/${ids.companyId}/3650/false/`, 'historicoIndicadoresCompanyChart');
    add(`${base}/api/acoes/historico-indicadores/${ids.companyId}`, 'historicoIndicadoresCompanyDedicated');
    add(`${base}/api/acoes/indicadores-historicos/${ids.companyId}`, 'historicoIndicadoresCompanyDedicated');
  }
  if (symbol) {
    add(`${base}/api/acoes/historico-indicadores/${symbol.toLowerCase()}`, 'historicoIndicadoresTickerSlug');
    add(`${base}/api/acoes/indicadores-historicos/${symbol.toLowerCase()}`, 'historicoIndicadoresTickerSlug');
    add(`${base}/api/acoes/${symbol.toLowerCase()}/historico-indicadores`, 'historicoIndicadoresTickerSlug');
    add(`${base}/api/acoes/${symbol.toLowerCase()}/indicadores-historicos`, 'historicoIndicadoresTickerSlug');
  }
  return candidates;
}

async function fetchInvestidor10StockHistoricalIndicatorsRaw({ ticker = '', html = '', ids = {}, timeoutMs = 6500 } = {}) {
  const symbol = String(ticker || '').toUpperCase();
  const candidates = stockHistoricalIndicatorEndpointCandidates({ ticker: symbol, ids, html }).slice(0, 18);
  const status = [];
  const rawSources = [];
  let bestNormalized = null;
  let bestScore = 0;
  const candidateTimeoutMs = Math.min(4200, Math.max(1800, Number(timeoutMs) || 4200));

  const fetchCandidate = async candidate => {
    const result = await fetchText(candidate.url, {
      timeoutMs: candidateTimeoutMs,
      ttlMs: 15 * 60 * 1000,
      staleMs: 24 * 60 * 60 * 1000,
      retries: 0,
      headers: {
        'User-Agent': process.env.VALORAE_USER_AGENT || 'Mozilla/5.0',
        Accept: 'application/json, text/plain, */*',
        'X-Requested-With': 'XMLHttpRequest',
        Referer: `https://investidor10.com.br/acoes/${symbol.toLowerCase()}/`
      }
    }).catch(error => ({ text: '', status: 0, cacheStatus: 'ERROR', error: error?.message || String(error) }));
    const text = result?.text || '';
    const json = parseJsonMaybe(text);
    let normalized = null;
    let rawSource = null;
    if (json) {
      rawSource = json;
      normalized = normalizeStockHistoricalIndicatorsApi(json, symbol, {});
    } else if (text && /hist[óo]rico\s+de\s+indicadores|<table|<tr|<td|<th/i.test(text)) {
      normalized = extractInvestidor10StockHistoricalIndicatorsFromHtml(text, symbol);
      if ((normalized?.rows || []).length) rawSource = normalized;
    }
    const score = stockHistoricalIndicatorCoverageScore(normalized);
    return { candidate, result, json, normalized, rawSource, score };
  };

  // v300: antes os endpoints candidatos eram testados um a um. Quando a fonte
  // demorava ou recusava endpoints antigos, o modal ficava preso no histórico
  // fundamentalista antes de montar o contrato completo. O batch paralelo preserva
  // a escolha do melhor candidato, mas reduz a latência de pior caso.
  for (let offset = 0; offset < candidates.length; offset += 6) {
    const batch = candidates.slice(offset, offset + 6);
    const results = await Promise.all(batch.map(fetchCandidate));
    for (const { candidate, result, json, normalized, rawSource, score } of results) {
      if (rawSource) rawSources.push(rawSource);
      status.push({
        key: candidate.key,
        url: candidate.url,
        status: result?.status || 0,
        ok: Boolean((normalized?.rows || []).length),
        rows: Array.isArray(normalized?.rows) ? normalized.rows.length : 0,
        columns: Array.isArray(normalized?.columns) ? normalized.columns.length : 0,
        cacheStatus: result?.cacheStatus,
        error: (normalized?.rows || []).length ? undefined : (result?.error || (json ? 'historical_indicators_empty' : 'json_unavailable'))
      });
      if (score > bestScore) {
        bestScore = score;
        bestNormalized = normalized;
      }
    }
    if (bestScore >= 120 && (bestNormalized?.periods || []).includes('5y')) break;
  }
  return {
    raw: rawSources[0] || null,
    sources: rawSources,
    normalized: bestNormalized && (bestNormalized.rows || []).length ? bestNormalized : null,
    status,
    diagnostics: {
      resolvedCompanyId: ids?.companyId || '',
      resolvedTickerId: ids?.tickerId || '',
      candidates: candidates.length,
      rawSources: rawSources.length,
      bestRows: Array.isArray(bestNormalized?.rows) ? bestNormalized.rows.length : 0,
      bestColumns: Array.isArray(bestNormalized?.columns) ? bestNormalized.columns.length : 0,
      bestScore,
      strategy: 'parallel_batches_of_6_v300'
    }
  };
}

function stockRevenueApiEndpointCandidates({ symbol = '', ids = {} } = {}) {
  const cleanSymbol = String(symbol || '').toUpperCase();
  const lower = cleanSymbol.toLowerCase();
  const base = 'https://investidor10.com.br';
  const candidates = [];
  const seen = new Set();
  const add = (key, url) => {
    const finalUrl = String(url || '').trim();
    if (!finalUrl || seen.has(finalUrl)) return;
    seen.add(finalUrl);
    candidates.push([key, finalUrl]);
  };
  const addRegionFor = (idOrSlug = '') => {
    const value = String(idOrSlug || '').trim();
    if (!value) return;
    add('revenueGeography', `${base}/api/acoes/regioes-receita/${value}`);
    add('revenueGeography', `${base}/api/acoes/regioes-receita/${value}/`);
    add('revenueGeography', `${base}/api/acoes/receita-regioes/${value}`);
    add('revenueGeography', `${base}/api/acoes/receitas-regioes/${value}`);
    add('revenueGeography', `${base}/api/acoes/receitas-regioes/${value}/`);
    add('revenueGeography', `${base}/api/acoes/receitas-por-regiao/${value}`);
    add('revenueGeography', `${base}/api/acoes/receitas-por-regiao/${value}/`);
    add('revenueGeography', `${base}/api/acoes/receitas-por-regioes/${value}`);
    add('revenueGeography', `${base}/api/acoes/receitas-por-localidade/${value}`);
    add('revenueGeography', `${base}/api/acoes/revenue-geography/${value}`);
    add('revenueGeography', `${base}/api/acoes/revenue-by-region/${value}`);
    add('revenueGeography', `${base}/api/acoes/revenue-by-location/${value}`);
    add('revenueGeography', `${base}/api/acoes/sales-by-region/${value}`);
    add('revenueGeography', `${base}/api/acoes/sales-by-country/${value}`);
    add('revenueGeography', `${base}/api/acoes/grafico-receita-regiao/${value}`);
    add('revenueGeography', `${base}/api/acoes/grafico-receita-regioes/${value}`);
    add('revenueGeography', `${base}/api/acoes/chart-receita-regiao/${value}`);
    add('revenueGeography', `${base}/api/acoes/chart-receita-geografica/${value}`);
    add('revenueGeography', `${base}/api/acoes/region-revenue/${value}`);
    add('revenueGeography', `${base}/api/companies/${value}/revenue-geography`);
    add('revenueGeography', `${base}/api/companies/${value}/revenue-by-region`);
    add('revenueGeography', `${base}/api/empresas/${value}/receitas/regioes`);
    add('revenueGeography', `${base}/api/empresas/${value}/receita/regioes`);
    add('revenueGeography', `${base}/api/empresas/${value}/receitas/geografia`);
  };
  const addBusinessFor = (idOrSlug = '') => {
    const value = String(idOrSlug || '').trim();
    if (!value) return;
    add('revenueSegment', `${base}/api/acoes/negocios-receita/${value}`);
    add('revenueSegment', `${base}/api/acoes/negocios-receita/${value}/`);
    add('revenueSegment', `${base}/api/acoes/receita-negocios/${value}`);
    add('revenueSegment', `${base}/api/acoes/receitas-negocios/${value}`);
    add('revenueSegment', `${base}/api/acoes/receitas-negocios/${value}/`);
    add('revenueSegment', `${base}/api/acoes/receitas-por-negocio/${value}`);
    add('revenueSegment', `${base}/api/acoes/receitas-por-negocio/${value}/`);
    add('revenueSegment', `${base}/api/acoes/receitas-por-negocios/${value}`);
    add('revenueSegment', `${base}/api/acoes/segmentos-receita/${value}`);
    add('revenueSegment', `${base}/api/acoes/receita-segmentos/${value}`);
    add('revenueSegment', `${base}/api/acoes/receitas-segmentos/${value}`);
    add('revenueSegment', `${base}/api/acoes/receitas-por-segmento/${value}`);
    add('revenueSegment', `${base}/api/acoes/receitas-por-segmentos/${value}`);
    add('revenueSegment', `${base}/api/acoes/produtos-receita/${value}`);
    add('revenueSegment', `${base}/api/acoes/revenue-business/${value}`);
    add('revenueSegment', `${base}/api/acoes/revenue-by-business/${value}`);
    add('revenueSegment', `${base}/api/acoes/business-revenue/${value}`);
    add('revenueSegment', `${base}/api/acoes/revenue-segment/${value}`);
    add('revenueSegment', `${base}/api/acoes/revenue-by-segment/${value}`);
    add('revenueSegment', `${base}/api/acoes/revenue-by-product/${value}`);
    add('revenueSegment', `${base}/api/acoes/segment-revenue/${value}`);
    add('revenueSegment', `${base}/api/acoes/product-revenue/${value}`);
    add('revenueSegment', `${base}/api/acoes/sales-by-business/${value}`);
    add('revenueSegment', `${base}/api/acoes/sales-by-segment/${value}`);
    add('revenueSegment', `${base}/api/acoes/grafico-receita-negocio/${value}`);
    add('revenueSegment', `${base}/api/acoes/grafico-receita-negocios/${value}`);
    add('revenueSegment', `${base}/api/acoes/grafico-receita-segmento/${value}`);
    add('revenueSegment', `${base}/api/acoes/chart-receita-negocio/${value}`);
    add('revenueSegment', `${base}/api/companies/${value}/revenue-business`);
    add('revenueSegment', `${base}/api/companies/${value}/revenue-by-segment`);
    add('revenueSegment', `${base}/api/empresas/${value}/negocios-receita`);
    add('revenueSegment', `${base}/api/empresas/${value}/receitas/negocios`);
    add('revenueSegment', `${base}/api/empresas/${value}/receita/negocios`);
    add('revenueSegment', `${base}/api/empresas/${value}/receitas/segmentos`);
    add('revenueSegment', `${base}/api/empresas/${value}/receita/segmentos`);
  };
  if (lower) {
    // O HTML público atual mostra os títulos e anos das seções, mas não necessariamente
    // expõe os valores no texto renderizado. Por isso os endpoints por slug precisam ser
    // tentados mesmo quando companyId/tickerId não foram resolvidos no primeiro HTML.
    addRegionFor(lower);
    addBusinessFor(lower);
    add('assetTickerRest', `${base}/api/rest/assets/tickers/${encodeURIComponent(cleanSymbol)}`);
    add('assetTickerRest', `${base}/api/rest/assets/tickers/${encodeURIComponent(cleanSymbol)}/`);
    add('assetTickerRest', `${base}/api/rest/assets/tickers/${encodeURIComponent(lower)}`);
    add('assetTickerRest', `${base}/api/rest/assets/tickers/${encodeURIComponent(lower)}/`);
    add('assetTickerRest', `${base}/api/rest/assets/tickers/${encodeURIComponent(cleanSymbol)}/receitas`);
    add('assetTickerRest', `${base}/api/rest/assets/tickers/${encodeURIComponent(lower)}/receitas`);
    add('assetTickerRest', `${base}/api/rest/assets/tickers/${encodeURIComponent(cleanSymbol)}/revenues`);
    add('assetTickerRest', `${base}/api/rest/assets/tickers/${encodeURIComponent(lower)}/revenues`);
    add('assetTickerRest', `${base}/api/rest/assets/tickers/${encodeURIComponent(cleanSymbol)}/charts`);
    add('assetTickerRest', `${base}/api/rest/assets/tickers/${encodeURIComponent(lower)}/charts`);
  }
  if (ids?.companyId) {
    addRegionFor(ids.companyId);
    addBusinessFor(ids.companyId);
  }
  if (ids?.tickerId && lower) {
    const pair = `${ids.companyId || ''}/${ids.tickerId}/${cleanSymbol}`.replace(/^\//, '');
    addRegionFor(pair);
    addBusinessFor(pair);
  }
  return candidates;
}

function stockRevenueSourceCount(rawJson = {}) {
  return (Array.isArray(rawJson?.revenueGeographySources) ? rawJson.revenueGeographySources.length : 0)
    + (Array.isArray(rawJson?.revenueSegmentSources) ? rawJson.revenueSegmentSources.length : 0)
    + (rawJson?.revenueGeography ? 1 : 0)
    + (rawJson?.revenueSegment ? 1 : 0);
}


function revenueRowsExistInRawJson(rawJson = {}, kind = 'region') {
  const keys = kind === 'business'
    ? ['revenueSegment', 'revenueSegmentSources', 'stockRevenueJsDiscoveredBusiness', 'assetTickerRest', 'assetTickerRestSources']
    : ['revenueGeography', 'revenueGeographySources', 'stockRevenueJsDiscoveredRegion', 'assetTickerRest', 'assetTickerRestSources'];
  for (const key of keys) {
    const value = rawJson?.[key];
    const values = Array.isArray(value) && /Sources$/.test(key) ? value : [value];
    for (const item of values.filter(Boolean)) {
      if (rowsFromRevenueCandidate(item, kind, 'Investidor10 distribuição de receitas API').length) return true;
    }
  }
  return false;
}

function investidor10AbsoluteUrl(candidate = '', baseUrl = 'https://investidor10.com.br') {
  let raw = decodeEscapedUnicode(decodeHtmlEntities(String(candidate || '').trim()))
    .replace(/\\\//g, '/')
    .replace(/\\\u002F/gi, '/')
    .replace(/&amp;/g, '&')
    .replace(/^['"`]+|['"`]+$/g, '');
  if (!raw) return '';
  if (raw.startsWith('//')) raw = `https:${raw}`;
  if (raw.startsWith('/')) raw = `${baseUrl}${raw}`;
  if (!/^https:\/\/(?:[^/]+\.)?investidor10\.com\.br\//i.test(raw)) return '';
  try {
    return new URL(raw).toString();
  } catch {
    return '';
  }
}

function extractInvestidor10ScriptUrls(html = '') {
  const source = String(html || '');
  const seen = new Set();
  const out = [];
  const add = (src = '') => {
    const url = investidor10AbsoluteUrl(src);
    if (!url || seen.has(url)) return;
    if (!/\.js(?:[?#]|$)|\/(?:assets|build|dist|js|_next|vite|static)\//i.test(url)) return;
    seen.add(url);
    out.push(url);
  };
  for (const match of source.matchAll(/<script\b[^>]*\bsrc\s*=\s*(["'])(.*?)\1[^>]*>/gi)) add(match[2]);
  for (const match of source.matchAll(/\b(?:src|href)\s*=\s*(["'])([^"']+\.js(?:\?[^"']*)?)\1/gi)) add(match[2]);
  return out.slice(0, 18);
}

function normalizeInvestidor10ApiUrlTemplate(template = '', { symbol = '', ids = {} } = {}) {
  let raw = decodeEscapedUnicode(decodeHtmlEntities(String(template || '').trim()))
    .replace(/\\\//g, '/')
    .replace(/&amp;/g, '&')
    .replace(/^['"`]+|['"`]+$/g, '');
  if (!raw || !/\/api\//i.test(raw)) return '';
  const cleanSymbol = String(symbol || '').toUpperCase();
  const lower = cleanSymbol.toLowerCase();
  const companyId = String(ids?.companyId || ids?.empresaId || ids?.idEmpresa || '').trim();
  const tickerId = String(ids?.tickerId || ids?.idTicker || ids?.assetId || '').trim();
  const replacements = [
    [/\$\{\s*(?:companyId|empresaId|idEmpresa|company_id|id_company)\s*\}/gi, companyId],
    [/:companyId\b|\{companyId\}|\{empresaId\}|\{idEmpresa\}|\[companyId\]/gi, companyId],
    [/\$\{\s*(?:tickerId|idTicker|assetId|ticker_id)\s*\}/gi, tickerId],
    [/:tickerId\b|\{tickerId\}|\{idTicker\}|\[tickerId\]/gi, tickerId],
    [/\$\{\s*(?:ticker|symbol|codigo|slug|codneg)\s*\}/gi, lower],
    [/:ticker\b|:symbol\b|\{ticker\}|\{symbol\}|\{codigo\}|\{slug\}|\[ticker\]|\[symbol\]/gi, lower],
  ];
  for (const [re, value] of replacements) raw = raw.replace(re, value || '');
  raw = raw
    .replace(/["'`]\s*\+\s*(?:companyId|empresaId|idEmpresa|company_id)\s*\+\s*["'`]/gi, companyId || '')
    .replace(/["'`]\s*\+\s*(?:tickerId|idTicker|assetId|ticker_id)\s*\+\s*["'`]/gi, tickerId || '')
    .replace(/["'`]\s*\+\s*(?:ticker|symbol|codigo|slug|codneg)\s*\+\s*["'`]/gi, lower || '')
    .replace(/\s+/g, '')
    .replace(/`/g, '')
    .replace(/\$\{[^}]+\}/g, '');
  if (/\b(?:companyId|empresaId|tickerId|idTicker|undefined|null)\b/i.test(raw)) return '';
  return investidor10AbsoluteUrl(raw);
}

function discoverInvestidor10StockRevenueApiUrlsFromText(text = '', { symbol = '', ids = {} } = {}) {
  const source = String(text || '');
  const snippets = [];
  const addSnippet = value => {
    const clean = String(value || '').replace(/\\\//g, '/').trim();
    if (clean && /\/api\//i.test(clean)) snippets.push(clean);
  };
  for (const match of source.matchAll(/(["'`])([^"'`]{0,500}?\/api\/[^"'`<>()\s]{1,500})\1/g)) addSnippet(match[2]);
  for (const match of source.matchAll(/(?:fetch|axios\.(?:get|post)|\$\.get|\$\.ajax)\s*\(\s*([`"'])([\s\S]{0,900}?\/api\/[\s\S]{0,900}?)\1/g)) addSnippet(match[2]);
  for (const match of source.matchAll(/https?:\\?\/\\?\/(?:[^\s"'`<>]+)?investidor10\.com\.br\\?\/api\\?\/[^\s"'`<>]+/gi)) addSnippet(match[0]);
  for (const match of source.matchAll(/\/api\/[^\s"'`<>)]{1,300}/gi)) {
    addSnippet(match[0]);
    const start = Math.max(0, match.index - 160);
    const end = Math.min(source.length, match.index + match[0].length + 220);
    addSnippet(source.slice(start, end));
  }
  const revenueHintRe = /(receita|receitas|revenue|sales|regiao|regi[oõ]es|geograf|geograph|localidade|region|country|pais|negocio|neg[oó]cios|business|segment|segmento|produto|product)/i;
  const seen = new Set();
  const out = [];
  for (const snippet of snippets) {
    if (!revenueHintRe.test(snippet)) continue;
    const url = normalizeInvestidor10ApiUrlTemplate(snippet, { symbol, ids });
    if (!url || seen.has(url)) continue;
    const key = stockI10ApiKeyFromUrl(url);
    if (!['revenueGeography', 'revenueSegment', 'assetTickerRest'].includes(key)) continue;
    seen.add(url);
    out.push([key, url]);
    if (out.length >= 64) break;
  }
  return out;
}

async function fetchInvestidor10StockRevenueSourcesFromScripts({ apiExtras, ticker = '', ids = {}, html = '', timeoutMs = 4200, seenUrls = new Set() } = {}) {
  const symbol = String(ticker || '').toUpperCase();
  const scriptUrls = extractInvestidor10ScriptUrls(html || '');
  const scriptTexts = [];
  const discovered = new Map();
  const addDiscovered = ([key, url]) => {
    if (!url || discovered.has(url) || seenUrls.has(url)) return;
    discovered.set(url, key);
  };
  discoverInvestidor10StockRevenueApiUrlsFromText(html || '', { symbol, ids }).forEach(addDiscovered);
  const scriptResults = await Promise.all(scriptUrls.slice(0, 12).map(async url => {
    const result = await fetchText(url, {
      timeoutMs: Math.min(5200, Math.max(1800, Number(timeoutMs) || 4200)),
      ttlMs: 4 * 60 * 60 * 1000,
      staleMs: 24 * 60 * 60 * 1000,
      retries: 0,
      headers: {
        'User-Agent': process.env.VALORAE_USER_AGENT || 'Mozilla/5.0',
        Accept: 'application/javascript,text/javascript,text/plain,*/*',
        Referer: `https://investidor10.com.br/acoes/${symbol.toLowerCase()}/`
      }
    }).catch(error => ({ text: '', status: 0, cacheStatus: 'ERROR', error: error?.message || String(error) }));
    return { url, ...result };
  }));
  for (const result of scriptResults) {
    apiExtras.apiStatus.push({ key: 'stockRevenueJsBundle', url: result.url, status: result.status || 0, ok: Boolean(result.text), cacheStatus: result.cacheStatus, error: result.text ? undefined : (result.error || 'script_unavailable') });
    if (!result.text) continue;
    scriptTexts.push(result.text);
    discoverInvestidor10StockRevenueApiUrlsFromText(result.text, { symbol, ids }).forEach(addDiscovered);
  }
  const pending = Array.from(discovered.entries()).map(([url, key]) => [key, url]).slice(0, 42);
  const beforeSources = stockRevenueSourceCount(apiExtras.rawJson);
  const responses = await Promise.all(pending.map(async ([key, url]) => {
    const result = await fetchText(url, {
      timeoutMs: Math.min(6200, Math.max(2200, Number(timeoutMs) || 4200)),
      ttlMs: 15 * 60 * 1000,
      staleMs: 24 * 60 * 60 * 1000,
      retries: 1,
      headers: {
        'User-Agent': process.env.VALORAE_USER_AGENT || 'Mozilla/5.0',
        Accept: 'application/json, text/plain, */*',
        'X-Requested-With': 'XMLHttpRequest',
        Referer: `https://investidor10.com.br/acoes/${symbol.toLowerCase()}/`
      }
    }).catch(error => ({ text: '', status: 0, cacheStatus: 'ERROR', error: error?.message || String(error) }));
    const json = parseJsonMaybe(result.text || '');
    return [key, url, result, json];
  }));
  for (const [key, url, result, json] of responses) {
    apiExtras.apiStatus.push({ key, url, status: result.status || 0, ok: Boolean(json), cacheStatus: result.cacheStatus, jsDiscoveredRevenue: true, error: json ? undefined : (result.error || 'json_unavailable') });
    if (!json) continue;
    recordInvestidor10StockApiJson(apiExtras, key, json);
    if (key === 'revenueGeography' && !apiExtras.rawJson.stockRevenueJsDiscoveredRegion) apiExtras.rawJson.stockRevenueJsDiscoveredRegion = json;
    if (key === 'revenueSegment' && !apiExtras.rawJson.stockRevenueJsDiscoveredBusiness) apiExtras.rawJson.stockRevenueJsDiscoveredBusiness = json;
  }
  return {
    scriptsAttempted: scriptUrls.slice(0, 12).length,
    scriptsLoaded: scriptTexts.length,
    urlsDiscovered: discovered.size,
    attempted: pending.length,
    beforeSources,
    afterSources: stockRevenueSourceCount(apiExtras.rawJson),
    regionRowsFound: revenueRowsExistInRawJson(apiExtras.rawJson, 'region'),
    businessRowsFound: revenueRowsExistInRawJson(apiExtras.rawJson, 'business')
  };
}

function recordInvestidor10StockApiJson(apiExtras, key, json) {
  if (!json) return;
  if (key === 'assetTickerRest') {
    if (!Array.isArray(apiExtras.rawJson.assetTickerRestSources)) apiExtras.rawJson.assetTickerRestSources = [];
    apiExtras.rawJson.assetTickerRestSources.push(json);
    if (!apiExtras.rawJson.assetTickerRest) apiExtras.rawJson.assetTickerRest = json;
    if (!Array.isArray(apiExtras.rawJson.historicoIndicadoresSources)) apiExtras.rawJson.historicoIndicadoresSources = [];
    apiExtras.rawJson.historicoIndicadoresSources.push(json);
  } else if (key === 'historicoIndicadores') {
    if (!Array.isArray(apiExtras.rawJson.historicoIndicadoresSources)) apiExtras.rawJson.historicoIndicadoresSources = [];
    apiExtras.rawJson.historicoIndicadoresSources.push(json);
    if (!apiExtras.rawJson.historicoIndicadores) apiExtras.rawJson.historicoIndicadores = json;
  } else if (key === 'revenueGeography') {
    if (!Array.isArray(apiExtras.rawJson.revenueGeographySources)) apiExtras.rawJson.revenueGeographySources = [];
    apiExtras.rawJson.revenueGeographySources.push(json);
    if (!apiExtras.rawJson.revenueGeography) apiExtras.rawJson.revenueGeography = json;
  } else if (key === 'revenueSegment') {
    if (!Array.isArray(apiExtras.rawJson.revenueSegmentSources)) apiExtras.rawJson.revenueSegmentSources = [];
    apiExtras.rawJson.revenueSegmentSources.push(json);
    if (!apiExtras.rawJson.revenueSegment) apiExtras.rawJson.revenueSegment = json;
  } else if (key === 'shareholdingPosition') {
    if (!Array.isArray(apiExtras.rawJson.shareholdingSources)) apiExtras.rawJson.shareholdingSources = [];
    apiExtras.rawJson.shareholdingSources.push(json);
    if (!apiExtras.rawJson.shareholdingPosition) apiExtras.rawJson.shareholdingPosition = json;
  } else if (apiExtras.rawJson[key]) {
    let suffix = 2;
    while (apiExtras.rawJson[`${key}_${suffix}`]) suffix += 1;
    apiExtras.rawJson[`${key}_${suffix}`] = json;
  } else {
    apiExtras.rawJson[key] = json;
  }
  apiExtras.chartsFinanceiros[key] = json;
}

async function fetchMissingInvestidor10StockRevenueSources({ apiExtras, ticker = '', ids = {}, html = '', timeoutMs = 4200, seenUrls = new Set() } = {}) {
  const symbol = String(ticker || '').toUpperCase();
  const resolved = { ...(ids || {}) };
  const restSources = [apiExtras?.rawJson?.assetTickerRest, ...(Array.isArray(apiExtras?.rawJson?.assetTickerRestSources) ? apiExtras.rawJson.assetTickerRestSources : [])].filter(Boolean);
  for (const source of restSources) {
    const found = extractInvestidor10StockIdsFromPayload(source, symbol);
    if (!resolved.companyId && found.companyId) resolved.companyId = found.companyId;
    if (!resolved.tickerId && found.tickerId) resolved.tickerId = found.tickerId;
  }
  const candidates = [
    ...stockRevenueApiEndpointCandidates({ symbol, ids: resolved }),
    ...discoverInvestidor10ChartApiUrls(html || '', symbol, 'ACAO').map(url => [stockI10ApiKeyFromUrl(url), url])
  ];
  const pending = [];
  const localSeen = new Set();
  for (const [key, url] of candidates) {
    if (!['revenueGeography', 'revenueSegment', 'assetTickerRest'].includes(key)) continue;
    if (seenUrls.has(url) || localSeen.has(url)) continue;
    localSeen.add(url);
    pending.push([key, url]);
    if (pending.length >= 36) break;
  }
  if (!pending.length) return { resolved, attempted: 0 };
  const responses = await Promise.all(pending.map(async ([key, url]) => {
    const result = await fetchText(url, {
      timeoutMs: Math.min(5200, Math.max(2000, Number(timeoutMs) || 4200)),
      ttlMs: 15 * 60 * 1000,
      staleMs: 24 * 60 * 60 * 1000,
      retries: 1,
      headers: {
        'User-Agent': process.env.VALORAE_USER_AGENT || 'Mozilla/5.0',
        Accept: 'application/json, text/plain, */*',
        'X-Requested-With': 'XMLHttpRequest',
        Referer: `https://investidor10.com.br/acoes/${symbol.toLowerCase()}/`
      }
    }).catch(error => ({ text: '', status: 0, cacheStatus: 'ERROR', error: error?.message || String(error) }));
    const json = parseJsonMaybe(result.text || '');
    return [key, url, result, json];
  }));
  for (const [key, url, result, json] of responses) {
    apiExtras.apiStatus.push({ key, url, status: result.status || 0, ok: Boolean(json), cacheStatus: result.cacheStatus, fallbackRevenuePass: true, error: json ? undefined : (result.error || 'json_unavailable') });
    if (json) recordInvestidor10StockApiJson(apiExtras, key, json);
  }
  return { resolved, attempted: pending.length };
}

async function fetchInvestidor10StockApiExtras({ ticker = '', html = '', timeoutMs = 4500, targetSections = null, targetedRecovery = false } = {}) {
  const symbol = String(ticker || '').toUpperCase();
  const target = { targeted: targetedRecovery === true, sections: targetSections instanceof Set ? targetSections : new Set(parseStockSectionList(targetSections)) };
  const ids = await resolveInvestidor10StockIds({ ticker: symbol, html: html || '', timeoutMs }).catch(() => extractInvestidor10ChartIds(html || ''));
  const apiExtras = { embedded: extractInvestidor10StockEmbeddedAnalysisData(html || ''), chartsFinanceiros: {}, rawJson: {}, apiStatus: [], diagnostics: { resolvedCompanyId: ids.companyId || '', resolvedTickerId: ids.tickerId || '' } };
  const dedicatedHistoricalPromise = (!target.targeted || target.sections.has('historicalIndicators'))
    ? fetchInvestidor10StockHistoricalIndicatorsRaw({ ticker: symbol, html: html || '', ids, timeoutMs: Math.min(timeoutMs, 6500) })
      .catch(error => ({ raw: null, sources: [], normalized: null, status: [{ key: 'stockHistoricalIndicatorsDedicated', status: 0, ok: false, error: error?.message || String(error) }], diagnostics: { error: error?.message || String(error) } }))
    : Promise.resolve({ raw: null, sources: [], normalized: null, status: [], diagnostics: { skipped: true, reason: 'section_not_requested' } });
  const tasks = [];
  const seen = new Set();
  const base = 'https://investidor10.com.br';
  const addTask = (key, url) => {
    const finalUrl = String(url || '').trim();
    const resolvedKey = key || stockI10ApiKeyFromUrl(finalUrl);
    if (!finalUrl || seen.has(finalUrl) || !stockApiKeyNeededForTargets(resolvedKey, target)) return;
    seen.add(finalUrl);
    tasks.push([resolvedKey, finalUrl]);
  };
  if (symbol) {
    addTask('assetTickerRest', `${base}/api/rest/assets/tickers/${encodeURIComponent(symbol)}`);
    addTask('assetTickerRest', `${base}/api/rest/assets/tickers/${encodeURIComponent(symbol)}/`);
    addTask('assetTickerRest', `${base}/api/rest/assets/tickers/${encodeURIComponent(symbol.toLowerCase())}`);
    addTask('assetTickerRest', `${base}/api/rest/assets/tickers/${encodeURIComponent(symbol.toLowerCase())}/`);
    // Prioridade de regressão v288: Lucro x Cotação deve entrar antes do bloco expansivo de endpoints de receita.
    // Em v287, os candidatos de Regiões/Negócios podiam empurrar /api/cotacao-lucro para fora do slice inicial.
    addTask('lucroCotacao', `${base}/api/cotacao-lucro/${symbol.toLowerCase()}/adjusted/`);
    for (const [revenueKey, revenueUrl] of stockRevenueApiEndpointCandidates({ symbol, ids: {} })) addTask(revenueKey, revenueUrl);
  }
  if (ids.companyId) {
    addTask('receitasLucros', `${base}/api/balancos/receitaliquida/chart/${ids.companyId}/3650/false/`);
    addTask('evolucaoPatrimonio', `${base}/api/balancos/ativospassivos/chart/${ids.companyId}/3650/`);
    addTask('balanceSheetTable', `${base}/api/balancos/ativospassivos/table/${ids.companyId}/3650/`);
    addTask('balanceSheetTable', `${base}/api/balancos/ativospassivos/table/${ids.companyId}/3650/false/`);
    addTask('balanceSheetTable', `${base}/api/balancos/balancopatrimonial/table/${ids.companyId}/3650/`);
    addTask('balanceSheetTable', `${base}/api/balancos/patrimonial/table/${ids.companyId}/3650/`);
    addTask('historicoIndicadores', `${base}/api/balancos/indicadores/table/${ids.companyId}/3650/`);
    addTask('historicoIndicadores', `${base}/api/balancos/indicadores/table/${ids.companyId}/3650/false/`);
    addTask('historicoIndicadores', `${base}/api/balancos/indicadores/chart/${ids.companyId}/3650/`);
    addTask('historicoIndicadores', `${base}/api/balancos/indicadores/chart/${ids.companyId}/3650/false/`);
    if (ids.tickerId && symbol) {
      addTask('historicoIndicadores', `${base}/api/balancos/indicadores/table/${ids.companyId}/${ids.tickerId}/${symbol}/3650/`);
      addTask('historicoIndicadores', `${base}/api/balancos/indicadores/chart/${ids.companyId}/${ids.tickerId}/${symbol}/3650/`);
      addTask('historicoIndicadores', `${base}/api/acoes/historico-indicadores/${ids.companyId}/${ids.tickerId}/${symbol}`);
    }
    if (symbol) {
      addTask('historicoIndicadores', `${base}/api/acoes/historico-indicadores/${symbol.toLowerCase()}`);
      addTask('historicoIndicadores', `${base}/api/acoes/indicadores-historicos/${symbol.toLowerCase()}`);
    }
    addTask('resultadoDre', `${base}/api/balancos/resultado/chart/${ids.companyId}/3650/`);
    addTask('fluxoCaixa', `${base}/api/balancos/fluxocaixa/chart/${ids.companyId}/3650/`);
    addTask('revenueGeography', `${base}/api/acoes/regioes-receita/${ids.companyId}`);
    addTask('revenueGeography', `${base}/api/acoes/receita-regioes/${ids.companyId}`);
    addTask('revenueGeography', `${base}/api/acoes/receitas-regioes/${ids.companyId}`);
    addTask('revenueGeography', `${base}/api/acoes/revenue-geography/${ids.companyId}`);
    addTask('revenueGeography', `${base}/api/acoes/receitas-por-regiao/${ids.companyId}`);
    addTask('revenueGeography', `${base}/api/acoes/receitas-por-regioes/${ids.companyId}`);
    addTask('revenueGeography', `${base}/api/acoes/receitas-por-localidade/${ids.companyId}`);
    addTask('revenueGeography', `${base}/api/empresas/${ids.companyId}/receitas/regioes`);
    addTask('revenueGeography', `${base}/api/empresas/${ids.companyId}/receita/regioes`);
    addTask('revenueGeography', `${base}/api/empresas/${ids.companyId}/receitas/geografia`);
    addTask('revenueSegment', `${base}/api/acoes/negocios-receita/${ids.companyId}`);
    addTask('revenueSegment', `${base}/api/acoes/receita-negocios/${ids.companyId}`);
    addTask('revenueSegment', `${base}/api/acoes/receitas-negocios/${ids.companyId}`);
    addTask('revenueSegment', `${base}/api/acoes/revenue-business/${ids.companyId}`);
    addTask('revenueSegment', `${base}/api/acoes/business-revenue/${ids.companyId}`);
    addTask('revenueSegment', `${base}/api/acoes/segmentos-receita/${ids.companyId}`);
    addTask('revenueSegment', `${base}/api/acoes/receitas-por-segmento/${ids.companyId}`);
    addTask('revenueSegment', `${base}/api/acoes/receitas-por-segmentos/${ids.companyId}`);
    addTask('revenueSegment', `${base}/api/acoes/receitas-por-negocio/${ids.companyId}`);
    addTask('revenueSegment', `${base}/api/acoes/receitas-por-negocios/${ids.companyId}`);
    addTask('revenueSegment', `${base}/api/acoes/receita-segmentos/${ids.companyId}`);
    addTask('revenueSegment', `${base}/api/acoes/receitas-segmentos/${ids.companyId}`);
    addTask('revenueSegment', `${base}/api/acoes/produtos-receita/${ids.companyId}`);
    addTask('revenueSegment', `${base}/api/empresas/${ids.companyId}/negocios-receita`);
    addTask('revenueSegment', `${base}/api/empresas/${ids.companyId}/receitas/negocios`);
    addTask('revenueSegment', `${base}/api/empresas/${ids.companyId}/receita/negocios`);
    addTask('revenueSegment', `${base}/api/empresas/${ids.companyId}/receitas/segmentos`);
    addTask('revenueSegment', `${base}/api/empresas/${ids.companyId}/receita/segmentos`);
    for (const [revenueKey, revenueUrl] of stockRevenueApiEndpointCandidates({ symbol, ids })) addTask(revenueKey, revenueUrl);
    addTask('shareholdingPosition', `${base}/api/acoes/posicao-acionaria/${ids.companyId}`);
    addTask('shareholdingPosition', `${base}/api/acoes/acionistas/${ids.companyId}`);
    addTask('shareholdingPosition', `${base}/api/acoes/shareholders/${ids.companyId}`);
    if (symbol) {
      addTask('lucroCotacao', `${base}/api/cotacao-lucro/${symbol.toLowerCase()}/adjusted/`);
      addTask('revenueGeography', `${base}/api/acoes/regioes-receita/${symbol.toLowerCase()}`);
      addTask('revenueGeography', `${base}/api/acoes/receita-regioes/${symbol.toLowerCase()}`);
      addTask('revenueGeography', `${base}/api/acoes/receitas-por-regiao/${symbol.toLowerCase()}`);
      addTask('revenueGeography', `${base}/api/acoes/receitas-por-localidade/${symbol.toLowerCase()}`);
      addTask('revenueSegment', `${base}/api/acoes/negocios-receita/${symbol.toLowerCase()}`);
      addTask('revenueSegment', `${base}/api/acoes/receita-negocios/${symbol.toLowerCase()}`);
      addTask('revenueSegment', `${base}/api/acoes/segmentos-receita/${symbol.toLowerCase()}`);
      addTask('revenueSegment', `${base}/api/acoes/produtos-receita/${symbol.toLowerCase()}`);
      addTask('revenueSegment', `${base}/api/acoes/receitas-por-negocio/${symbol.toLowerCase()}`);
      addTask('revenueSegment', `${base}/api/acoes/receitas-por-segmento/${symbol.toLowerCase()}`);
      addTask('shareholdingPosition', `${base}/api/acoes/posicao-acionaria/${symbol.toLowerCase()}`);
      addTask('shareholdingPosition', `${base}/api/acoes/acionistas/${symbol.toLowerCase()}`);
    }
    if (ids.tickerId && symbol) {
      addTask('payoutHistorico', `${base}/api/acoes/payout-chart/${ids.companyId}/${ids.tickerId}/${symbol}/3650`);
      addTask('shareholdingPosition', `${base}/api/acoes/posicao-acionaria/${ids.companyId}/${ids.tickerId}/${symbol}`);
      addTask('shareholdingPosition', `${base}/api/acoes/acionistas/${ids.companyId}/${ids.tickerId}/${symbol}`);
    }
  }
  for (const url of discoverInvestidor10ChartApiUrls(html || '', symbol, 'ACAO')) {
    if (tasks.length >= 40) break;
    addTask(stockI10ApiKeyFromUrl(url), url);
  }
  const fetchTask = async ([key, url]) => {
    const result = await fetchText(url, {
      timeoutMs: Math.min(4600, Math.max(2200, Number(timeoutMs) || 4200)),
      ttlMs: 4 * 60 * 60 * 1000,
      staleMs: 24 * 60 * 60 * 1000,
      retries: 0,
      headers: {
        'User-Agent': process.env.VALORAE_USER_AGENT || 'Mozilla/5.0',
        Accept: 'application/json, text/plain, */*',
        'X-Requested-With': 'XMLHttpRequest',
        Referer: `${base}/acoes/${symbol.toLowerCase()}/`
      }
    }).catch(error => ({ text: '', status: 0, cacheStatus: 'ERROR', error: error?.message || String(error) }));
    const json = parseJsonMaybe(result.text || '');
    return [key, url, result, json];
  };
  const criticalKeys = new Set(['lucroCotacao', 'receitasLucros', 'evolucaoPatrimonio', 'assetTickerRest']);
  const perKeyLimit = new Map([['lucroCotacao', 2], ['receitasLucros', 2], ['evolucaoPatrimonio', 2], ['assetTickerRest', 2]]);
  const keyCounts = new Map();
  const criticalTasks = [];
  const optionalTasks = [];
  for (const task of tasks.slice(0, 72)) {
    const key = task[0];
    if (criticalKeys.has(key) && (keyCounts.get(key) || 0) < (perKeyLimit.get(key) || 1)) {
      keyCounts.set(key, (keyCounts.get(key) || 0) + 1);
      criticalTasks.push(task);
    } else {
      optionalTasks.push(task);
    }
  }
  const [dedicatedHistorical, criticalResponses] = await Promise.all([
    dedicatedHistoricalPromise,
    Promise.all(criticalTasks.map(fetchTask))
  ]);
  const optionalResponsesPromise = Promise.all((target.targeted ? [] : optionalTasks.slice(0, 32)).map(fetchTask));
  const optionalResponses = target.targeted
    ? []
    : await settleFastModalSource(optionalResponsesPromise, Math.min(3600, Math.max(1400, Number(timeoutMs) - 4800)), []);
  const responses = [...criticalResponses, ...(Array.isArray(optionalResponses) ? optionalResponses : [])];
  apiExtras.diagnostics.criticalSectionFetch = {
    criticalTasks: criticalTasks.map(([key, url]) => ({ key, url })),
    criticalResponses: criticalResponses.length,
    optionalAccepted: Array.isArray(optionalResponses) ? optionalResponses.length : 0,
    optionalTotal: optionalTasks.length,
    strategy: target.targeted ? 'requested_sections_only_v319' : 'critical_first_v319',
    requestedSections: [...target.sections]
  };
  if (Array.isArray(dedicatedHistorical.status) && dedicatedHistorical.status.length) {
    apiExtras.apiStatus.push(...dedicatedHistorical.status.map(item => ({ ...item, dedicated: true })));
  }
  if (Array.isArray(dedicatedHistorical.sources) && dedicatedHistorical.sources.length) {
    apiExtras.rawJson.stockHistoricalIndicatorsDedicatedSources = dedicatedHistorical.sources;
    apiExtras.rawJson.historicoIndicadoresSources = [
      ...(Array.isArray(apiExtras.rawJson.historicoIndicadoresSources) ? apiExtras.rawJson.historicoIndicadoresSources : []),
      ...dedicatedHistorical.sources
    ];
    if (!apiExtras.rawJson.historicoIndicadores) apiExtras.rawJson.historicoIndicadores = dedicatedHistorical.sources[0];
  }
  if (dedicatedHistorical.normalized && (dedicatedHistorical.normalized.rows || []).length) {
    apiExtras.rawJson.stockHistoricalIndicatorsNormalized = dedicatedHistorical.normalized;
    apiExtras.rawJson.historicoIndicadoresNormalized = dedicatedHistorical.normalized;
  }
  apiExtras.diagnostics.stockHistoricalIndicatorsDedicated = dedicatedHistorical.diagnostics || {};
  for (const [key, url, result, json] of responses) {
    apiExtras.apiStatus.push({ key, url, status: result.status || 0, ok: Boolean(json), cacheStatus: result.cacheStatus, error: json ? undefined : (result.error || 'json_unavailable') });
    if (!json) continue;
    recordInvestidor10StockApiJson(apiExtras, key, json);
  }
  if (!target.targeted && (!apiExtras.rawJson.revenueGeography || !apiExtras.rawJson.revenueSegment || !revenueRowsExistInRawJson(apiExtras.rawJson, 'region') || !revenueRowsExistInRawJson(apiExtras.rawJson, 'business'))) {
    const beforeRevenueSources = stockRevenueSourceCount(apiExtras.rawJson);
    const seenUrls = new Set(tasks.map(([, taskUrl]) => taskUrl));
    const secondaryPromise = fetchMissingInvestidor10StockRevenueSources({ apiExtras, ticker: symbol, ids, html, timeoutMs, seenUrls })
      .catch(error => ({ attempted: 0, error: error?.message || String(error) }));
    const secondary = await settleFastModalSource(secondaryPromise, 1200, { attempted: 0, deferred: true });
    apiExtras.diagnostics.stockRevenueSecondaryPass = {
      attempted: secondary?.attempted || 0,
      deferred: secondary?.deferred === true,
      beforeSources: beforeRevenueSources,
      afterSources: stockRevenueSourceCount(apiExtras.rawJson),
      resolvedCompanyId: secondary?.resolved?.companyId || ids.companyId || '',
      resolvedTickerId: secondary?.resolved?.tickerId || ids.tickerId || '',
      error: secondary?.error || undefined
    };
  }
  if (!target.targeted && (!revenueRowsExistInRawJson(apiExtras.rawJson, 'region') || !revenueRowsExistInRawJson(apiExtras.rawJson, 'business'))) {
    const jsSeenUrls = new Set(tasks.map(([, taskUrl]) => taskUrl));
    const jsPromise = fetchInvestidor10StockRevenueSourcesFromScripts({ apiExtras, ticker: symbol, ids, html, timeoutMs, seenUrls: jsSeenUrls })
      .catch(error => ({ attempted: 0, error: error?.message || String(error) }));
    apiExtras.diagnostics.stockRevenueJsDiscovery = await settleFastModalSource(jsPromise, 900, { attempted: 0, deferred: true });
  }
  return apiExtras;
}

function normalizeStockModalStage(payload = {}) {
  const raw = String(payload.stage || payload.mode || payload.priority || '').toLowerCase();
  if (raw.includes('fast') || raw.includes('initial') || raw.includes('essential')) return 'fast';
  return 'full';
}

function stockStageTimeoutMs(payload = {}, fallback = 8500) {
  const stage = normalizeStockModalStage(payload);
  const requested = Number(payload.timeoutMs || payload.modalTimeoutMs || payload.fundamentalTimeoutMs || fallback);
  const safe = Number.isFinite(requested) ? requested : fallback;
  return stage === 'fast'
    ? Math.min(4500, Math.max(2500, safe))
    : Math.min(18000, Math.max(7000, safe));
}

function deferredStockIndexComparison(ticker = '') {
  return {
    id: 'stock_asset_vs_indices_selector',
    title: `Comparação de ${ticker} com índices`,
    status: 'DEFERRED',
    defaultPeriod: '5y',
    periods: STOCK_COMPARISON_PERIODS,
    series: [],
    items: [],
    seriesByPeriod: {},
    itemsByPeriod: {},
    source: 'Carregado no stage full do modal de ação'
  };
}

async function fetchInvestidor10StockBundle(ticker, timeoutMs = 6500, options = {}) {
  const symbol = String(ticker || '').toUpperCase();
  const fastMode = String(options.mode || options.stage || '').toLowerCase() === 'fast';
  const recoveryTarget = stockSectionRecoveryTargets(options);
  const targetedRecovery = !fastMode && recoveryTarget.targeted;
  const url = `https://investidor10.com.br/acoes/${symbol.toLowerCase()}/`;
  // Fast e full compartilham a mesma captura HTML em fetchText. O primeiro assinante
  // define o orçamento da chamada coalescida; por isso o fast usa o orçamento resiliente
  // da fonte e deixa o deadline curto da rota decidir quando responder ao APK.
  const sourceTimeoutMs = fastMode ? Math.max(Number(timeoutMs) || 0, 6500) : timeoutMs;
  const { text, status, cacheStatus, error, finalUrl } = await fetchText(url, {
    timeoutMs: sourceTimeoutMs,
    ttlMs: 10 * 60_000,
    staleMs: 8 * 60 * 60 * 1000,
    retries: 1,
    headers: {
      'User-Agent': process.env.VALORAE_USER_AGENT || 'Mozilla/5.0 (Linux; Android 16; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Mobile Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.7'
    }
  });
  const rawHtml = text || '';
  const identityOk = rawHtml ? stockTickerIdentityOk(rawHtml, finalUrl || url, symbol) : false;
  const identityDiagnostics = rawHtml ? stockPageIdentityDiagnostics(rawHtml, finalUrl || url, symbol) : { requestedTicker: symbol, finalUrl: finalUrl || url, symbolFoundInPageHead: false, urlMatchesTicker: false };
  const html = identityOk ? rawHtml : '';
  const identityApiStatus = rawHtml && !identityOk
    ? [{ key: 'stockPageIdentity', status: status || 0, ok: false, error: 'page_identity_mismatch', diagnostics: identityDiagnostics }]
    : [];
  const buyHoldRankingPromise = html && !fastMode && !targetedRecovery
    ? fetchInvestidor10StockBuyHoldRanking(symbol, Math.min(timeoutMs, 3600)).catch(error => ({ ticker: symbol, status: 'ERROR', source: 'Investidor10 ranking buy and hold', error: error?.message || String(error) }))
    : Promise.resolve(null);
  const wantsAnnouncements = !targetedRecovery || recoveryTarget.sections.has('announcements');
  const announcementsPromise = fastMode
    ? Promise.resolve(emptyStockAnnouncements(symbol, { reason: 'fast_stage_deferred' }))
    : wantsAnnouncements
      ? buildStockAnnouncementsPayload({ ticker: symbol, html, timeoutMs })
      : Promise.resolve(emptyStockAnnouncements(symbol, { reason: 'section_recovery_not_requested' }));
  const apiExtrasPromise = fastMode
    ? Promise.resolve({ embedded: {}, chartsFinanceiros: {}, rawJson: {}, apiStatus: [{ key: 'stockApiExtras', status: 204, ok: true, stage: 'fast', deferred: true }] })
    : fetchInvestidor10StockApiExtras({ ticker: symbol, html, timeoutMs: Math.min(timeoutMs, 9500), targetSections: recoveryTarget.sections, targetedRecovery })
      .catch(error => ({ embedded: {}, chartsFinanceiros: {}, rawJson: {}, apiStatus: [{ key: 'stockApiExtras', status: 0, ok: false, error: error?.message || String(error) }] }));
  // O HTML já contém os blocos fundamentais mais importantes. Extras REST que excedem o
  // orçamento não podem impedir a entrega do contrato profundo; continuam em segundo plano
  // aquecendo os caches das respectivas fontes para a tentativa seguinte.
  // O full aguarda explicitamente os produtores críticos. O próprio coletor limita os
  // endpoints secundários, portanto histórico e três gráficos financeiros não são mais
  // descartados por um corte global de 1,8–2,9 segundos.
  const apiExtras = await apiExtrasPromise;
  if (identityApiStatus.length) apiExtras.apiStatus = [...(apiExtras.apiStatus || []), ...identityApiStatus];
  const canonical = fastMode
    ? { embedded: {}, rawJson: {}, chartsFinanceiros: {}, fastStageDeferred: true }
    : {
      ...buildInvestidor10CanonicalCharts({ ticker: symbol, type: 'ACAO', html, apiExtras }),
      embedded: apiExtras?.embedded || {},
      rawJson: apiExtras?.rawJson || {},
      chartsFinanceiros: apiExtras?.chartsFinanceiros || {}
    };
  const rawQuickMetrics = html ? extractInvestidor10StockQuickMetrics(html, symbol) : {};
  const rawFundamentalIndicators = html ? extractInvestidor10StockFundamentalIndicators(html, symbol, rawQuickMetrics) : extractInvestidor10StockFundamentalIndicators('', symbol, rawQuickMetrics);
  const quickMetrics = enrichStockQuickMetrics(rawQuickMetrics, rawFundamentalIndicators, symbol);
  const fundamentalIndicators = html ? extractInvestidor10StockFundamentalIndicators(html, symbol, quickMetrics) : rawFundamentalIndicators;
  const buyHoldRanking = fastMode
    ? await buyHoldRankingPromise
    : await settleFastModalSource(buyHoldRankingPromise, 1100, null);
  const fastDeferredDiagnostics = { reason: 'fast_stage_deferred' };
  const historicalIndicatorSources = fastMode ? {} : buildStockHistoricalIndicatorSources({ html, ticker: symbol, apiExtras });
  const historicalIndicators = fastMode
    ? { title: 'Histórico de indicadores fundamentalistas', columns: [], rows: [], periods: [], tablesByPeriod: {}, status: 'DEFERRED', source: 'Investidor10', diagnostics: fastDeferredDiagnostics }
    : buildStockHistoricalIndicators(historicalIndicatorSources, symbol, fundamentalIndicators);
  const checklist = fastMode
    ? emptyStockBuyHoldChecklist(symbol, fastDeferredDiagnostics)
    : (html ? extractInvestidor10StockBuyHoldChecklist(html, symbol, { fundamentalIndicators, historicalIndicators, canonical, quickMetrics, buyHoldRanking }) : emptyStockBuyHoldChecklist(symbol, { reason: 'no_html' }));
  const dividendHistory = fastMode ? buildStockDividendHistoryPayload({ ticker: symbol }) : buildStockDividendHistoryPayload({ ticker: symbol, html, canonical, quickMetrics, fundamentalIndicators });
  const dividendRadar = buildStockDividendRadarPayload({ ticker: symbol, dividendHistory });
  const payoutChart = fastMode ? buildStockPayoutChartPayload({ ticker: symbol }) : buildStockPayoutChartPayload({ ticker: symbol, canonical, historicalIndicators, dividendHistory, payoutRaw: apiExtras?.rawJson?.payoutHistorico || apiExtras?.chartsFinanceiros?.payoutHistorico || null, html });
  const peerComparison = fastMode
    ? { id: 'stock_peer_comparison', title: 'Comparação setorial', status: 'DEFERRED', source: 'Investidor10', columns: [], rows: [], diagnostics: fastDeferredDiagnostics }
    : extractInvestidor10StockPeerComparison(html, symbol, quickMetrics, fundamentalIndicators);
  const companyProfile = extractStockCompanyProfile(html, symbol, html ? extractTitleName(html, symbol) : symbol, quickMetrics, fundamentalIndicators);
  const companyData = fastMode ? extractStockCompanyData('', symbol, companyProfile?.name || extractTitleName(html, symbol)) : extractStockCompanyData(html, symbol, companyProfile?.name || extractTitleName(html, symbol));
  const companyInformation = fastMode ? extractStockCompanyInformation('', symbol) : extractStockCompanyInformation(html, symbol);
  const revenueByRegion = fastMode ? buildStockRevenueBreakdownPayload({ ticker: symbol, name: companyProfile?.name || symbol }, 'region') : buildStockRevenueBreakdownPayload({ html, canonical, ticker: symbol, name: companyProfile?.name || symbol }, 'region');
  const revenueByBusiness = fastMode ? buildStockRevenueBreakdownPayload({ ticker: symbol, name: companyProfile?.name || symbol }, 'business') : buildStockRevenueBreakdownPayload({ html, canonical, ticker: symbol, name: companyProfile?.name || symbol }, 'business');
  const shareholdingPosition = fastMode ? buildStockShareholdingPayload({ ticker: symbol }) : buildStockShareholdingPayload({ html, canonical, ticker: symbol, raw: [
    apiExtras?.rawJson?.shareholdingPosition,
    ...(Array.isArray(apiExtras?.rawJson?.shareholdingSources) ? apiExtras.rawJson.shareholdingSources : []),
    apiExtras?.rawJson?.assetTickerRest,
    ...(Array.isArray(apiExtras?.rawJson?.assetTickerRestSources) ? apiExtras.rawJson.assetTickerRestSources : [])
  ].filter(Boolean) });
  const revenueProfitChart = fastMode ? buildStockRevenueProfitChartPayload({ ticker: symbol }) : buildStockRevenueProfitChartPayload({ ticker: symbol, canonical });
  const profitQuoteChart = fastMode ? buildStockProfitQuoteChartPayload({ ticker: symbol }) : buildStockProfitQuoteChartPayload({ ticker: symbol, canonical });
  const resultsStatement = fastMode ? buildStockResultsStatementPayload({ ticker: symbol, fundamentalIndicators, historicalIndicators }) : buildStockResultsStatementPayload({ ticker: symbol, canonical, fundamentalIndicators, historicalIndicators });
  const balanceSheetStatement = fastMode ? buildStockBalanceSheetStatementPayload({ ticker: symbol }) : buildStockBalanceSheetStatementPayload({ ticker: symbol, canonical });
  const announcements = fastMode
    ? await announcementsPromise
    : await settleFastModalSource(
      announcementsPromise.catch(error => emptyStockAnnouncements(symbol, { reason: 'stock_announcements_failed', error: error?.message || String(error) })),
      1600,
      emptyStockAnnouncements(symbol, { reason: 'source_warming' })
    );
  const equityEvolutionChart = fastMode ? buildStockEquityEvolutionChartPayload({ ticker: symbol }) : buildStockEquityEvolutionChartPayload({ ticker: symbol, canonical });
  return {
    status,
    cacheStatus,
    error,
    url: finalUrl || url,
    html,
    identityOk,
    identityDiagnostics,
    quickMetrics,
    fundamentalIndicators,
    canonical,
    apiStatus: [...(apiExtras?.apiStatus || []), ...identityApiStatus],
    historicalIndicators,
    buyHoldRanking,
    checklist,
    dividendHistory,
    dividendRadar,
    payoutChart,
    peerComparison,
    companyProfile,
    companyData,
    companyInformation,
    revenueByRegion,
    revenueByBusiness,
    stockRevenueByRegion: revenueByRegion,
    stockRevenueByBusiness: revenueByBusiness,
    shareholdingPosition,
    revenueProfitChart,
    profitQuoteChart,
    resultsStatement,
    balanceSheetStatement,
    announcements,
    equityEvolutionChart,
    returnsRows: canonical ? returnsRowsFromInvestidor10Profitability(canonical) : [],
    name: html ? extractTitleName(html, symbol) : symbol,
    recoveryDiagnostics: { targetedRecovery, requestedSections: [...recoveryTarget.sections] }
  };
}

function metricCard(id, label, value, numericValue, source) {
  return {
    id,
    label,
    value: value || '—',
    numericValue: finiteNumberOrNull(numericValue) === null ? null : round(Number(numericValue), 4),
    source
  };
}


function buildStockModalSectionReadiness({ investidor10 = {} } = {}) {
  const balanceRows = Array.isArray(investidor10?.balanceSheetStatement?.rows) ? investidor10.balanceSheetStatement.rows.length : 0;
  const regionItems = Array.isArray(investidor10?.revenueByRegion?.items) ? investidor10.revenueByRegion.items.length : 0;
  const businessItems = Array.isArray(investidor10?.revenueByBusiness?.items) ? investidor10.revenueByBusiness.items.length : 0;
  const companyDataFacts = Array.isArray(investidor10?.companyData?.facts) ? investidor10.companyData.facts.length : 0;
  const companyDataPapers = (Array.isArray(investidor10?.companyData?.companyPapers) ? investidor10.companyData.companyPapers.length : 0)
    + (Array.isArray(investidor10?.companyData?.fractionalPapers) ? investidor10.companyData.fractionalPapers.length : 0);
  const companyInformationFacts = Array.isArray(investidor10?.companyInformation?.facts) ? investidor10.companyInformation.facts.length : 0;
  const shareholdingRows = Array.isArray(investidor10?.shareholdingPosition?.rows) ? investidor10.shareholdingPosition.rows.length : 0;
  const source = 'Investidor10';
  const item = (id, title, count, payloadStatus, minimum = 1) => {
    const ok = Number(count) >= minimum;
    const status = ok ? 'OK' : (payloadStatus || 'EMPTY');
    return {
      id,
      title,
      source,
      status,
      count,
      requiredMinimum: minimum,
      ready: ok,
      message: ok
        ? 'Bloco com dados reais suficientes para renderização.'
        : 'Bloco sem dados reais suficientes; manter indisponível no APK, sem fallback simulado.'
    };
  };
  const sections = [
    item('balanceSheetStatement', 'Balanço patrimonial', balanceRows, investidor10?.balanceSheetStatement?.status, 2),
    item('revenueByRegion', 'Regiões onde gera receita', regionItems, investidor10?.revenueByRegion?.status, 1),
    item('revenueByBusiness', 'Negócios que geram receita', businessItems, investidor10?.revenueByBusiness?.status, 1),
    item('companyData', 'Dados sobre a empresa', companyDataFacts + companyDataPapers, investidor10?.companyData?.status, 1),
    item('companyInformation', 'Informações sobre a empresa', companyInformationFacts, investidor10?.companyInformation?.status, 1),
    item('shareholdingPosition', 'Posição acionária', shareholdingRows, investidor10?.shareholdingPosition?.status, 1)
  ];
  return {
    status: sections.every(section => section.ready) ? 'OK' : 'PARTIAL',
    sourcePolicy: 'Auditoria integrada dos checkpoints de ação; somente dados reais capturados do Investidor10 contam como ready.',
    sections,
    missing: sections.filter(section => !section.ready).map(section => section.id),
    readyCount: sections.filter(section => section.ready).length,
    totalCount: sections.length
  };
}

async function buildStockModalContractFresh(payload = {}) {
  const rawTicker = payload.ticker || payload.symbol || payload.q || '';
  const ticker = normalizeTicker(rawTicker);
  const stage = normalizeStockModalStage(payload);
  const fastMode = stage === 'fast';
  const recoveryTarget = stockSectionRecoveryTargets(payload);
  const timeoutMs = stockStageTimeoutMs(payload, fastMode ? 3800 : 14500);
  if (!ticker) {
    return { ok: false, status: 'ERROR', endpoint: 'asset/stock-modal', error: 'Informe ticker ou symbol do ativo.' };
  }
  const kind = classifyTicker(ticker);
  const explicitStockFamily = String(payload.resolvedFamily || payload.assetType || payload.assetClass || '').toLowerCase().includes('stock')
    || /A[CÇ][AÃ]O|ACAO|UNIT/i.test(String(payload.assetType || payload.assetClass || ''));
  if ((kind === 'FII' && !explicitStockFamily) || kind === 'ETF' || kind === 'BDR') {
    return {
      ok: true,
      status: 'NOT_STOCK',
      endpoint: 'asset/stock-modal',
      contract: 'StockAssetModalResponse',
      contractVersion: STOCK_MODAL_VERSION,
      ticker,
      symbol: ticker,
      assetType: kind,
      message: kind === 'FII'
        ? `${ticker} foi classificado como FII; use /api/v1/asset/fii-modal.`
        : `${ticker} foi classificado como ${kind}; o contrato atual cobre ações e units de ações.`
    };
  }

  const stockBundlePromise = fetchInvestidor10StockBundle(
    ticker,
    Math.min(timeoutMs, fastMode ? 3200 : 10500),
    { ...payload, mode: stage, stage }
  ).catch(error => ({ status: 0, error: error?.message || String(error), html: '', quickMetrics: {}, canonical: {}, returnsRows: [], name: ticker, apiStatus: [{ key: 'stockBundle', ok: false, error: error?.message || String(error), stage }] }));
  const oneDayHistoryPromise = fetchYahooHistory(ticker, {
      range: '1D',
      interval: '5m',
      timeoutMs: fastMode
        ? Math.min(2800, Math.max(1600, Number(payload.quoteTimeoutMs) || 2600))
        : Math.min(3800, Math.max(2500, Number(payload.quoteTimeoutMs) || 3800)),
      limit: 96,
      cache: true
    }).catch(error => ({ ok: false, points: [], error: error?.message || String(error) }));
  const yahooLogoPromise = fetchYahooLogo(ticker, { timeoutMs: Math.min(3800, Math.max(timeoutMs, 3800)), cache: true })
    .catch(error => ({ ok: false, logoUrl: '', error: error?.message || String(error), source: 'Yahoo Finance Quote API' }));
  const profitQuoteHistoryPromise = (!fastMode && (!recoveryTarget.targeted || recoveryTarget.sections.has('profitQuoteChart')))
    ? fetchYahooHistory(ticker, {
      range: '10Y',
      interval: '1mo',
      timeoutMs: Math.min(5200, Math.max(3200, timeoutMs)),
      limit: 160,
      cache: true
    }).catch(error => ({ ok: false, points: [], error: error?.message || String(error), source: 'Yahoo Finance Chart API' }))
    : Promise.resolve({ ok: false, points: [], deferred: true, source: 'Yahoo Finance Chart API' });
  const investidor10Task = fastMode
    ? settleFastModalSource(stockBundlePromise, 2500, {
      status: 202,
      cacheStatus: 'SOURCE_WARMING',
      error: '',
      html: '',
      quickMetrics: {},
      canonical: {},
      returnsRows: [],
      name: ticker,
      stage: 'fast',
      deferred: true,
      apiStatus: [{ key: 'stockBundle', status: 202, ok: true, deferred: true, stage: 'fast' }]
    })
    : stockBundlePromise;
  const oneDayHistoryTask = fastMode
    ? settleFastModalSource(oneDayHistoryPromise, 2700, { ok: false, points: [], stage: 'fast', deferred: true, error: 'fast_preview_deferred' })
    : oneDayHistoryPromise;
  const yahooLogoTask = fastMode
    ? settleFastModalSource(yahooLogoPromise, 2200, { ok: false, logoUrl: '', stage: 'fast', deferred: true, source: 'Yahoo Finance Quote API' })
    : yahooLogoPromise;
  const wantsIndexComparison = !recoveryTarget.targeted || recoveryTarget.sections.has('indexComparison');
  const stockIndexComparisonPromise = fastMode || !wantsIndexComparison
    ? Promise.resolve(deferredStockIndexComparison(ticker))
    : buildStockIndexComparison(ticker, timeoutMs)
      .catch(error => ({ id: 'stock_asset_vs_indices_selector', title: `Comparação de ${ticker} com índices`, status: 'ERROR', error: error?.message || String(error), periods: STOCK_COMPARISON_PERIODS, series: [], items: [], seriesByPeriod: {}, itemsByPeriod: {} }));
  const stockIndexComparisonTask = fastMode || !wantsIndexComparison
    ? stockIndexComparisonPromise
    : recoveryTarget.targeted
      ? stockIndexComparisonPromise
      : settleFastModalSource(
        stockIndexComparisonPromise,
        Math.min(7600, Math.max(5200, timeoutMs - 2500)),
        deferredStockIndexComparison(ticker)
      );

  const [investidor10, oneDayHistory, oneYearHistory, indexComparison, yahooLogo, profitQuoteHistory] = await Promise.all([
    investidor10Task,
    oneDayHistoryTask,
    fastMode
      ? Promise.resolve({ ok: false, points: [], stage: 'fast', deferred: true })
      : fetchYahooHistory(ticker, {
        range: '1Y',
        interval: '1d',
        timeoutMs: Math.min(3800, timeoutMs),
        limit: 370,
        cache: true
      }).catch(error => ({ ok: false, points: [], error: error?.message || String(error) })),
    stockIndexComparisonTask,
    yahooLogoTask,
    profitQuoteHistoryPromise
  ]);
  const commodityComparison = emptyStockCommodityComparison(ticker);
  if (!fastMode && !(investidor10?.profitQuoteChart?.points || []).length) {
    investidor10.profitQuoteChart = buildStockProfitQuoteChartPayload({
      ticker,
      canonical: investidor10?.canonical || {},
      quoteHistory: profitQuoteHistory || {},
      revenueProfitChart: investidor10?.revenueProfitChart || null
    });
  }

  const chartPoints = (oneDayHistory?.points || []).map(chartPointFromYahoo).filter(Boolean);
  const chartStats = chartSummary(chartPoints);
  const yahooPrice = finiteNumberOrNull(oneDayHistory?.regularMarketPrice)
    ?? finiteNumberOrNull(oneDayHistory?.meta?.regularMarketPrice)
    ?? finiteNumberOrNull(chartPoints.at(-1)?.close);
  const chartVariation = finiteNumberOrNull(chartStats.variationPercent);
  const yahooVariation = chartVariation === null ? null : round(chartVariation, 4);
  const rawQuick = investidor10?.quickMetrics || {};
  const rawFundamentalIndicators = investidor10?.fundamentalIndicators || extractInvestidor10StockFundamentalIndicators('', ticker, rawQuick);
  const quick = enrichStockQuickMetrics(rawQuick, rawFundamentalIndicators, ticker);
  const fundamentalIndicators = rawFundamentalIndicators;
  const resolvedPrice = yahooPrice ?? finiteNumberOrNull(quick.price);
  const resolvedPriceDisplay = resolvedPrice === null ? (quick.priceDisplay || '—') : formatMoney(resolvedPrice);
  const variation12m = finiteNumberOrNull(quick.variation12mPercent);
  const returnsRows = investidor10?.returnsRows || [];
  const returnsSource = 'Investidor10';
  const variation12mFromReturns = returnsRows.find(row => /^(?:1y|1_ano|1 ano)$/i.test(String(row.key || row.label || '').replace(/\s+/g, '_')))?.returnPercent;
  const variation12mFromYahoo = performanceFromHistory(oneYearHistory);
  const resolvedVariation12m = variation12m
    ?? finiteNumberOrNull(variation12mFromReturns)
    ?? finiteNumberOrNull(variation12mFromYahoo);
  const resolvedVariation12mDisplay = quick.variation12mDisplay || (resolvedVariation12m === null ? '—' : formatPercent(resolvedVariation12m, true));
  const variation12mSource = variation12m !== null
    ? 'Investidor10'
    : (finiteNumberOrNull(variation12mFromReturns) !== null ? returnsSource : 'Yahoo Finance Chart API');
  const name = investidor10?.name || ticker;
  const resolvedLogoUrl = yahooLogo?.logoUrl || investidor10?.companyProfile?.logoUrl || '';
  const metrics = [
    metricCard('price', 'Cotação', resolvedPriceDisplay, resolvedPrice, yahooPrice !== null ? 'Yahoo Finance Chart API' : 'Investidor10'),
    metricCard('variation_12m', 'Variação (12M)', resolvedVariation12mDisplay, resolvedVariation12m, variation12mSource),
    metricCard('pl', 'P/L', quick.plDisplay || (finiteNumberOrNull(quick.pl) === null ? '—' : formatNumber(quick.pl, 2)), finiteNumberOrNull(quick.pl), 'Investidor10'),
    metricCard('pvp', 'P/VP', quick.pvpDisplay || (finiteNumberOrNull(quick.pvp) === null ? '—' : formatNumber(quick.pvp, 2)), finiteNumberOrNull(quick.pvp), 'Investidor10'),
    metricCard('dy', 'DY', quick.dyDisplay || (finiteNumberOrNull(quick.dy) === null ? '—' : formatPercent(quick.dy)), finiteNumberOrNull(quick.dy), 'Investidor10')
  ];
  const hasInvestidor10Data = Boolean(metrics.some(item => item.value && item.value !== '—' && item.source === 'Investidor10') || returnsRows.some(row => row.source === 'Investidor10') || (fundamentalIndicators?.items || []).length);
  const status = hasInvestidor10Data || chartPoints.length > 1 ? 'OK' : 'PARTIAL';
  const sectionReadiness = buildStockModalSectionReadiness({ investidor10 });
  return {
    ok: true,
    status,
    endpoint: 'asset/stock-modal',
    contract: 'StockAssetModalResponse',
    contractVersion: STOCK_MODAL_VERSION,
    version: RELEASE.version,
    patch: RELEASE.patch,
    ticker,
    symbol: ticker,
    assetType: kind === 'ACAO_UNIT' ? 'ACAO_UNIT' : 'ACAO',
    name,
    updatedAt: new Date().toISOString(),
    stage,
    mode: stage,
    fullOnly: !fastMode,
    progressive: true,
    sourcePolicy: 'Modal único de ações com política sem substituição estática: dados financeiros, fundamentalistas, proventos, comparador, regiões/negócios, posição acionária, resultados e balanço só são preenchidos quando vierem da fonte real capturada para o ticker solicitado. O gráfico/cotação e a comparação com índices usam fontes vivas definidas no contrato; quando a fonte real não entrega o bloco, o status fica EMPTY/ERROR em vez de usar dados de exemplo.',
    sources: [
      { id: 'investidor10_acoes_html', role: 'cards_rapidos_indicadores_fundamentalistas_checklist_dividendos_radar_payout_comparador_acoes_sobre_empresa_informacoes_empresa_posicao_acionaria_receitas_regioes_negocios_receitas_lucros_lucro_cotacao_balanco_comunicados_rentabilidade_nominal_real' },
      { id: 'yahoo_chart', role: 'cotacao_tempo_real_apenas_sem_fundamentos' },
      { id: 'bcb_ipca', role: 'comparacao_ipca' },
      { id: 'bcb_cdi', role: 'comparacao_cdi' },
      { id: 'yahoo_indices', role: 'comparacao_indices_ifix_idiv_smll_ibov_ivvb11' }
    ],
    quoteSummary: {
      ticker,
      name,
      logoUrl: resolvedLogoUrl,
      logoSource: yahooLogo?.logoUrl ? 'Yahoo Finance Quote API' : (investidor10?.companyProfile?.logoUrl ? investidor10.companyProfile.source || 'Investidor10' : ''),
      price: resolvedPrice === null ? null : round(resolvedPrice, 4),
      priceDisplay: resolvedPriceDisplay,
      changePercent: yahooVariation ?? finiteNumberOrNull(quick.changePercent),
      changeDisplay: yahooVariation === null ? (quick.changeDisplay || '') : formatPercent(yahooVariation, true),
      variation12mPercent: resolvedVariation12m === null ? null : round(resolvedVariation12m, 4),
      variation12mDisplay: resolvedVariation12mDisplay,
      pl: finiteNumberOrNull(quick.pl) === null ? null : round(finiteNumberOrNull(quick.pl), 4),
      pvp: finiteNumberOrNull(quick.pvp) === null ? null : round(finiteNumberOrNull(quick.pvp), 4),
      dy: finiteNumberOrNull(quick.dy) === null ? null : round(finiteNumberOrNull(quick.dy), 4),
      source: yahooPrice !== null ? 'Yahoo Finance Chart API' : 'Investidor10'
    },
    metrics,
    fundamentalIndicators,
    historicalIndicators: investidor10?.historicalIndicators || buildStockHistoricalIndicators({}, ticker, fundamentalIndicators),
    checklist: investidor10?.checklist || emptyStockBuyHoldChecklist(ticker, { reason: 'unavailable' }),
    dividendHistory: investidor10?.dividendHistory || buildStockDividendHistoryPayload({ ticker }),
    dividendRadar: investidor10?.dividendRadar || buildStockDividendRadarPayload({ ticker, dividendHistory: investidor10?.dividendHistory || {} }),
    payoutChart: investidor10?.payoutChart || buildStockPayoutChartPayload({ ticker, historicalIndicators: investidor10?.historicalIndicators || {}, dividendHistory: investidor10?.dividendHistory || {} }),
    peerComparison: investidor10?.peerComparison || extractInvestidor10StockPeerComparison('', ticker, quick, fundamentalIndicators),
    indexComparison,
    commodityComparison,
    companyProfile: {
      ...withResolvedStockCompanyProfile(investidor10?.companyProfile || extractStockCompanyProfile('', ticker, name, quick, fundamentalIndicators), {
        priceDisplay: resolvedPrice === null ? '' : resolvedPriceDisplay,
        variation12mDisplay: resolvedVariation12m === null ? '' : resolvedVariation12mDisplay
      }),
      logoUrl: resolvedLogoUrl,
      logoSource: yahooLogo?.logoUrl ? 'Yahoo Finance Quote API' : (investidor10?.companyProfile?.logoUrl ? investidor10.companyProfile.source || 'Investidor10' : '')
    },
    companyData: investidor10?.companyData || extractStockCompanyData('', ticker, name),
    companyInformation: investidor10?.companyInformation || extractStockCompanyInformation('', ticker),
    revenueByRegion: investidor10?.revenueByRegion || buildStockRevenueBreakdownPayload({ ticker, name }, 'region'),
    revenueByBusiness: investidor10?.revenueByBusiness || buildStockRevenueBreakdownPayload({ ticker, name }, 'business'),
    stockRevenueByRegion: investidor10?.revenueByRegion || buildStockRevenueBreakdownPayload({ ticker, name }, 'region'),
    stockRevenueByBusiness: investidor10?.revenueByBusiness || buildStockRevenueBreakdownPayload({ ticker, name }, 'business'),
    shareholdingPosition: investidor10?.shareholdingPosition || buildStockShareholdingPayload({ ticker }),
    revenueProfitChart: investidor10?.revenueProfitChart || buildStockRevenueProfitChartPayload({ ticker }),
    profitQuoteChart: investidor10?.profitQuoteChart || buildStockProfitQuoteChartPayload({ ticker }),
    resultsStatement: investidor10?.resultsStatement || buildStockResultsStatementPayload({ ticker, fundamentalIndicators, historicalIndicators: investidor10?.historicalIndicators || {} }),
    balanceSheetStatement: investidor10?.balanceSheetStatement || buildStockBalanceSheetStatementPayload({ ticker }),
    announcements: investidor10?.announcements || emptyStockAnnouncements(ticker, { reason: 'unavailable' }),
    equityEvolutionChart: investidor10?.equityEvolutionChart || buildStockEquityEvolutionChartPayload({ ticker }),
    chart: {
      id: 'stock_realtime_price_history',
      title: `Cotação ${ticker}`,
      range: oneDayHistory?.range || '1D',
      interval: oneDayHistory?.interval || '5m',
      currency: oneDayHistory?.currency || 'BRL',
      source: 'Yahoo Finance Chart API',
      points: chartPoints,
      summary: chartStats,
      warning: oneDayHistory?.error || undefined
    },
    returns: {
      title: `Rentabilidade de ${ticker}`,
      rows: returnsRows,
      nominalSource: returnsSource,
      inflationSource: returnsSource === 'Investidor10' ? 'Investidor10' : 'Banco Central IPCA'
    },
    sectionReadiness,
    diagnostics: {
      stage,
      fastMode,
      sectionReadiness,
      investidor10Status: investidor10?.status || 0,
      investidor10CacheStatus: investidor10?.cacheStatus,
      investidor10Url: investidor10?.url || `https://investidor10.com.br/acoes/${ticker.toLowerCase()}/`,
      investidor10Error: investidor10?.error || '',
      quickMetrics: Object.keys(quick).sort(),
      identityOk: Boolean(investidor10?.identityOk),
      identityDiagnostics: investidor10?.identityDiagnostics || undefined,
      quoteSource: yahooPrice !== null ? 'Yahoo Finance Chart API' : 'Investidor10',
      yahooLogoStatus: yahooLogo?.ok ? 'OK' : (yahooLogo?.error ? 'ERROR' : 'EMPTY'),
      yahooLogoUrl: yahooLogo?.logoUrl || '',
      variation12mSource,
      fundamentalIndicators: (fundamentalIndicators?.items || []).length,
      fundamentalGroups: (fundamentalIndicators?.groups || []).length,
      historicalIndicatorRows: (investidor10?.historicalIndicators?.rows || []).length,
      historicalIndicatorPeriods: (investidor10?.historicalIndicators?.periods || []).length,
      historicalIndicatorsStatus: investidor10?.historicalIndicators?.status || 'EMPTY',
      checklistItems: (investidor10?.checklist?.items || []).length,
      checklistPassed: investidor10?.checklist?.passed || 0,
      checklistRankingScore: investidor10?.buyHoldRanking?.score ?? null,
      dividendHistoryStatus: investidor10?.dividendHistory?.status || 'EMPTY',
      dividendHistoryEvents: (investidor10?.dividendHistory?.events || []).length,
      dividendHistoryYieldYearly: (investidor10?.dividendHistory?.yieldSeriesByFrequency?.yearly || []).length,
      dividendRadarMonths: (investidor10?.dividendRadar?.months || []).filter(month => month.activeDateCom || month.activePayment).length,
      payoutChartPoints: (investidor10?.payoutChart?.points || []).length,
      peerComparisonRows: (investidor10?.peerComparison?.rows || []).length,
      indexComparisonStatus: indexComparison?.status || 'EMPTY',
      commodityComparisonStatus: 'REMOVED',
      companyProfileSections: (investidor10?.companyProfile?.sections || []).length,
      companyDataFacts: (investidor10?.companyData?.facts || []).length,
      companyDataPapers: (investidor10?.companyData?.companyPapers || []).length + (investidor10?.companyData?.fractionalPapers || []).length,
      companyInformationFacts: (investidor10?.companyInformation?.facts || []).length,
      revenueByRegionItems: (investidor10?.revenueByRegion?.items || []).length,
      revenueByBusinessItems: (investidor10?.revenueByBusiness?.items || []).length,
      shareholdingRows: (investidor10?.shareholdingPosition?.rows || []).length,
      revenueProfitPoints: (investidor10?.revenueProfitChart?.points || []).length,
      profitQuotePoints: (investidor10?.profitQuoteChart?.points || []).length,
      investidor10ApiCalls: (investidor10?.apiStatus || []).length,
      investidor10ApiOk: (investidor10?.apiStatus || []).filter(item => item.ok).length,
      resultsStatementRows: (investidor10?.resultsStatement?.rows || []).length,
      balanceSheetRows: (investidor10?.balanceSheetStatement?.rows || []).length,
      announcementsItems: (investidor10?.announcements?.items || []).length,
      announcementPdfLinks: (investidor10?.announcements?.items || []).filter?.(item => item.pdfUrl)?.length || 0,
      equityEvolutionPoints: (investidor10?.equityEvolutionChart?.points || []).length,
      chartOk: chartPoints.length > 1,
      returnsRows: returnsRows.length,
      returnsSource
    }
  };
}

function normalizeStockModalPayload(payload = {}, defaultTimeoutMs = 12000) {
  const stage = normalizeStockModalStage(payload);
  const timeoutMs = stockStageTimeoutMs(payload, stage === 'fast' ? 3800 : defaultTimeoutMs);
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

export async function buildStockModalContract(payload = {}) {
  const modalPayload = normalizeStockModalPayload(payload, 12000);
  const rawTicker = modalPayload.ticker || modalPayload.symbol || modalPayload.q || '';
  const ticker = normalizeTicker(rawTicker);
  return withAssetModalRuntime({
    family: 'stock',
    ticker,
    payload: modalPayload,
    ttlMs: modalPayload.stage === 'fast' ? 35_000 : 180_000,
    staleMs: modalPayload.stage === 'fast' ? 2 * 60 * 1000 : 15 * 60 * 1000,
    producer: () => buildStockModalContractFresh(modalPayload)
  });
}

export const _test = {
  STOCK_MODAL_VERSION,
  STOCK_MODAL_PERIODS,
  normalizeStockModalStage,
  stockStageTimeoutMs,
  deferredStockIndexComparison,
  extractInvestidor10StockQuickMetrics,
  extractInvestidor10StockFundamentalIndicators,
  returnsRowsFromInvestidor10Profitability,
  chartPointFromYahoo,
  chartSummary,
  accumulatedIpcaPercent,
  realReturnPercent,
  compactKey,
  STOCK_FUNDAMENTAL_SPECS,
  STOCK_FUNDAMENTAL_GROUPS,
  buildStockHistoricalIndicators,
  normalizeStockHistoricalIndicatorsApi,
  normalizeStockHistoricalIndicatorsDataset,
  extractInvestidor10StockHistoricalIndicatorsFromHtml,
  collectStockHistoricalIndicatorCandidates,
  buildStockHistoricalIndicatorSources,
  stockHistoricalIndicatorEndpointCandidates,
  stockRevenueApiEndpointCandidates,
  extractInvestidor10ScriptUrls,
  discoverInvestidor10StockRevenueApiUrlsFromText,
  normalizeInvestidor10ApiUrlTemplate,
  revenueRowsExistInRawJson,
  fetchInvestidor10StockRevenueSourcesFromScripts,
  fetchMissingInvestidor10StockRevenueSources,
  fetchInvestidor10StockHistoricalIndicatorsRaw,
  extractInvestidor10StockBuyHoldChecklist,
  emptyStockBuyHoldChecklist,
  STOCK_BUY_HOLD_CHECKLIST_CRITERIA,
  buildStockDividendHistoryPayload,
  buildStockDividendRadarPayload,
  buildStockPayoutChartPayload,
  normalizeStockPayoutDedicatedSource,
  stockPayoutNumeric,
  extractStockPayoutCurrentNetIncomeFromHtml,
  extractStockDividendEventsFromHtml,
  extractInvestidor10StockPeerComparison,
  buildStockIndexComparison,
  buildStockCommodityComparison,
  extractStockCompanyProfile,
  extractStockCompanyData,
  extractStockCompanyInformation,
  stockCompanyInformationValuesFromSlice,
  buildStockRevenueBreakdownPayload,
  parseStockRevenueRowsFromSection,
  stockRevenueSearchableText,
  stockRevenueSectionBetweenPlain,
  extractInvestidor10StockEmbeddedAnalysisData,
  rowsFromRevenueCandidate,
  chartJsRevenueRowsFromCandidate,
  highchartsRevenueRowsFromCandidate,
  normalizeRevenueChartEntries,
  pickRevenueLabelsFromCandidate,
  pickRevenueSeriesValuesFromCandidate,
  revenueTotalNumberFromCandidate,
  looksLikeInvalidStockRevenueLabel,
  revenueYearFromCandidate,
  tupleRevenueRowsFromCandidate,
  objectMapRevenueRowsFromCandidate,
  buildStockShareholdingPayload,
  buildStockModalSectionReadiness,
  parseStockShareholdingRowsFromSection,
  rowsFromShareholdingCandidate,
  extractStockShareholdingJsonCandidatesFromHtml,
  buildStockRevenueProfitChartPayload,
  buildStockProfitQuoteChartPayload,
  buildStockResultsStatementPayload,
  buildStockBalanceSheetStatementPayload,
  extractInvestidor10StockAnnouncements,
  buildStockAnnouncementsPayload,
  emptyStockAnnouncements,
  buildStockEquityEvolutionChartPayload,
  extractInvestidor10StockIdsFromPayload,
  resolveInvestidor10StockIds,
  getCachedStockIds,
  cacheStockIds,
  stockSectionRecoveryTargets,
  stockApiKeyNeededForTargets,
  annualYahooQuoteMap,
  parseStockBuyHoldRankingRowFromPlain,
  parseStockBuyHoldRankingRowFromHtml,
  deriveStockChecklistStatusFromInvestidor10,
  extractStockChecklistCompanyFacts,
  stockChecklistProfitEvidence
};
