import { classifyTicker, normalizeTicker } from '../core/tickers.js';
import { round } from '../core/numbers.js';
import { fetchYahooHistory, fetchYahooQuote } from '../market/yahoo.js';
import { fetchText } from '../sources/fetch.js';
import { getAssetHistory } from '../sources/asset-details.js';
import { getIpcaSeries } from '../sources/ipca.js';
import { getCdiAccumulatedSeries } from '../sources/cdi.js';
import { buildInvestidor10CanonicalCharts, discoverInvestidor10ChartApiUrls, extractInvestidor10ChartIds } from '../market/investidor10-chart-extractor.js';
import { RELEASE } from '../core/release.js';

export const STOCK_MODAL_VERSION = '26.asset-modal.stock.v23';

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

function parseBrNumber(value = '') {
  const raw = String(value || '')
    .replace(/R\$/gi, '')
    .replace(/%/g, '')
    .replace(/\b(?:Bilhões|Bilhoes|Bilhão|Bilhao|Milhões|Milhoes|Milhão|Milhao|mi|M|bi|B|mil|K)\b/gi, '')
    .replace(/\s+/g, '')
    .trim();
  if (!raw || raw === '-' || raw === '—') return null;
  const normalized = raw.includes(',') ? raw.replace(/\./g, '').replace(',', '.') : raw;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
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
  const combined = `${normalizeLooseText(rawWindow)} ${normalizeLooseText(plainWindow)}`;
  if (/\b(?:nao atende|reprovado|reprovada|falhou|negativo|unchecked|uncheck|not checked|check box outline blank|close|cancel|times|xmark|false)\b/.test(combined)) return false;
  if (/\b(?:check circle|check_circle|check box|checked|aprovado|aprovada|atende|positivo|done|true|sim)\b/.test(combined) || /✓|✔/.test(rawWindow)) return true;
  if (criterionId === 'never_loss_fiscal') return null;
  return undefined;
}

function extractStockChecklistDisclaimer(section = '') {
  const normalized = cleanText(section).replace(/\s{2,}/g, ' ');
  const match = normalized.match(/Esta ferramenta de checklist[\s\S]{0,620}?(?:clique aqui\s*\.|clique aqui\.|futuros\.|futuro\.|$)/i);
  return cleanText(match?.[0] || '').replace(/\s{2,}/g, ' ').slice(0, 640);
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
  const value = Number.isFinite(Number(valueRaw)) ? Number(valueRaw) : parseBrNumber(valueRaw);
  const dataCom = String(dataComRaw).includes('/') ? parseBrDateToIso(dataComRaw) : String(dataComRaw || '').slice(0, 10);
  const paymentDate = String(paymentRaw).includes('/') ? parseBrDateToIso(paymentRaw) : String(paymentRaw || '').slice(0, 10);
  if (!dataCom && !paymentDate && !Number.isFinite(Number(value))) return null;
  const valueDisplay = raw.valueDisplay || raw.amountDisplay || raw.valorDisplay || (Number.isFinite(Number(value)) ? String(value).replace('.', ',') : '—');
  return {
    ticker: String(raw.ticker || ticker || '').toUpperCase(),
    type,
    dataCom,
    dataComDisplay: formatBrDateDisplay(dataComRaw || dataCom),
    paymentDate,
    paymentDateDisplay: formatBrDateDisplay(paymentRaw || paymentDate),
    value: Number.isFinite(Number(value)) ? round(Number(value), 8) : null,
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
    yieldPercent: Number.isFinite(Number(raw.yieldPercent ?? raw.dy ?? raw.dividendYield)) ? round(Number(raw.yieldPercent ?? raw.dy ?? raw.dividendYield), 6) : undefined,
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
    const value = Number(source?.[key]);
    if (Number.isFinite(value)) return value;
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
    diagnostics: { points: points.length }
  };
}

function buildStockProfitQuoteChartPayload({ ticker = '', canonical = {} } = {}) {
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
    diagnostics: { points: points.length }
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
    diagnostics: { points: points.length }
  };
}

