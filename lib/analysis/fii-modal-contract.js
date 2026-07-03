import { classifyTicker, normalizeTicker } from '../core/tickers.js';
import { round } from '../core/numbers.js';
import { fetchYahooHistory, fetchYahooQuote } from '../market/yahoo.js';
import { fetchText, fetchJson } from '../sources/fetch.js';
import { extractInvestidor10ChartIds, buildInvestidor10CanonicalCharts } from '../market/investidor10-chart-extractor.js';
import { RELEASE } from '../core/release.js';

const FII_MODAL_VERSION = '26.asset-modal.fii.v5';

const RETURN_PERIODS = Object.freeze([
  { key: '1m', label: '1 mês', range: '1M', interval: '1d', months: 1 },
  { key: '3m', label: '3 meses', range: '3M', interval: '1d', months: 3 },
  { key: '1y', label: '1 ano', range: '1Y', interval: '1d', months: 12 },
  { key: '2y', label: '2 anos', range: '2Y', interval: '1wk', months: 24 },
  { key: '5y', label: '5 anos', range: '5Y', interval: '1wk', months: 60 },
  { key: '10y', label: '10 anos', range: '10Y', interval: '1mo', months: 120 }
]);

const FII_INDEX_BENCHMARKS = Object.freeze([
  { key: 'ifix', code: 'IFIX', label: 'IFIX', ticker: 'IFIX', yahooSymbol: 'IFIX.SA' },
  { key: 'idiv', code: 'IDIV', label: 'IDIV', ticker: 'IDIV', yahooSymbol: 'IDIV.SA' },
  { key: 'smll', code: 'SMLL', label: 'SMLL', ticker: 'SMLL', yahooSymbol: 'SMLL.SA' }
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
  const canonical = buildInvestidor10CanonicalCharts({
    ticker,
    type: 'FII',
    html,
    apiExtras: { historicoIndicadoresFii: historicalRaw, rawJson: { historicoIndicadoresFii: historicalRaw }, apiStatus: [] }
  });
  const historicalIndicators = normalizeFiiHistoricalIndicatorsApi(historicalRaw || canonical?.fii?.fundamentalIndicatorHistory || {});
  return {
    ok: Boolean(html),
    url,
    status: response?.status || 0,
    cacheStatus: response?.cacheStatus,
    error: response?.error,
    html,
    ids,
    quickMetrics,
    returnsRows: returnsRowsFromInvestidor10(canonical),
    canonical,
    historicalIndicators,
    historicalStatus,
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

function normalizeComparisonPoints(history = {}) {
  const points = Array.isArray(history?.points) ? history.points.map(chartPointFromYahoo).filter(Boolean) : [];
  if (points.length < 2) return [];
  const first = Number(points[0].close);
  if (!Number.isFinite(first) || first <= 0) return [];
  return points.map(point => {
    const close = Number(point.close);
    const returnPercent = round(((close / first) - 1) * 100, 4);
    return {
      date: point.date,
      timestamp: point.timestamp,
      close: round(close, 4),
      value: returnPercent,
      returnPercent,
      investedValue: round(FII_COMPARISON_BASE_INVESTMENT * (1 + returnPercent / 100), 2)
    };
  });
}

function comparisonItemFromSeries(series, periodKey) {
  const first = series?.points?.[0];
  const last = series?.points?.at?.(-1);
  if (!first || !last) return null;
  return {
    id: series.id,
    code: series.code,
    label: series.label,
    periodKey,
    returnPercent: Number.isFinite(Number(last.returnPercent)) ? round(Number(last.returnPercent), 4) : null,
    returnDisplay: Number.isFinite(Number(last.returnPercent)) ? formatPercent(Number(last.returnPercent), true) : '—',
    investedValue: Number.isFinite(Number(last.investedValue)) ? round(Number(last.investedValue), 2) : null,
    investedValueDisplay: Number.isFinite(Number(last.investedValue)) ? `R$ ${Number(last.investedValue).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—',
    source: series.source
  };
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
  if (period.key === '2y') alternates.push({ range: period.range, interval: '1d', fallback: true });
  if (period.key === '5y') alternates.push({ range: period.range, interval: '1wk', fallback: true }, { range: period.range, interval: '1d', fallback: true });
  if (period.key === '10y') alternates.push({ range: period.range, interval: '1wk', fallback: true }, { range: period.range, interval: '1d', fallback: true });
  const seen = new Set();
  return [primary, ...alternates].filter(plan => {
    const key = `${plan.range}|${plan.interval}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function fetchComparisonSeriesHistory(item, period, timeoutMs) {
  const symbol = item.yahooSymbol || item.ticker;
  const plans = comparisonFetchPlans(period);
  let lastError = '';
  for (const plan of plans) {
    const history = await fetchYahooHistory(symbol, {
      range: plan.range,
      interval: plan.interval,
      timeoutMs,
      limit: period.key === '10y' ? 260 : 320,
      cache: true
    });
    const points = normalizeComparisonPoints(history);
    if (points.length >= 2) {
      return { history, points, plan, ok: true };
    }
    lastError = history?.error || history?.warning || `sem pontos suficientes em ${plan.range}/${plan.interval}`;
  }
  return { ok: false, points: [], error: lastError || 'Yahoo sem histórico suficiente' };
}

async function buildFiiYahooIndexComparison(ticker, timeoutMs = 8500) {
  const perCallTimeout = Math.min(6200, Math.max(3200, Math.floor(timeoutMs * 0.75)));
  const diagnostics = [];
  const periodEntries = await Promise.all(FII_COMPARISON_PERIODS.map(async period => {
    const tickers = [
      { key: 'asset', code: ticker, label: ticker, ticker, yahooSymbol: `${ticker}.SA`, sourceLabel: 'Yahoo Finance Chart API ativo' },
      ...FII_INDEX_BENCHMARKS.map(item => ({ ...item, sourceLabel: `Yahoo Finance Chart API índice direto ${item.yahooSymbol}` }))
    ];
    const histories = await Promise.allSettled(tickers.map(item => fetchComparisonSeriesHistory(item, period, perCallTimeout)));
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
        source: `${item.sourceLabel || value.history?.source || 'Yahoo Finance Chart API'}${value.plan?.fallback ? ' · fallback de intervalo' : ''}`,
        yahooSymbol: value.history?.symbol || item.yahooSymbol || `${item.ticker}.SA`,
        endpoint: `GET https://query1.finance.yahoo.com/v8/finance/chart/${item.yahooSymbol || item.ticker}?range=${String(value.history?.yahooRange || value.plan?.range || period.range).toLowerCase()}&interval=${value.history?.interval || value.plan?.interval || period.interval}&includePrePost=false`
      };
    }).filter(Boolean);
    return [period.key, { ...period, status: series.length >= 2 ? 'OK' : (series.length ? 'PARTIAL' : 'EMPTY'), series, items: series.map(item => comparisonItemFromSeries(item, period.key)).filter(Boolean) }];
  }));

  const quoteSettled = await Promise.allSettled(FII_INDEX_BENCHMARKS.map(item => fetchYahooQuote(item.yahooSymbol, { timeoutMs: Math.min(4200, perCallTimeout), interval: '1d' })));
  const indexQuotes = FII_INDEX_BENCHMARKS.map((item, index) => {
    const quote = quoteSettled[index].status === 'fulfilled' ? quoteSettled[index].value : {};
    if (quoteSettled[index].status !== 'fulfilled' || !quote?.ok) {
      diagnostics.push({ code: item.code, yahooSymbol: item.yahooSymbol, status: 'QUOTE_EMPTY', reason: quote?.error || quoteSettled[index].reason?.message || 'cotação indisponível' });
    }
    return indexQuoteFromYahooQuote(item, quote);
  });
  const seriesByPeriod = Object.fromEntries(periodEntries);
  const defaultPeriod = seriesByPeriod['2y']?.series?.length >= 2 ? '2y' : (Object.keys(seriesByPeriod).find(key => seriesByPeriod[key]?.series?.length >= 2) || '2y');
  const active = seriesByPeriod[defaultPeriod] || { series: [], items: [] };
  return {
    id: 'fii_asset_vs_yahoo_indices',
    title: `Comparação de ${ticker} com índices`,
    subtitle: 'Rentabilidade acumulada por cotação Yahoo. IFIX, IDIV e SMLL usam símbolos diretos, sem ETF ou ticker substituto.',
    status: active.series.length >= 2 ? 'OK' : (active.series.length ? 'PARTIAL' : (indexQuotes.some(item => item.ok) ? 'QUOTES_ONLY' : 'EMPTY')),
    defaultPeriod,
    baseInvestment: FII_COMPARISON_BASE_INVESTMENT,
    baseInvestmentDisplay: 'R$ 1.000,00',
    periods: FII_COMPARISON_PERIODS,
    seriesByPeriod,
    series: active.series,
    items: active.items,
    indexQuotes,
    diagnostics,
    source: 'Yahoo Finance Chart API',
    sourcePolicy: 'IFIX, IDIV e SMLL consultados exclusivamente pelo Yahoo Finance Chart API com IFIX.SA, IDIV.SA e SMLL.SA. Se o histórico de um período vier incompleto, o Proxy tenta intervalos alternativos do próprio Yahoo antes de devolver estado parcial.'
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
      .catch(error => ({ ok: false, items: [], sections: [], quickMetrics: {}, returnsRows: [], historicalIndicators: { columns: [], rows: [], status: 'EMPTY' }, error: error?.message || String(error), diagnostics: { found: false } })),
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

  const now = new Date().toISOString();
  const hasInvestidor10Data = Boolean(investidor10?.items?.length || investidor10?.returnsRows?.length || investidor10?.historicalIndicators?.rows?.length || metrics.some(m => String(m.source || '').startsWith('Investidor10') && m.value !== '—'));
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
    sourcePolicy: 'Modal único com StatusInvest, Fundamentus, BCB e fallbacks legados descartados. Para FIIs, cards rápidos, rentabilidade, informações cadastrais e histórico de indicadores fundamentalistas vêm do Investidor10. Cotação e comparação com IFIX, IDIV e SMLL usam Yahoo Finance Chart API com símbolos diretos, sem ETF/proxy/ticker substituto. A seção de comparação é sempre devolvida no contrato para o APK mostrar o bloco mesmo quando o Yahoo retornar histórico parcial.',
    sources: [
      { id: 'investidor10_fii_html', role: 'cards_rapidos_rentabilidade_informacoes' },
      { id: 'investidor10_fii_api', role: 'historico_indicadores_fundamentalistas' },
      { id: 'yahoo_chart', role: 'cotacao_tempo_real_apenas_sem_fundamentos' },
      { id: 'yahoo_direct_indices', role: 'comparacao_ifix_idiv_smll_yahoo_only' }
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
      historicalIndicatorsHttpStatus: investidor10?.historicalStatus?.status || 0,
      historicalIndicatorsError: investidor10?.historicalStatus?.error || '',
      comparisonStatus: comparison?.status || 'EMPTY',
      comparisonIndexQuotes: comparison?.indexQuotes?.filter?.(item => item.ok)?.length || 0,
      comparisonError: comparison?.error || '',
      statusInvestDiscarded: true,
      fundamentusDiscarded: true,
      legacyFallbackDiscarded: true
    }
  };
}

export const _test = { extractInvestidor10FiiInformation, extractInvestidor10FiiQuickMetrics, normalizeFiiHistoricalIndicatorsApi, returnsRowsFromInvestidor10, cleanInvestidor10InfoValue, normalizeComparisonPoints, comparisonItemFromSeries, firstHistoricalIndicatorValue, comparisonFetchPlans, FII_INDEX_BENCHMARKS, FII_COMPARISON_PERIODS, FII_MODAL_VERSION };
