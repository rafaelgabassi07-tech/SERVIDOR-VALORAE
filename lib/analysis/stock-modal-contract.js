import { classifyTicker, normalizeTicker } from '../core/tickers.js';
import { round } from '../core/numbers.js';
import { fetchYahooHistory } from '../market/yahoo.js';
import { fetchText } from '../sources/fetch.js';
import { getIpcaSeries } from '../sources/ipca.js';
import { buildInvestidor10CanonicalCharts } from '../market/investidor10-chart-extractor.js';
import { RELEASE } from '../core/release.js';

export const STOCK_MODAL_VERSION = '26.asset-modal.stock.v3';

const STOCK_MODAL_PERIODS = Object.freeze([
  { key: '1m', label: '1 mês', range: '1M', interval: '1d', months: 1 },
  { key: '3m', label: '3 meses', range: '3M', interval: '1d', months: 3 },
  { key: '1y', label: '1 ano', range: '1Y', interval: '1d', months: 12 },
  { key: '2y', label: '2 anos', range: '2Y', interval: '1d', months: 24 },
  { key: '5y', label: '5 anos', range: '5Y', interval: '1wk', months: 60 },
  { key: '10y', label: '10 anos', range: '10Y', interval: '1mo', months: 120 }
]);


const STOCK_FUNDAMENTAL_GROUPS = Object.freeze([
  { id: 'valuation', title: 'Valuation e múltiplos' },
  { id: 'margins', title: 'Margens e eficiência' },
  { id: 'profitability', title: 'Rentabilidade' },
  { id: 'debt', title: 'Endividamento e estrutura' },
  { id: 'growth', title: 'Crescimento' }
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

function buildStockHistoricalIndicators(rawHistory, ticker = '') {
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

export function extractInvestidor10StockQuickMetrics(html = '', ticker = '') {
  const plain = htmlToPlainText(html);
  const symbol = String(ticker || '').toUpperCase();
  const start = Math.max(0, Math.min(
    ...[
      symbol ? plain.search(new RegExp(`${symbol}\\s+Cotação`, 'i')) : -1,
      plain.search(/Cotação\s+R\$/i),
      plain.search(/VARIA[ÇC][ÃA]O\s*\(12M\)/i),
      plain.search(/P\s*\/\s*L/i)
    ].filter(i => i >= 0).concat([0])
  ));
  const section = plain.slice(start, start + 3600);
  const priceDisplay = section.match(/(?:Cotação|Valor atual)\s*(R\$\s*[\d.,]+)/i)?.[1]
    || section.match(/(R\$\s*[\d.,]+)\s*[+-]?\s*\d{1,3}(?:[,.]\d+)?\s*%/i)?.[1]
    || '';
  const priceChunk = priceDisplay ? section.slice(Math.max(0, section.indexOf(priceDisplay)), Math.max(0, section.indexOf(priceDisplay)) + 90) : '';
  const dayChange = priceChunk.replace(priceDisplay, '').match(/[+-]?\s*\d{1,3}(?:[,.]\d+)?\s*%/)?.[0] || '';
  const variation12mDisplay = extractNearbyMetric(section, ['VARIA[ÇC][ÃA]O\\s*\\(12M\\)', 'Varia[çc][ãa]o\\s*\\(12M\\)', 'Varia[çc][ãa]o\\s+12M'], '[+-]?\\s*\\d{1,4}(?:[,.]\\d+)?\\s*%');
  const plDisplay = extractNearbyMetric(section, ['P\\s*\/\\s*L', 'Preço\\s*\/\\s*Lucro', 'Preco\\s*\/\\s*Lucro'], '[+-]?\\s*\\d{1,6}(?:[,.]\\d+)?');
  const pvpDisplay = extractNearbyMetric(section, ['P\\s*\/\\s*VP', 'PVP', 'Preço\\s*\/\\s*Valor\\s*Patrimonial', 'Preco\\s*\/\\s*Valor\\s*Patrimonial'], '[+-]?\\s*\\d{1,6}(?:[,.]\\d+)?');
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

async function buildStockReturnsFallback(ticker, timeoutMs = 6500) {
  const ipca = await getIpcaSeries(120).catch(error => ({ status: 'ERROR', points: [], error: error?.message || String(error) }));
  const rows = await Promise.all(STOCK_MODAL_PERIODS.map(async period => {
    const history = await fetchYahooHistory(ticker, {
      range: period.range,
      interval: period.interval,
      timeoutMs: Math.min(5200, timeoutMs),
      limit: period.key === '10y' ? 240 : 520,
      cache: true
    }).catch(error => ({ ok: false, points: [], error: error?.message || String(error) }));
    const nominal = performanceFromHistory(history);
    const inflation = accumulatedIpcaPercent(ipca.points || ipca.series || [], period.months);
    const real = realReturnPercent(nominal, inflation);
    return {
      key: period.key,
      label: period.label,
      returnPercent: Number.isFinite(nominal) ? nominal : null,
      returnDisplay: Number.isFinite(nominal) ? formatPercent(nominal) : '—',
      realReturnPercent: Number.isFinite(real) ? real : null,
      realReturnDisplay: Number.isFinite(real) ? formatPercent(real) : '—',
      inflationDisplay: Number.isFinite(inflation) ? formatPercent(inflation) : '—',
      source: 'Yahoo Finance Chart API + Banco Central IPCA'
    };
  }));
  return rows.filter(row => row.returnPercent !== null || row.realReturnPercent !== null);
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
  const html = text || '';
  const canonical = html ? buildInvestidor10CanonicalCharts({ ticker: symbol, type: 'ACAO', html }) : {};
  const quickMetrics = html ? extractInvestidor10StockQuickMetrics(html, symbol) : {};
  return {
    status,
    cacheStatus,
    error,
    url: finalUrl || url,
    html,
    quickMetrics,
    fundamentalIndicators: html ? extractInvestidor10StockFundamentalIndicators(html, symbol, quickMetrics) : extractInvestidor10StockFundamentalIndicators('', symbol, quickMetrics),
    canonical,
    historicalIndicators: buildStockHistoricalIndicators(canonical?.company?.fundamentalIndicatorHistory || canonical?.fundamentalIndicatorHistory || {}, symbol),
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
    return { ok: false, status: 'ERROR', endpoint: 'asset/stock-modal', error: 'Informe ticker=PETR4 ou symbol=PETR4.' };
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

  const [investidor10, oneDayHistory] = await Promise.all([
    fetchInvestidor10StockBundle(ticker, Math.min(timeoutMs, 7000)).catch(error => ({ status: 0, error: error?.message || String(error), html: '', quickMetrics: {}, canonical: {}, returnsRows: [], name: ticker })),
    fetchYahooHistory(ticker, {
      range: '1D',
      interval: '5m',
      timeoutMs: Math.min(5200, timeoutMs),
      limit: 96,
      cache: true
    }).catch(error => ({ ok: false, points: [], error: error?.message || String(error) }))
  ]);

  const chartPoints = (oneDayHistory?.points || []).map(chartPointFromYahoo).filter(Boolean);
  const chartStats = chartSummary(chartPoints);
  const yahooPrice = Number(oneDayHistory?.regularMarketPrice || chartPoints.at(-1)?.close);
  const yahooVariation = Number.isFinite(Number(chartStats.variationPercent)) ? round(Number(chartStats.variationPercent), 4) : null;
  const quick = investidor10?.quickMetrics || {};
  const fundamentalIndicators = investidor10?.fundamentalIndicators || extractInvestidor10StockFundamentalIndicators('', ticker, quick);
  const price = Number.isFinite(Number(quick.price)) ? Number(quick.price) : yahooPrice;
  const variation12m = Number.isFinite(Number(quick.variation12mPercent)) ? Number(quick.variation12mPercent) : null;
  let returnsRows = investidor10?.returnsRows || [];
  let returnsSource = 'Investidor10';
  if (!returnsRows.length) {
    returnsRows = await buildStockReturnsFallback(ticker, timeoutMs).catch(() => []);
    returnsSource = 'Yahoo Finance Chart API + Banco Central IPCA';
  }
  const name = investidor10?.name || ticker;
  const metrics = [
    metricCard('price', 'Cotação', quick.priceDisplay || (Number.isFinite(price) ? formatMoney(price) : '—'), price, quick.priceDisplay ? 'Investidor10' : 'Yahoo Finance Chart API'),
    metricCard('variation_12m', 'Variação (12M)', quick.variation12mDisplay || (Number.isFinite(variation12m) ? formatPercent(variation12m) : '—'), variation12m, quick.variation12mDisplay ? 'Investidor10' : 'Investidor10'),
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
    sourcePolicy: 'Modal único de ações seguindo a referência Investidor10: cards rápidos, indicadores fundamentalistas, histórico de indicadores e tabela de rentabilidade nominal/real vêm do ecossistema público do Investidor10. O gráfico intradiário/tempo real usa Yahoo Finance Chart API somente para cotação. Fallback de rentabilidade usa Yahoo + IPCA Banco Central quando a tabela do Investidor10 não estiver disponível no HTML estático.',
    sources: [
      { id: 'investidor10_acoes_html', role: 'cards_rapidos_indicadores_fundamentalistas_historico_rentabilidade_nominal_real' },
      { id: 'yahoo_chart', role: 'cotacao_tempo_real_apenas_sem_fundamentos' },
      { id: 'bcb_ipca', role: 'fallback_rentabilidade_real_quando_investidor10_indisponivel' }
    ],
    quoteSummary: {
      ticker,
      name,
      price: Number.isFinite(price) ? round(price, 4) : null,
      priceDisplay: quick.priceDisplay || (Number.isFinite(price) ? formatMoney(price) : '—'),
      changePercent: Number.isFinite(Number(quick.changePercent)) ? round(Number(quick.changePercent), 4) : yahooVariation,
      changeDisplay: quick.changeDisplay || (Number.isFinite(yahooVariation) ? formatPercent(yahooVariation, true) : ''),
      variation12mPercent: Number.isFinite(variation12m) ? round(variation12m, 4) : null,
      pl: Number.isFinite(Number(quick.pl)) ? round(Number(quick.pl), 4) : null,
      pvp: Number.isFinite(Number(quick.pvp)) ? round(Number(quick.pvp), 4) : null,
      dy: Number.isFinite(Number(quick.dy)) ? round(Number(quick.dy), 4) : null,
      source: quick.priceDisplay ? 'Investidor10' : 'Yahoo Finance Chart API'
    },
    metrics,
    fundamentalIndicators,
    historicalIndicators: investidor10?.historicalIndicators || buildStockHistoricalIndicators({}, ticker),
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
      fundamentalIndicators: (fundamentalIndicators?.items || []).length,
      fundamentalGroups: (fundamentalIndicators?.groups || []).length,
      historicalIndicatorRows: (investidor10?.historicalIndicators?.rows || []).length,
      historicalIndicatorPeriods: (investidor10?.historicalIndicators?.periods || []).length,
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
  normalizeStockHistoricalIndicatorsDataset
};