function buildStockPayoutChartPayload({ ticker = '', canonical = {}, historicalIndicators = {}, dividendHistory = {} } = {}) {
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
  const years = new Set([...profitByYear.keys(), ...payoutByYear.keys(), ...dyByYear.keys(), ...Object.keys(payoutValues).filter(key => /^\d{4}$/.test(key)), ...Object.keys(dyValues).filter(key => /^\d{4}$/.test(key))]);
  const orderedYears = Array.from(years).filter(year => /^\d{4}$/.test(year)).sort((a, b) => Number(a) - Number(b));
  const points = orderedYears.map(year => {
    const netIncome = profitByYear.get(year);
    const payout = payoutByYear.has(year) ? payoutByYear.get(year) : numberFromHistoricalValue(payoutValues[year]);
    const dy = dyByYear.has(year) ? dyByYear.get(year) : numberFromHistoricalValue(dyValues[year]);
    return {
      period: year,
      label: year,
      year: Number(year),
      netIncome: Number.isFinite(netIncome) ? round(netIncome, 4) : null,
      netIncomeDisplay: Number.isFinite(netIncome) ? formatMoneyAbbrev(netIncome) : '—',
      payoutPercent: Number.isFinite(Number(payout)) ? round(Number(payout), 4) : null,
      payoutDisplay: Number.isFinite(Number(payout)) ? formatPercent(Number(payout)) : '—',
      dividendYieldPercent: Number.isFinite(Number(dy)) ? round(Number(dy), 4) : null,
      dividendYieldDisplay: Number.isFinite(Number(dy)) ? formatPercent(Number(dy)) : '—',
      source: `Investidor10 Payout de ${String(ticker || '').toUpperCase() || 'ação'}`
    };
  }).filter(point => point.netIncome !== null || point.payoutPercent !== null || point.dividendYieldPercent !== null);

  if (payoutValues.Atual || payoutValues.atual || dyValues.Atual || dyValues.atual) {
    const payout = numberFromHistoricalValue(payoutValues.Atual || payoutValues.atual || '');
    const dy = numberFromHistoricalValue(dyValues.Atual || dyValues.atual || '');
    const latestProfit = [...profitByYear.entries()].sort((a, b) => Number(b[0]) - Number(a[0]))[0]?.[1];
    points.push({
      period: 'last_12m',
      label: 'Últ 12M',
      year: null,
      netIncome: Number.isFinite(Number(latestProfit)) ? round(Number(latestProfit), 4) : null,
      netIncomeDisplay: Number.isFinite(Number(latestProfit)) ? formatMoneyAbbrev(latestProfit) : '—',
      payoutPercent: Number.isFinite(Number(payout)) ? round(Number(payout), 4) : null,
      payoutDisplay: Number.isFinite(Number(payout)) ? formatPercent(Number(payout)) : '—',
      dividendYieldPercent: Number.isFinite(Number(dy)) ? round(Number(dy), 4) : null,
      dividendYieldDisplay: Number.isFinite(Number(dy)) ? formatPercent(Number(dy)) : '—',
      source: `Investidor10 Payout de ${String(ticker || '').toUpperCase() || 'ação'}`
    });
  }

  return {
    id: 'stock_payout_chart',
    title: `Payout de ${String(canonical?.name || canonical?.company?.name || String(ticker || '').toUpperCase() || 'ação').replace(/\s*\([^)]*\)\s*/g, '').trim() || String(ticker || '').toUpperCase()}`,
    ticker: String(ticker || '').toUpperCase(),
    status: points.length ? 'OK' : 'EMPTY',
    source: 'Investidor10 Payout histórico',
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
    diagnostics: { points: points.length, payoutHistory: payoutHistory.length, profitPoints: profitByYear.size }
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
  const currentDyDisplay = quickMetrics.dyDisplay || dyItem?.value || (Number.isFinite(Number(quickMetrics.dy)) ? formatPercent(Number(quickMetrics.dy)) : '—');
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
    currentDy: Number.isFinite(Number(quickMetrics.dy)) ? round(Number(quickMetrics.dy), 4) : (Number.isFinite(Number(dyItem?.numericValue)) ? round(Number(dyItem.numericValue), 4) : null),
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
      const elementStart = Math.max(0, rawHtmlSection.lastIndexOf('<', rawIdx));
      const closeStart = rawHtmlSection.indexOf('</', rawIdx);
      const closeEnd = closeStart >= 0 ? rawHtmlSection.indexOf('>', closeStart) + 1 : -1;
      rawWindow = closeEnd > elementStart
        ? rawHtmlSection.slice(elementStart, closeEnd)
        : rawHtmlSection.slice(Math.max(0, rawIdx - 80), Math.min(rawHtmlSection.length, rawIdx + bestVariant.length + 60));
    }
    const explicit = detectStockChecklistPassed(rawWindow, plainWindow, criterion.id);
    // Política sem simulação: o checklist da ação deve refletir a marcação pública do
    // Investidor10. Métricas do modal não substituem o estado do checkbox; quando a
    // marcação visual não estiver disponível no HTML, o item permanece não informado.
    const passed = explicit !== undefined ? explicit : null;
    items.push({
      id: criterion.id,
      label: criterion.label,
      passed,
      status: statusCodeFromPassed(passed),
      statusLabel: statusLabelFromPassed(passed),
      help: criterion.help,
      source: 'Investidor10 checklist buy and hold',
      sourceUrl: symbol ? `https://investidor10.com.br/acoes/${symbol.toLowerCase()}/` : undefined
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
    diagnostics: { found: true, criteriaFound: items.length, policy: 'no_static_substitution' }
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
  const n = Number(String(rawValue).replace(/\./g, '').replace(',', '.'));
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
  pvp: 'P/VP',
  p_vp: 'P/VP',
  p_receita_psr: 'P/Receita (PSR)',
  p_receita: 'P/Receita (PSR)',
  psr: 'P/Receita (PSR)',
  dividend_yield: 'Dividend Yield',
  dy: 'Dividend Yield',
  payout: 'Payout',
  margem_liquida: 'Margem Líquida',
  margem_bruta: 'Margem Bruta',
  margem_ebit: 'Margem Ebit',
  margem_ebitda: 'Margem Ebitda',
  margem_ebtida: 'Margem Ebitda',
  ev_ebitda: 'EV/Ebitda',
  ev_ebit: 'EV/Ebit',
  p_ebitda: 'P/Ebitda',
  p_ebit: 'P/Ebit',
  p_ativo: 'P/Ativo',
  p_cap_giro: 'P/Cap.Giro',
  p_ativo_circ_liq: 'P/Ativo Circ. Liq.',
  vpa: 'VPA',
  lpa: 'LPA',
  giro_ativos: 'Giro Ativos',
  roe: 'ROE',
  roic: 'ROIC',
  roa: 'ROA',
  divida_liquida_patrimonio: 'Dívida Líquida / Patrimônio',
  divida_liquida_ebitda: 'Dívida Líquida / Ebitda',
  divida_liquida_ebit: 'Dívida Líquida / Ebit',
  divida_bruta_patrimonio: 'Dívida Bruta / Patrimônio',
  patrimonio_ativos: 'Patrimônio / Ativos',
  passivos_ativos: 'Passivos / Ativos',
  liquidez_corrente: 'Liquidez Corrente',
  cagr_receitas_5_anos: 'CAGR Receitas 5 anos',
  cagr_lucros_5_anos: 'CAGR Lucros 5 anos'
});

function canonicalStockHistoricalLabel(label = '') {
  const raw = cleanText(label);
  const key = raw.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\//g, ' ').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  return STOCK_HISTORICAL_LABELS[key] || raw.replace(/\s+/g, ' ').trim();
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

function normalizeStockHistoricalIndicatorsDataset(data) {
  if (!data || typeof data !== 'object') return { columns: [], rows: [], status: 'EMPTY' };
  const columns = [];
  const rows = [];
  const pushColumn = (col) => {
    const normalized = cleanText(String(col || '')).trim();
    if (normalized && !columns.includes(normalized)) columns.push(normalized);
    return normalized;
  };
  const pushRow = (label, values = {}, source = 'Investidor10') => {
    const canonical = canonicalStockHistoricalLabel(label);
    if (!canonical || !Object.keys(values).length) return;
    rows.push({ id: metricId(canonical), label: canonical, values, source });
  };
  const processRowObject = (label, rawValues, source = 'Investidor10') => {
    const values = {};
    if (Array.isArray(rawValues)) {
      for (const item of rawValues) {
        const period = item?.period || item?.year || item?.ano || item?.label || item?.date || item?.data;
        const col = pushColumn(period || 'Atual');
        values[col] = formatIndicatorHistoryValue(item?.display ?? item?.formatted ?? item?.value ?? item?.valor ?? item, item?.type || item?.unit || '');
      }
    } else if (rawValues && typeof rawValues === 'object') {
      for (const [period, rawValue] of Object.entries(rawValues)) {
        if (!/^atual$/i.test(period) && !/^\d{4}$/.test(String(period))) continue;
        const col = pushColumn(period);
        values[col] = formatIndicatorHistoryValue(rawValue?.display ?? rawValue?.formatted ?? rawValue?.value ?? rawValue?.valor ?? rawValue, rawValue?.type || rawValue?.unit || '');
      }
    }
    pushRow(label, values, source);
  };

  const categoryCandidates = [data?.categories, data?.labels, data?.years, data?.anos, data?.periods, data?.xAxis?.categories, data?.xaxis?.categories, data?.options?.xaxis?.categories].filter(Array.isArray);
  const categories = categoryCandidates.find(list => list.length) || [];
  const seriesCandidate = Array.isArray(data?.series) ? data.series : (Array.isArray(data?.datasets) ? data.datasets : []);
  if (categories.length && seriesCandidate.length) {
    for (const series of seriesCandidate) {
      const label = series?.name || series?.label || series?.title || series?.key;
      const dataValues = Array.isArray(series?.data) ? series.data : (Array.isArray(series?.values) ? series.values : []);
      if (!label || !dataValues.length) continue;
      const values = {};
      dataValues.forEach((rawValue, index) => {
        const col = pushColumn(categories[index] || `P${index + 1}`);
        values[col] = formatIndicatorHistoryValue(rawValue?.display ?? rawValue?.formatted ?? rawValue?.value ?? rawValue?.y ?? rawValue, rawValue?.type || rawValue?.unit || series?.unit || '');
      });
      pushRow(label, values, series?.source || 'Investidor10 indicadores chart API');
    }
  }

  if (Array.isArray(data)) {
    for (const row of data) {
      const label = row?.label || row?.indicador || row?.indicator || row?.name || row?.key;
      processRowObject(label, row?.values || row?.valores || row?.data || row, row?.source || 'Investidor10');
    }
  } else if (Array.isArray(data.rows) || Array.isArray(data.linhas) || Array.isArray(data.items)) {
    (data.columns || data.colunas || []).forEach(pushColumn);
    for (const row of (data.rows || data.linhas || data.items || [])) {
      const label = row?.label || row?.indicador || row?.indicator || row?.name || row?.key;
      processRowObject(label, row?.values || row?.valores || row?.data || row, row?.source || 'Investidor10');
    }
  } else {
    const root = data.data && typeof data.data === 'object' ? data.data : data;
    for (const [label, rawValues] of Object.entries(root)) {
      if (['periods','selectedPeriod','selected','active','title','subtitle','source','status','tablesByPeriod','rows','linhas','items','columns','colunas'].includes(label)) continue;
      processRowObject(label, rawValues, root?.source || 'Investidor10');
    }
  }

  const sortedColumns = stockHistoryColumnOrder(columns);
  rows.sort((a, b) => stockHistoryRowOrderIndex(a.label) - stockHistoryRowOrderIndex(b.label) || a.label.localeCompare(b.label, 'pt-BR'));
  return { title: 'Histórico de indicadores fundamentalistas', columns: sortedColumns, rows, source: 'Investidor10', status: rows.length ? 'OK' : 'EMPTY' };
}

function stockHistoryPeriodKey(raw = '') {
  const value = String(raw || '').trim().toLowerCase();
  if (!value) return '';
  if (['5a','5 anos','5anos','5y','5 years','5_years'].includes(value)) return '5y';
  if (['10a','10 anos','10anos','10y','10 years','10_years'].includes(value)) return '10y';
  return value;
}



function buildStockHistoricalIndicators(rawHistory, ticker = '', fundamentalIndicators = {}) {
  const source = rawHistory?.data && typeof rawHistory.data === 'object' ? rawHistory.data : rawHistory;
  const tablesByPeriod = {};
  if (source && typeof source === 'object' && !Array.isArray(source)) {
    for (const [key, value] of Object.entries(source)) {
      const periodKey = stockHistoryPeriodKey(key);
      if (!['5y', '10y'].includes(periodKey)) continue;
      const normalized = normalizeStockHistoricalIndicatorsDataset(value);
      if ((normalized.rows || []).length) tablesByPeriod[periodKey] = normalized;
    }
  }
  if (!Object.keys(tablesByPeriod).length) {
    const single = normalizeStockHistoricalIndicatorsDataset(rawHistory || {});
    if ((single.rows || []).length) tablesByPeriod['5y'] = single;
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
  const seriesByPeriod = {};
  const itemsByPeriod = {};
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
  for (const period of STOCK_COMPARISON_PERIODS) {
    const yahooSeries = await Promise.all([
      stockComparisonSeries({ code: ticker, label: ticker, ticker, yahooSymbol: `${ticker}.SA`, period, timeoutMs: Math.min(6200, timeoutMs), primary: true }),
      ...STOCK_INDEX_BENCHMARKS.filter(item => item.yahooSymbol).map(item => stockComparisonSeries({ ...item, period, timeoutMs: Math.min(6200, timeoutMs) }))
    ]);
    const macro = [
      macroSeriesFromAccumulated({ code: 'CDI', label: 'CDI', points: cdi.points || cdi.series || [], period, source: cdi.source || 'BancoCentralSGS CDI' }),
      macroSeriesFromAccumulated({ code: 'IPCA', label: 'IPCA', points: ipca.points || ipca.series || [], period, source: ipca.source || 'BancoCentralSGS IPCA' })
    ];
    let series = [...yahooSeries, ...macro].filter(Boolean);
    series = sortSeries(series);
    const items = series.map(seriesItem => comparisonItemFromSeries(seriesItem, period.key, baseInvestment));
    // Mesmo formato do modal de FII: cada período é um objeto com series + items.
    // O APK também aceita o formato antigo em array para compatibilidade.
    seriesByPeriod[period.key] = { series, items };
    itemsByPeriod[period.key] = items;
  }
  const active = seriesByPeriod['5y'] || Object.values(seriesByPeriod)[0] || { series: [], items: [] };
  const indexQuotes = await Promise.all(STOCK_INDEX_BENCHMARKS.map(async item => {
    if (!item.yahooSymbol) return null;
    const quote = await fetchYahooQuote(item.yahooSymbol, { timeoutMs: Math.min(4200, timeoutMs), interval: item.code === 'IFIX' || item.code === 'SMLL' || item.code === 'IDIV' ? '1d' : '5m' }).catch(() => null);
    return {
      id: item.code.toLowerCase(),
      code: item.code,
      label: item.label,
      value: Number.isFinite(Number(quote?.price)) ? round(Number(quote.price), 4) : null,
      valueDisplay: Number.isFinite(Number(quote?.price)) ? formatNumber(Number(quote.price), 2) : '—',
      variationPercent: Number.isFinite(Number(quote?.variationPct)) ? round(Number(quote.variationPct), 4) : null,
      variationDisplay: Number.isFinite(Number(quote?.variationPct)) ? formatPercent(Number(quote.variationPct), true) : '—',
      yahooSymbol: item.yahooSymbol,
      source: item.source
    };
  }));
  return {
    id: 'stock_asset_vs_indices_selector',
    title: `Comparação de ${ticker} com índices`,
    subtitle: 'Ativo, IBOV, IFIX, CDI, IPCA, SMLL, IDIV e IVVB11; IFIX/IDIV/SMLL usam Yahoo direto conforme contrato informado.',
    status: (active.series || []).length >= 2 ? 'OK' : ((active.series || []).length ? 'PARTIAL' : 'EMPTY'),
    defaultPeriod: '5y',
    baseInvestment,
    baseInvestmentDisplay: formatMoney(baseInvestment),
    periods: STOCK_COMPARISON_PERIODS,
    series: active.series || [],
    items: active.items || [],
    seriesByPeriod,
    itemsByPeriod,
    indexQuotes: indexQuotes.filter(Boolean),
    selectorOptions: [{ code: ticker, label: ticker, required: true }, ...STOCK_INDEX_BENCHMARKS.map(item => ({ code: item.code, label: item.label, required: ['IBOV', 'IFIX'].includes(item.code) }))].map(item => ({ id: String(item.code).toLowerCase(), ...item })),
    source: 'Retorno/Proxy getAssetHistory + Yahoo Finance Chart API + Banco Central SGS',
    sourcePolicy: 'Comparação de ações com índices alinhada ao modal de FIIs: ativo, IBOV, IFIX, SMLL e IDIV tentam primeiro o mesmo getAssetHistory da página Retorno e depois Yahoo direto com faixas alternativas. CDI e IPCA usam Banco Central SGS. Sem fallback estático ou dado de exemplo.'
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
  if (!Number.isFinite(Number(quick.pl)) && Number.isFinite(Number(pl?.numericValue))) quick.pl = Number(pl.numericValue);
  if (!quick.pvpDisplay && pvp?.value) quick.pvpDisplay = pvp.value;
  if (!Number.isFinite(Number(quick.pvp)) && Number.isFinite(Number(pvp?.numericValue))) quick.pvp = Number(pvp.numericValue);
  if (!quick.dyDisplay && dy?.value) quick.dyDisplay = dy.value;
  if (!Number.isFinite(Number(quick.dy)) && Number.isFinite(Number(dy?.numericValue))) quick.dy = Number(dy.numericValue);
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
  const re = new RegExp(String.raw`([^$%]{2,96}?)\s+(${amountPattern})\s+(${pctPattern})`, 'gi');
  for (const match of source.matchAll(re)) {
    let label = cleanText(match[1])
      .replace(/^(?:REGI[ÕO]ES\s+ONDE\s+[^0-9]+|NEG[ÓO]CIOS\s+QUE\s+GERAM\s+[^0-9]+)\s*/i, '')
      .replace(/^(?:\d{4}\s*)+/, '')
      .replace(/^(?:Total\s*\([^)]+\)\s*)/i, '')
      .trim();
    const tailMatch = label.match(/([A-ZÁÉÍÓÚÂÊÔÃÕÀÇ][A-Za-zÀ-ÿ0-9().,/+\-\s]{1,56})$/);
    label = cleanText(tailMatch?.[1] || label);
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


function normalizeRevenueCandidateRow(node = {}, index = 0, kind = 'region', source = 'Investidor10 distribuição de receitas API') {
  if (!node || typeof node !== 'object') return null;
  const label = cleanText(
    node.label || node.name || node.nome || node.title || node.description || node.descricao
    || node.region || node.regiao || node.geography || node.local || node.country || node.pais
    || node.segment || node.segmento || node.business || node.negocio || node.product || node.produto || node.x || ''
  );
  if (!label || /^(total|ano|year|data|value|valor|percentual|percent)$/i.test(label) || label.length > 80) return null;
  const percentRaw = node.percentDisplay || node.percentualDisplay || node.percentageDisplay || node.percentual || node.percent || node.percentage || node.yPercent || node.y_percentage || node.participation || node.participacao || node.y;
  let percent = parseBrNumber(percentRaw);
  if (!Number.isFinite(Number(percent)) && Number.isFinite(Number(node.value)) && Math.abs(Number(node.value)) <= 100) percent = Number(node.value);
  if (!Number.isFinite(Number(percent)) || percent <= 0 || percent > 100) return null;
  const amountRaw = node.amountDisplay || node.valorDisplay || node.valueDisplay || node.totalDisplay || node.receitaDisplay || node.revenueDisplay || node.amount || node.valor || node.total || node.receita || node.revenue;
  const amountDisplay = cleanText(amountRaw || '');
  return {
    id: `${kind}_${index}_${metricId(label)}`,
    label,
    amountDisplay: amountDisplay || '—',
    amount: amountDisplay ? compactMoneyFromDisplay(amountDisplay) : (Number.isFinite(Number(node.amount || node.valor || node.receita || node.revenue)) ? round(Number(node.amount || node.valor || node.receita || node.revenue), 2) : null),
    percent: round(Number(percent), 4),
    percentDisplay: formatPercent(Number(percent)).replace('+', ''),
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
    candidate.chart?.categories
  ];
  for (const value of paths) {
    if (Array.isArray(value) && value.some(v => cleanText(v))) return value.map(v => cleanText(v));
  }
  return [];
}

function pickRevenueSeriesValuesFromCandidate(candidate = {}) {
  if (!candidate || typeof candidate !== 'object') return [];
  const candidates = [candidate.series, candidate.data, candidate.values, candidate.datasets];
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
    return normalizeRevenueCandidateRow({ label, percent: numeric }, index, kind, source);
  }).filter(Boolean);
}

function rowsFromRevenueCandidate(candidate, kind = 'region', source = 'Investidor10 distribuição de receitas API') {
  const pairedRows = pairedRevenueRowsFromCandidate(candidate, kind, source);
  const rows = [...pairedRows];
  const walk = (node) => {
    if (!node) return;
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (typeof node !== 'object') return;
    const direct = normalizeRevenueCandidateRow(node, rows.length, kind, source);
    if (direct) rows.push(direct);
    for (const key of ['rows', 'items', 'data', 'values', 'series', 'datasets', 'children', 'pontos', 'pontosGrafico', 'chartData']) {
      if (node[key]) walk(node[key]);
    }
  };
  walk(candidate);
  const seen = new Set();
  return rows
    .filter(row => {
      const key = compactKey(row.label);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => Number(b.percent || 0) - Number(a.percent || 0))
    .slice(0, 12);
}

function revenueTotalFromCandidate(candidate = {}) {
  if (!candidate || typeof candidate !== 'object') return null;
  const totalDisplay = cleanText(candidate.totalAmountDisplay || candidate.totalDisplay || candidate.total || candidate.valorTotal || candidate.receitaTotal || candidate.revenueTotal || '');
  if (!totalDisplay) return null;
  return {
    totalLabel: candidate.totalLabel || 'Total (trimestral)',
    totalAmountDisplay: totalDisplay,
    totalAmount: compactMoneyFromDisplay(totalDisplay)
  };
}

function sectionBetweenPlain(plain = '', startRe, endReList = []) {
  const start = plain.search(startRe);
  if (start < 0) return '';
  let section = plain.slice(start, start + 7000);
  const end = endReList.map(re => section.search(re)).filter(i => i > 300).sort((a, b) => a - b)[0];
  if (Number.isFinite(end)) section = section.slice(0, end);
  return section;
}

function buildStockRevenueBreakdownPayload({ html = '', canonical = {}, ticker = '', name = '' } = {}, kind = 'region') {
  const plain = htmlToPlainText(html);
  const isRegion = kind === 'region';
  const title = isRegion
    ? `Regiões onde ${name || ticker || 'a empresa'} gera receita`
    : `Negócios que geram receita para ${name || ticker || 'a empresa'}`;
  const section = isRegion
    ? sectionBetweenPlain(plain, /REGI[ÕO]ES\s+ONDE\s+.*?GERA\s+RECEITA/i, [/NEG[ÓO]CIOS\s+QUE\s+GERAM/i, /POSI[ÇC][ÃA]O\s+ACION[ÁA]RIA/i, /Receitas\s+e\s+Lucros/i])
    : sectionBetweenPlain(plain, /NEG[ÓO]CIOS\s+QUE\s+GERAM\s+RECEITA/i, [/POSI[ÇC][ÃA]O\s+ACION[ÁA]RIA/i, /Receitas\s+e\s+Lucros/i, /LUCRO\s+X\s+COTA[ÇC][ÃA]O/i]);
  const year = section.match(/\b(20\d{2})\b/)?.[1] || '';
  let items = parseStockRevenueRowsFromSection(section, year);
  const total = totalFromStockRevenueSection(section);

  const canonicalCandidates = isRegion
    ? [canonical?.revenueRegion, canonical?.revenueGeography, canonical?.revenueByRegion, canonical?.revenueBreakdowns?.region, canonical?.revenueBreakdowns?.geography, canonical?.embedded?.revenueGeography, canonical?.embedded?.revenueRegion, canonical?.embedded?.revenueByRegion]
    : [canonical?.revenueBusiness, canonical?.revenueSegment, canonical?.revenueByBusiness, canonical?.revenueBreakdowns?.business, canonical?.revenueBreakdowns?.segment, canonical?.embedded?.revenueSegment, canonical?.embedded?.revenueBusiness, canonical?.embedded?.revenueByBusiness];
  let canonicalTotal = null;
  if (!items.length) {
    for (const candidate of canonicalCandidates) {
      if (!candidate || (typeof candidate === 'object' && !Object.keys(candidate).length)) continue;
      const candidateRows = rowsFromRevenueCandidate(candidate, kind, 'Investidor10 distribuição de receitas API');
      if (candidateRows.length) {
        items = candidateRows;
        canonicalTotal = revenueTotalFromCandidate(candidate);
        break;
      }
      const jsonText = JSON.stringify(candidate || {});
      if (!jsonText || jsonText === '{}') continue;
      items = parseStockRevenueRowsFromSection(htmlToPlainText(jsonText), year);
      if (items.length) {
        canonicalTotal = revenueTotalFromCandidate(candidate);
        break;
      }
    }
  }
  let selectedYear = year || 'Atual';
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
    items
  };
}


const STOCK_SHAREHOLDER_COLUMNS = Object.freeze([
  { key: 'shareholder', label: 'Acionista' },
  { key: 'onPercent', label: '% ON' },
  { key: 'pnPercent', label: '% PN' },
  { key: 'totalPercent', label: '% Total' }
]);


function normalizeShareholdingRow(row = {}, index = 0, source = 'Investidor10 posição acionária') {
  const shareholder = cleanText(row.shareholder || row.acionista || row.name || row.nome || row.label || row.title || '');
  if (!shareholder || /^(Acionista|Posi[çc][ãa]o acion[áa]ria|Total)$/i.test(shareholder)) return null;
  const onDisplay = row.onPercentDisplay || row.onDisplay || row.percentOnDisplay || row['% ON'] || row.onPercent || row.on || row.percentOn || row.on_percent || '';
  const pnDisplay = row.pnPercentDisplay || row.pnDisplay || row.percentPnDisplay || row['% PN'] || row.pnPercent || row.pn || row.percentPn || row.pn_percent || '';
  const totalDisplay = row.totalPercentDisplay || row.totalDisplay || row.percentTotalDisplay || row['% Total'] || row.totalPercent || row.total || row.percentTotal || row.total_percent || row.value || '';
  const onPercent = parseBrNumber(onDisplay);
  const pnPercent = parseBrNumber(pnDisplay);
  const totalPercent = parseBrNumber(totalDisplay);
  if (![onPercent, pnPercent, totalPercent].some(Number.isFinite)) return null;
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

function parseStockShareholdingRowsFromSection(section = '') {
  const rows = [];
  const source = String(section || '').replace(/\s+/g, ' ');
  const pct = String.raw`(?:-|—|[+-]?(?:\d{1,3}(?:[,.]\d{1,4})?|\d+)\s*%?)`;
  const rowRe = new RegExp(String.raw`([A-ZÁÉÍÓÚÂÊÔÃÕÀÇ0-9][A-ZÁÉÍÓÚÂÊÔÃÕÀÇ0-9\s.&'’/()\-,]{2,130}?)\s+(${pct})\s+(${pct})\s+(${pct})(?=\s+[A-ZÁÉÍÓÚÂÊÔÃÕÀÇ]|\s*$)`, 'g');
  for (const match of source.matchAll(rowRe)) {
    const label = cleanText(match[1]).replace(/^(?:POSI[ÇC][ÃA]O\s+ACION[ÁA]RIA\s+DA\s+[A-Z0-9]+|Acionista\s+%\s+ON\s+%\s+PN\s+%\s+Total)\s*/i, '').trim();
    const normalized = normalizeShareholdingRow({ shareholder: label, onPercentDisplay: match[2], pnPercentDisplay: match[3], totalPercentDisplay: match[4] }, rows.length, 'Investidor10 posição acionária');
    if (normalized) rows.push(normalized);
  }
  const seen = new Set();
  return rows.filter(row => {
    const key = compactKey(row.shareholder);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 20);
}

function parseStockShareholdingRowsFromHtml(html = '') {
  const source = String(html || '');
  if (!source) return [];
  const rawStart = source.search(/posi(?:ç|c|&ccedil;)[ãa]o\s+acion(?:á|a|&aacute;)ria|shareholding|acionista/i);
  const slice = rawStart >= 0 ? source.slice(rawStart, rawStart + 30000) : source;
  const rows = [];
  const trRe = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
  for (const tr of slice.matchAll(trRe)) {
    const cells = [...tr[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)]
      .map(match => cleanText(match[1]).replace(/\s+/g, ' ').trim())
      .filter(Boolean);
    if (cells.length < 2) continue;
    const shareholder = cells[0];
    if (!shareholder || /^(Acionista|P\/L|P\/VP|ROE|DY|Valor|Margem|Ano|Data)$/i.test(shareholder)) continue;
    const percentCells = cells.slice(1).filter(value => /(?:-|—|\d)/.test(value));
    if (!percentCells.length) continue;
    const normalized = normalizeShareholdingRow({
      shareholder,
      onPercentDisplay: percentCells.length >= 3 ? percentCells[0] : '',
      pnPercentDisplay: percentCells.length >= 3 ? percentCells[1] : '',
      totalPercentDisplay: percentCells.length >= 3 ? percentCells[2] : percentCells.at(-1)
    }, rows.length, 'Investidor10 posição acionária HTML');
    if (normalized) rows.push(normalized);
  }
  const seen = new Set();
  return rows.filter(row => {
    const key = compactKey(row.shareholder);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 20);
}

function rowsFromShareholdingCandidate(candidate, source = 'Investidor10 posição acionária') {
  const rows = [];
  const walk = (node) => {
    if (!node) return;
    if (Array.isArray(node)) {
      if (node.every(item => item == null || typeof item !== 'object') && node.length >= 2) {
        const percentCells = node.slice(1);
        const normalized = normalizeShareholdingRow({
          shareholder: node[0],
          onPercentDisplay: percentCells.length >= 3 ? percentCells[0] : '',
          pnPercentDisplay: percentCells.length >= 3 ? percentCells[1] : '',
          totalPercentDisplay: percentCells.length >= 3 ? percentCells[2] : percentCells.at(-1)
        }, rows.length, source);
        if (normalized) rows.push(normalized);
        return;
      }
      node.forEach(walk);
      return;
    }
    if (typeof node !== 'object') return;
    const direct = normalizeShareholdingRow(node, rows.length, source);
    if (direct) rows.push(direct);
    for (const key of ['rows', 'items', 'data', 'values', 'acionistas', 'shareholders', 'ownership']) {
      if (node[key]) walk(node[key]);
    }
  };
  walk(candidate);
  const seen = new Set();
  return rows.filter(row => {
    const key = compactKey(row.shareholder);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 20);
}

function buildStockShareholdingPayload({ html = '', canonical = {}, ticker = '' } = {}) {
  const symbol = String(ticker || '').toUpperCase();
  const plain = htmlToPlainText(html);
  const section = sectionBetweenPlain(plain, /POSI[ÇC][ÃA]O\s+ACION[ÁA]RIA\s+DA\s+[A-Z0-9]+|POSI[ÇC][ÃA]O\s+ACION[ÁA]RIA/i, [/Receitas\s+e\s+Lucros/i, /LUCRO\s+X\s+COTA[ÇC][ÃA]O/i, /Resultados\s+/i]);
  let rows = parseStockShareholdingRowsFromHtml(html);
  if (!rows.length) rows = parseStockShareholdingRowsFromSection(section);
  const canonicalCandidates = [
    canonical?.ownership,
    canonical?.shareholders,
    canonical?.company?.ownership,
    canonical?.company?.shareholders,
    canonical?.company?.posicaoAcionaria,
    canonical?.posicaoAcionaria,
    canonical?.acionistas,
    canonical?.embedded?.shareholding
  ];
  if (!rows.length) {
    for (const candidate of canonicalCandidates) {
      rows = rowsFromShareholdingCandidate(candidate, 'Investidor10 posição acionária');
      if (rows.length) break;
    }
  }
  return {
    id: 'stock_shareholding_position',
    title: symbol ? `Posição acionária da ${symbol}` : 'Posição acionária',
    status: rows.length ? 'OK' : 'EMPTY',
    source: 'Investidor10 posição acionária',
    columns: STOCK_SHAREHOLDER_COLUMNS,
    rows
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
  const payloads = [];
  for (let page = 1; page <= Math.max(1, Math.min(5, Number(maxPages) || 3)); page += 1) {
    const url = `https://investidor10.com.br/communications/ticker/${symbol}/?page=${page}`;
    try {
      const response = await fetchText(url, {
        timeoutMs: Math.min(3600, Math.max(1400, Number(timeoutMs) || 3600)),
        ttlMs: 15 * 60 * 1000,
        staleMs: 24 * 60 * 60 * 1000,
        retries: 0,
        headers: { Accept: 'text/html,application/xhtml+xml,*/*;q=0.8', Referer: `https://investidor10.com.br/acoes/${symbol.toLowerCase()}/` }
      });
      const html = response?.text || '';
      if (!html) continue;
      const payload = extractInvestidor10StockAnnouncements(html, symbol, url);
      if (payload?.items?.length) payloads.push({ ...payload, sourceUrl: url, diagnostics: { ...(payload.diagnostics || {}), parsedFrom: 'communications_route', page, status: response?.status, cacheStatus: response?.cacheStatus } });
    } catch {
      // A rota paginada de comunicados é complementar; a página principal segue como fonte base.
    }
  }
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
  let resolved = 0;
  for (let index = 0; index < Math.min(items.length, 12); index += 1) {
    const item = items[index];
    const url = item?.url || item?.documentUrl;
    if (!url || item.pdfUrl || /\.pdf(?:$|[?#])/i.test(url)) continue;
    if (!/investidor10\.com\.br|fnet\.b3\.com\.br|cvm\.gov\.br|sistemas\.cvm\.gov\.br/i.test(url)) continue;
    try {
      const response = await fetchText(url, {
        timeoutMs: Math.min(3200, Math.max(1200, Number(timeoutMs) || 3200)),
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
      if (pdfUrl) {
        items[index] = { ...item, pdfUrl, documentUrl: pdfUrl, documentKind: 'pdf', buttonLabel: 'Abrir PDF' };
        resolved += 1;
      } else if (item.documentKind === 'pdf') {
        items[index] = { ...item, pdfUrl: item.pdfUrl || item.documentUrl || item.url, documentUrl: item.documentUrl || item.url, buttonLabel: 'Abrir PDF' };
      }
    } catch {
      // Mantém link oficial se a página intermediária não puder ser resolvida dentro do orçamento do modal.
    }
  }
  return { ...payload, items, diagnostics: { ...(payload.diagnostics || {}), pdfResolvedFromIntermediatePages: resolved, pdfLinksFound: items.filter(item => item.pdfUrl).length } };
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

function parseInvestidor10InlineJsonLiteral(literal = '') {
  const raw = decodeHtmlEntities(String(literal || '').trim())
    .replace(/\\\//g, '/')
    .replace(/\u0026/g, '&')
    .replace(/\u003d/g, '=')
    .replace(/\u002f/gi, '/');
  if (!raw) return null;
  const direct = parseJsonMaybe(raw);
  if (direct) return direct;
  // Alguns blocos do Investidor10 aparecem em JSON dentro de strings ou em data attributes.
  const unwrapped = raw.replace(/^['"`]([\s\S]*)['"`]$/m, '$1');
  return parseJsonMaybe(unwrapped);
}

function extractInvestidor10InlinePayload(html = '', names = []) {
  const source = String(html || '');
  for (const name of names) {
    const escaped = escapeRegExp(name);
    const jsonParseRe = new RegExp(`${escaped}\s*=\s*JSON\.parse\(\s*([\"'\`])([\s\S]{0,220000}?)\\1\s*\)`, 'i');
    const parsedLiteral = source.match(jsonParseRe)?.[2];
    if (parsedLiteral) {
      const parsed = parseInvestidor10InlineJsonLiteral(`"${parsedLiteral}"`);
      if (parsed) return parsed;
    }
    const re = new RegExp(`(?:const|let|var|window\.)?\s*${escaped}\s*[:=]`, 'gi');
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
    ]),
    revenueSegment: extractInvestidor10InlinePayload(html, [
      'companyBussinesRevenuesChartPie',
      'companyBusinessRevenuesChartPie',
      'companyBusinessRevenueChartPie',
      'companyRevenuesByBusinessChartPie',
      'companyRevenuesBySegmentChartPie',
      'revenueSegment',
      'revenueByBusiness',
      'negociosReceita'
    ]),
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
  if (/ativospassivos\/chart/i.test(clean)) return 'evolucaoPatrimonio';
  if (/resultado\/chart/i.test(clean)) return 'resultadoDre';
  if (/fluxocaixa\/chart/i.test(clean)) return 'fluxoCaixa';
  if (/indicadores\/chart/i.test(clean)) return 'historicoIndicadores';
  if (/payout-chart/i.test(clean)) return 'payoutHistorico';
  const suffix = String(url).split('/api/')[1] || 'chart';
  return `i10Api_${suffix.replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 70)}`;
}

async function fetchInvestidor10StockApiExtras({ ticker = '', html = '', timeoutMs = 4500 } = {}) {
  const symbol = String(ticker || '').toUpperCase();
  const ids = extractInvestidor10ChartIds(html || '');
  const apiExtras = { embedded: extractInvestidor10StockEmbeddedAnalysisData(html || ''), chartsFinanceiros: {}, rawJson: {}, apiStatus: [] };
  const tasks = [];
  const seen = new Set();
  const base = 'https://investidor10.com.br';
  const addTask = (key, url) => {
    const finalUrl = String(url || '').trim();
    if (!finalUrl || seen.has(finalUrl)) return;
    seen.add(finalUrl);
    tasks.push([key || stockI10ApiKeyFromUrl(finalUrl), finalUrl]);
  };
  if (ids.companyId) {
    addTask('receitasLucros', `${base}/api/balancos/receitaliquida/chart/${ids.companyId}/3650/false/`);
    addTask('evolucaoPatrimonio', `${base}/api/balancos/ativospassivos/chart/${ids.companyId}/3650/`);
    addTask('resultadoDre', `${base}/api/balancos/resultado/chart/${ids.companyId}/3650/`);
    addTask('fluxoCaixa', `${base}/api/balancos/fluxocaixa/chart/${ids.companyId}/3650/`);
    addTask('historicoIndicadores', `${base}/api/balancos/indicadores/chart/${ids.companyId}/3650/`);
    if (symbol) addTask('lucroCotacao', `${base}/api/cotacao-lucro/${symbol.toLowerCase()}/adjusted/`);
    if (ids.tickerId && symbol) addTask('payoutHistorico', `${base}/api/acoes/payout-chart/${ids.companyId}/${ids.tickerId}/${symbol}/3650`);
  }
  for (const url of discoverInvestidor10ChartApiUrls(html || '', symbol, 'ACAO')) {
    if (tasks.length >= 18) break;
    addTask(stockI10ApiKeyFromUrl(url), url);
  }
  const responses = await Promise.all(tasks.slice(0, 18).map(async ([key, url]) => {
    const result = await fetchText(url, {
      timeoutMs: Math.min(4200, Math.max(1800, Number(timeoutMs) || 4200)),
      ttlMs: 4 * 60 * 60 * 1000,
      staleMs: 24 * 60 * 60 * 1000,
      retries: 0,
      headers: {
        Accept: 'application/json, text/plain, */*',
        'X-Requested-With': 'XMLHttpRequest',
        Referer: `${base}/acoes/${symbol.toLowerCase()}/`
      }
    }).catch(error => ({ text: '', status: 0, cacheStatus: 'ERROR', error: error?.message || String(error) }));
    const json = parseJsonMaybe(result.text || '');
    return [key, url, result, json];
  }));
  for (const [key, url, result, json] of responses) {
    apiExtras.apiStatus.push({ key, url, status: result.status || 0, ok: Boolean(json), cacheStatus: result.cacheStatus, error: json ? undefined : (result.error || 'json_unavailable') });
    if (!json) continue;
    apiExtras.rawJson[key] = json;
    apiExtras.chartsFinanceiros[key] = json;
  }
  return apiExtras;
}

async function fetchInvestidor10StockBundle(ticker, timeoutMs = 6500) {
  const symbol = String(ticker || '').toUpperCase();
  const url = `https://investidor10.com.br/acoes/${symbol.toLowerCase()}/`;
  const { text, status, cacheStatus, error, finalUrl } = await fetchText(url, {
    timeoutMs,
    ttlMs: 90_000,
    staleMs: 8 * 60 * 60 * 1000,
    retries: 1,
    headers: {
      'User-Agent': process.env.VALORAE_USER_AGENT || 'Mozilla/5.0',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
    }
  });
  const rawHtml = text || '';
  const identityOk = rawHtml ? stockTickerIdentityOk(rawHtml, finalUrl || url, symbol) : false;
  const identityDiagnostics = rawHtml ? stockPageIdentityDiagnostics(rawHtml, finalUrl || url, symbol) : { requestedTicker: symbol, finalUrl: finalUrl || url, symbolFoundInPageHead: false, urlMatchesTicker: false };
  const html = identityOk ? rawHtml : '';
  const identityApiStatus = rawHtml && !identityOk
    ? [{ key: 'stockPageIdentity', status: status || 0, ok: false, error: 'page_identity_mismatch', diagnostics: identityDiagnostics }]
    : [];
  const apiExtras = html ? await fetchInvestidor10StockApiExtras({ ticker: symbol, html, timeoutMs: Math.min(timeoutMs, 5200) }).catch(error => ({ embedded: {}, chartsFinanceiros: {}, rawJson: {}, apiStatus: [{ key: 'stockApiExtras', status: 0, ok: false, error: error?.message || String(error) }] })) : { embedded: {}, chartsFinanceiros: {}, rawJson: {}, apiStatus: identityApiStatus };
  const canonical = html ? { ...buildInvestidor10CanonicalCharts({ ticker: symbol, type: 'ACAO', html, apiExtras }), embedded: apiExtras?.embedded || {} } : {};
  const rawQuickMetrics = html ? extractInvestidor10StockQuickMetrics(html, symbol) : {};
  const rawFundamentalIndicators = html ? extractInvestidor10StockFundamentalIndicators(html, symbol, rawQuickMetrics) : extractInvestidor10StockFundamentalIndicators('', symbol, rawQuickMetrics);
  const quickMetrics = enrichStockQuickMetrics(rawQuickMetrics, rawFundamentalIndicators, symbol);
  const fundamentalIndicators = html ? extractInvestidor10StockFundamentalIndicators(html, symbol, quickMetrics) : rawFundamentalIndicators;
  const historicalIndicators = buildStockHistoricalIndicators(canonical?.company?.fundamentalIndicatorHistory || canonical?.fundamentalIndicatorHistory || {}, symbol, fundamentalIndicators);
  const checklist = html ? extractInvestidor10StockBuyHoldChecklist(html, symbol, { fundamentalIndicators, historicalIndicators, canonical }) : emptyStockBuyHoldChecklist(symbol, { reason: 'no_html' });
  const dividendHistory = buildStockDividendHistoryPayload({ ticker: symbol, html, canonical, quickMetrics, fundamentalIndicators });
  const dividendRadar = buildStockDividendRadarPayload({ ticker: symbol, dividendHistory });
  const payoutChart = buildStockPayoutChartPayload({ ticker: symbol, canonical, historicalIndicators, dividendHistory });
  const peerComparison = extractInvestidor10StockPeerComparison(html, symbol, quickMetrics, fundamentalIndicators);
  const companyProfile = extractStockCompanyProfile(html, symbol, html ? extractTitleName(html, symbol) : symbol, quickMetrics, fundamentalIndicators);
  const revenueByRegion = buildStockRevenueBreakdownPayload({ html, canonical, ticker: symbol, name: companyProfile?.name || symbol }, 'region');
  const revenueByBusiness = buildStockRevenueBreakdownPayload({ html, canonical, ticker: symbol, name: companyProfile?.name || symbol }, 'business');
  const shareholdingPosition = buildStockShareholdingPayload({ html, canonical, ticker: symbol });
  const revenueProfitChart = buildStockRevenueProfitChartPayload({ ticker: symbol, canonical });
  const profitQuoteChart = buildStockProfitQuoteChartPayload({ ticker: symbol, canonical });
  const resultsStatement = buildStockResultsStatementPayload({ ticker: symbol, canonical, fundamentalIndicators, historicalIndicators });
  const balanceSheetStatement = buildStockBalanceSheetStatementPayload({ ticker: symbol, canonical });
  const announcements = await buildStockAnnouncementsPayload({ ticker: symbol, html, timeoutMs });
  const equityEvolutionChart = buildStockEquityEvolutionChartPayload({ ticker: symbol, canonical });
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
    checklist,
    dividendHistory,
    dividendRadar,
    payoutChart,
    peerComparison,
    companyProfile,
    revenueByRegion,
    revenueByBusiness,
    shareholdingPosition,
    revenueProfitChart,
    profitQuoteChart,
    resultsStatement,
    balanceSheetStatement,
    announcements,
    equityEvolutionChart,
    returnsRows: canonical ? returnsRowsFromInvestidor10Profitability(canonical) : [],
    name: html ? extractTitleName(html, symbol) : symbol
  };
}

function metricCard(id, label, value, numericValue, source) {
  return {
    id,
    label,
    value: value || '—',
    numericValue: Number.isFinite(Number(numericValue)) ? round(Number(numericValue), 4) : null,
    source
  };
}

export async function buildStockModalContract(payload = {}) {
  const rawTicker = payload.ticker || payload.symbol || payload.q || '';
  const ticker = normalizeTicker(rawTicker);
  const timeoutMs = Math.min(12_000, Math.max(3_500, Number(payload.timeoutMs || 8500)));
  if (!ticker) {
    return { ok: false, status: 'ERROR', endpoint: 'asset/stock-modal', error: 'Informe ticker ou symbol do ativo.' };
  }
  const kind = classifyTicker(ticker);
  if (kind === 'FII' || kind === 'ETF' || kind === 'BDR') {
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

  const [investidor10, oneDayHistory, oneYearHistory] = await Promise.all([
    fetchInvestidor10StockBundle(ticker, Math.min(timeoutMs, 7000)).catch(error => ({ status: 0, error: error?.message || String(error), html: '', quickMetrics: {}, canonical: {}, returnsRows: [], name: ticker })),
    fetchYahooHistory(ticker, {
      range: '1D',
      interval: '5m',
      timeoutMs: Math.min(5200, timeoutMs),
      limit: 96,
      cache: true
    }).catch(error => ({ ok: false, points: [], error: error?.message || String(error) })),
    fetchYahooHistory(ticker, {
      range: '1Y',
      interval: '1d',
      timeoutMs: Math.min(5200, timeoutMs),
      limit: 370,
      cache: true
    }).catch(error => ({ ok: false, points: [], error: error?.message || String(error) }))
  ]);

  const indexComparison = await buildStockIndexComparison(ticker, timeoutMs)
    .catch(error => ({ id: 'stock_asset_vs_indices_selector', title: `Comparação de ${ticker} com índices`, status: 'ERROR', error: error?.message || String(error), periods: STOCK_COMPARISON_PERIODS, series: [], items: [], seriesByPeriod: {}, itemsByPeriod: {} }));
  const commodityComparison = emptyStockCommodityComparison(ticker);

  const chartPoints = (oneDayHistory?.points || []).map(chartPointFromYahoo).filter(Boolean);
  const chartStats = chartSummary(chartPoints);
  const yahooPrice = Number(oneDayHistory?.regularMarketPrice || oneDayHistory?.meta?.regularMarketPrice || chartPoints.at(-1)?.close);
  const yahooVariation = Number.isFinite(Number(chartStats.variationPercent)) ? round(Number(chartStats.variationPercent), 4) : null;
  const rawQuick = investidor10?.quickMetrics || {};
  const rawFundamentalIndicators = investidor10?.fundamentalIndicators || extractInvestidor10StockFundamentalIndicators('', ticker, rawQuick);
  const quick = enrichStockQuickMetrics(rawQuick, rawFundamentalIndicators, ticker);
  const fundamentalIndicators = rawFundamentalIndicators;
  const resolvedPrice = Number.isFinite(Number(yahooPrice)) ? Number(yahooPrice) : (Number.isFinite(Number(quick.price)) ? Number(quick.price) : null);
  const resolvedPriceDisplay = Number.isFinite(Number(resolvedPrice)) ? formatMoney(resolvedPrice) : (quick.priceDisplay || '—');
  const variation12m = Number.isFinite(Number(quick.variation12mPercent)) ? Number(quick.variation12mPercent) : null;
  const returnsRows = investidor10?.returnsRows || [];
  const returnsSource = 'Investidor10';
  const variation12mFromReturns = returnsRows.find(row => /^(?:1y|1_ano|1 ano)$/i.test(String(row.key || row.label || '').replace(/\s+/g, '_')))?.returnPercent;
  const variation12mFromYahoo = performanceFromHistory(oneYearHistory);
  const resolvedVariation12m = Number.isFinite(Number(variation12m))
    ? variation12m
    : (Number.isFinite(Number(variation12mFromReturns)) ? Number(variation12mFromReturns) : (Number.isFinite(Number(variation12mFromYahoo)) ? Number(variation12mFromYahoo) : null));
  const resolvedVariation12mDisplay = quick.variation12mDisplay || (Number.isFinite(Number(resolvedVariation12m)) ? formatPercent(resolvedVariation12m, true) : '—');
  const variation12mSource = quick.variation12mDisplay ? 'Investidor10' : (Number.isFinite(Number(variation12mFromReturns)) ? returnsSource : 'Yahoo Finance Chart API');
  const name = investidor10?.name || ticker;
  const metrics = [
    metricCard('price', 'Cotação', resolvedPriceDisplay, resolvedPrice, Number.isFinite(Number(yahooPrice)) ? 'Yahoo Finance Chart API' : 'Investidor10'),
    metricCard('variation_12m', 'Variação (12M)', resolvedVariation12mDisplay, resolvedVariation12m, variation12mSource),
    metricCard('pl', 'P/L', quick.plDisplay || (Number.isFinite(Number(quick.pl)) ? formatNumber(quick.pl, 2) : '—'), quick.pl, 'Investidor10'),
    metricCard('pvp', 'P/VP', quick.pvpDisplay || (Number.isFinite(Number(quick.pvp)) ? formatNumber(quick.pvp, 2) : '—'), quick.pvp, 'Investidor10'),
    metricCard('dy', 'DY', quick.dyDisplay || (Number.isFinite(Number(quick.dy)) ? formatPercent(quick.dy) : '—'), quick.dy, 'Investidor10')
  ];
  const hasInvestidor10Data = Boolean(metrics.some(item => item.value && item.value !== '—' && item.source === 'Investidor10') || returnsRows.some(row => row.source === 'Investidor10') || (fundamentalIndicators?.items || []).length);
  const status = hasInvestidor10Data || chartPoints.length > 1 ? 'OK' : 'PARTIAL';
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
    sourcePolicy: 'Modal único de ações com política sem substituição estática: dados financeiros, fundamentalistas, proventos, comparador, regiões/negócios, posição acionária, resultados e balanço só são preenchidos quando vierem da fonte real capturada para o ticker solicitado. O gráfico/cotação e a comparação com índices usam fontes vivas definidas no contrato; quando a fonte real não entrega o bloco, o status fica EMPTY/ERROR em vez de usar dados de exemplo.',
    sources: [
      { id: 'investidor10_acoes_html', role: 'cards_rapidos_indicadores_fundamentalistas_historico_checklist_dividendos_radar_payout_comparador_acoes_sobre_empresa_receitas_regioes_negocios_receitas_lucros_lucro_cotacao_balanco_comunicados_rentabilidade_nominal_real' },
      { id: 'yahoo_chart', role: 'cotacao_tempo_real_apenas_sem_fundamentos' },
      { id: 'bcb_ipca', role: 'comparacao_ipca' },
      { id: 'bcb_cdi', role: 'comparacao_cdi' },
      { id: 'yahoo_indices', role: 'comparacao_indices_ifix_idiv_smll_ibov_ivvb11' }
    ],
    quoteSummary: {
      ticker,
      name,
      price: Number.isFinite(Number(resolvedPrice)) ? round(Number(resolvedPrice), 4) : null,
      priceDisplay: resolvedPriceDisplay,
      changePercent: Number.isFinite(Number(yahooVariation)) ? yahooVariation : (Number.isFinite(Number(quick.changePercent)) ? round(Number(quick.changePercent), 4) : null),
      changeDisplay: Number.isFinite(Number(yahooVariation)) ? formatPercent(yahooVariation, true) : (quick.changeDisplay || ''),
      variation12mPercent: Number.isFinite(Number(resolvedVariation12m)) ? round(Number(resolvedVariation12m), 4) : null,
      variation12mDisplay: resolvedVariation12mDisplay,
      pl: Number.isFinite(Number(quick.pl)) ? round(Number(quick.pl), 4) : null,
      pvp: Number.isFinite(Number(quick.pvp)) ? round(Number(quick.pvp), 4) : null,
      dy: Number.isFinite(Number(quick.dy)) ? round(Number(quick.dy), 4) : null,
      source: Number.isFinite(Number(yahooPrice)) ? 'Yahoo Finance Chart API' : 'Investidor10'
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
    companyProfile: withResolvedStockCompanyProfile(investidor10?.companyProfile || extractStockCompanyProfile('', ticker, name, quick, fundamentalIndicators), { priceDisplay: resolvedPriceDisplay, variation12mDisplay: resolvedVariation12mDisplay !== '—' ? resolvedVariation12mDisplay : '' }),
    revenueByRegion: investidor10?.revenueByRegion || buildStockRevenueBreakdownPayload({ ticker, name }, 'region'),
    revenueByBusiness: investidor10?.revenueByBusiness || buildStockRevenueBreakdownPayload({ ticker, name }, 'business'),
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
    diagnostics: {
      investidor10Status: investidor10?.status || 0,
      investidor10CacheStatus: investidor10?.cacheStatus,
      investidor10Url: investidor10?.url || `https://investidor10.com.br/acoes/${ticker.toLowerCase()}/`,
      investidor10Error: investidor10?.error || '',
      quickMetrics: Object.keys(quick).sort(),
      identityOk: Boolean(investidor10?.identityOk),
      identityDiagnostics: investidor10?.identityDiagnostics || undefined,
      quoteSource: Number.isFinite(Number(yahooPrice)) ? 'Yahoo Finance Chart API' : 'Investidor10',
      variation12mSource,
      fundamentalIndicators: (fundamentalIndicators?.items || []).length,
      fundamentalGroups: (fundamentalIndicators?.groups || []).length,
      historicalIndicatorRows: (investidor10?.historicalIndicators?.rows || []).length,
      historicalIndicatorPeriods: (investidor10?.historicalIndicators?.periods || []).length,
      checklistItems: (investidor10?.checklist?.items || []).length,
      checklistPassed: investidor10?.checklist?.passed || 0,
      dividendHistoryStatus: investidor10?.dividendHistory?.status || 'EMPTY',
      dividendHistoryEvents: (investidor10?.dividendHistory?.events || []).length,
      dividendHistoryYieldYearly: (investidor10?.dividendHistory?.yieldSeriesByFrequency?.yearly || []).length,
      dividendRadarMonths: (investidor10?.dividendRadar?.months || []).filter(month => month.activeDateCom || month.activePayment).length,
      payoutChartPoints: (investidor10?.payoutChart?.points || []).length,
      peerComparisonRows: (investidor10?.peerComparison?.rows || []).length,
      indexComparisonStatus: indexComparison?.status || 'EMPTY',
      commodityComparisonStatus: 'REMOVED',
      companyProfileSections: (investidor10?.companyProfile?.sections || []).length,
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

export const _test = {
  STOCK_MODAL_VERSION,
  STOCK_MODAL_PERIODS,
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
  normalizeStockHistoricalIndicatorsDataset,
  extractInvestidor10StockBuyHoldChecklist,
  emptyStockBuyHoldChecklist,
  STOCK_BUY_HOLD_CHECKLIST_CRITERIA,
  buildStockDividendHistoryPayload,
  buildStockDividendRadarPayload,
  buildStockPayoutChartPayload,
  extractStockDividendEventsFromHtml,
  extractInvestidor10StockPeerComparison,
  buildStockIndexComparison,
  buildStockCommodityComparison,
  extractStockCompanyProfile,
  buildStockRevenueBreakdownPayload,
  parseStockRevenueRowsFromSection,
  buildStockShareholdingPayload,
  parseStockShareholdingRowsFromSection,
  buildStockRevenueProfitChartPayload,
  buildStockProfitQuoteChartPayload,
  buildStockResultsStatementPayload,
  buildStockBalanceSheetStatementPayload,
  extractInvestidor10StockAnnouncements,
  buildStockAnnouncementsPayload,
  emptyStockAnnouncements,
  buildStockEquityEvolutionChartPayload
};
