import { classifyTicker, normalizeTicker } from '../core/tickers.js';
import { round } from '../core/numbers.js';
import { buildAssetsPayload } from '../sources/quotes.js';
import { fetchYahooHistory } from '../market/yahoo.js';
import { getIpcaSeries } from '../sources/ipca.js';
import { fetchText } from '../sources/fetch.js';
import { RELEASE } from '../core/release.js';

const FII_MODAL_VERSION = '26.asset-modal.fii.v2';

const RETURN_PERIODS = Object.freeze([
  { key: '1m', label: '1 mês', range: '1M', interval: '1d', months: 1 },
  { key: '3m', label: '3 meses', range: '3M', interval: '1d', months: 3 },
  { key: '1y', label: '1 ano', range: '1Y', interval: '1d', months: 12 },
  { key: '2y', label: '2 anos', range: '2Y', interval: '1wk', months: 24 },
  { key: '5y', label: '5 anos', range: '5Y', interval: '1wk', months: 60 },
  { key: '10y', label: '10 anos', range: '10Y', interval: '1mo', months: 120 }
]);


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
    .replace(/^[:\-–—•\s]+|[:\-–—•\s]+$/g, '')
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

async function fetchInvestidor10FiiInformation(ticker, timeoutMs = 6500) {
  const url = `https://investidor10.com.br/fiis/${ticker.toLowerCase()}/`;
  const response = await fetchText(url, {
    timeoutMs,
    ttlMs: 15 * 60 * 1000,
    staleMs: 0,
    retries: 1,
    headers: { Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' }
  });
  const parsed = response?.text ? extractInvestidor10FiiInformation(response.text, ticker) : { items: [], sections: [], diagnostics: { found: false } };
  return {
    ok: Boolean(parsed.items.length),
    url,
    status: response?.status || 0,
    cacheStatus: response?.cacheStatus,
    error: response?.error,
    ...parsed
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
      message: 'Esta primeira reconstrução do modal foi dedicada somente a fundos imobiliários.'
    };
  }

  const timeoutMs = Number(payload.timeoutMs || 8500);
  const [assetsPayload, oneYearHistory, ipca, investidor10Info] = await Promise.all([
    buildAssetsPayload({ tickers: [ticker], max: 1, timeoutMs: Number(payload.quoteTimeoutMs || 4200), fundamentalTimeoutMs: Number(payload.fundamentalTimeoutMs || 5200), fundamentusTimeoutMs: Number(payload.fundamentusTimeoutMs || 5200) })
      .catch(error => ({ status: 'ERROR', items: [], error: error?.message || String(error) })),
    fetchYahooHistory(ticker, { range: payload.range || '1Y', interval: payload.interval || '1d', timeoutMs, limit: Number(payload.limit || 260) })
      .catch(error => ({ ok: false, points: [], error: error?.message || String(error), source: 'YahooChart' })),
    getIpcaSeries(120).catch(error => ({ status: 'EMPTY', points: [], error: error?.message || String(error) })),
    fetchInvestidor10FiiInformation(ticker, Number(payload.investidor10TimeoutMs || 6500))
      .catch(error => ({ ok: false, items: [], sections: [], error: error?.message || String(error), diagnostics: { found: false } }))
  ]);

  const quote = assetsPayload?.items?.[0] || assetsPayload?.assets?.[0] || assetsPayload?.quotes?.[0] || {};
  const chartPoints = (oneYearHistory?.points || []).map(chartPointFromYahoo).filter(Boolean);
  const returnHistories = await Promise.all(RETURN_PERIODS.map(period =>
    fetchYahooHistory(ticker, { range: period.range, interval: period.interval, timeoutMs, limit: period.months >= 60 ? 640 : 280 })
      .then(history => ({ period, history, error: null }))
      .catch(error => ({ period, history: null, error: error?.message || String(error) }))
  ));
  const ipcaPoints = Array.isArray(ipca?.points) ? ipca.points : [];
  const returnRows = returnHistories.map(({ period, history, error }) => {
    const nominal = performanceFromHistory(history);
    const inflation = accumulatedIpcaPercent(ipcaPoints, period.months);
    const real = realReturnPercent(nominal, inflation);
    return {
      key: period.key,
      label: period.label,
      range: period.range,
      months: period.months,
      returnPercent: nominal,
      returnDisplay: nominal === null ? '—' : formatPercent(nominal, false),
      realReturnPercent: real,
      realReturnDisplay: real === null ? '—' : formatPercent(real, false),
      inflationPercent: inflation,
      inflationDisplay: inflation === null ? '—' : formatPercent(inflation, false),
      source: history?.source || 'YahooChart',
      warning: error || history?.error || undefined
    };
  });

  const variation12m = chartSummary(chartPoints).variationPercent;
  const price = Number(quote.currentPrice ?? quote.price ?? oneYearHistory?.regularMarketPrice ?? chartPoints.at(-1)?.close);
  const dy12m = Number(quote.dividendYield ?? quote.dy ?? quote.yield12m);
  const pvp = Number(quote.pvp ?? quote.priceToBook);
  const dailyLiquidity = Number(quote.dailyLiquidity ?? quote.averageDailyLiquidity ?? quote.liquidezMediaDiaria ?? quote.liquidezDiaria);
  const metrics = [
    { id: 'price', label: `${ticker} cotação`, value: Number.isFinite(price) && price > 0 ? formatCurrency(price) : quote.priceDisplay || 'Atualizando', numericValue: Number.isFinite(price) ? round(price, 4) : null, source: 'Yahoo Finance Chart API' },
    { id: 'dy12m', label: `${ticker} DY (12M)`, value: quote.dividendYieldDisplay || quote.dyDisplay || (Number.isFinite(dy12m) ? formatPercent(dy12m) : '—'), numericValue: Number.isFinite(dy12m) ? round(dy12m, 4) : null, source: assetsPayload?.fundamentalsSnapshot?.source || 'Fundamentus' },
    { id: 'pvp', label: 'P/VP', value: quote.pvpDisplay || quote.pVpDisplay || (Number.isFinite(pvp) ? String(round(pvp, 2)).replace('.', ',') : '—'), numericValue: Number.isFinite(pvp) ? round(pvp, 4) : null, source: assetsPayload?.fundamentalsSnapshot?.source || 'Fundamentus' },
    { id: 'daily_liquidity', label: 'Liquidez diária', value: quote.dailyLiquidityDisplay || quote.liquidityDisplay || (Number.isFinite(dailyLiquidity) ? formatCompactMoney(dailyLiquidity) : '—'), numericValue: Number.isFinite(dailyLiquidity) ? round(dailyLiquidity, 2) : null, source: assetsPayload?.fundamentalsSnapshot?.source || 'Fundamentus' },
    { id: 'variation_12m', label: 'Variação (12M)', value: variation12m === null ? '—' : formatPercent(variation12m, false), numericValue: variation12m, source: 'Yahoo Finance Chart API' }
  ];

  const now = new Date().toISOString();
  const status = chartPoints.length > 1 || metrics.some(m => m.numericValue !== null) ? 'OK' : 'PARTIAL';
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
    name: quote.name || ticker,
    updatedAt: now,
    sourcePolicy: 'Reconstrução do modal de FII sem StatusInvest e sem fallback visual legado. Cotação, gráfico e rentabilidade nominal usam Yahoo Finance Chart API; informações cadastrais/classificação usam Investidor10 quando o bloco oficial estiver disponível; indicadores rápidos usam snapshot fundamentalista via Fundamentus quando disponível; rentabilidade real usa IPCA BCB quando disponível.',
    sources: [
      { id: 'yahoo_chart', role: 'cotacao_grafico_rentabilidade' },
      { id: 'investidor10_fii_html', role: 'informacoes_cadastrais_classificacao_gestao_patrimonio' },
      { id: 'fundamentus_snapshot', role: 'dy_pvp_liquidez' },
      { id: 'bcb_ipca', role: 'rentabilidade_real' }
    ],
    quoteSummary: {
      ticker,
      name: quote.name || ticker,
      price: Number.isFinite(price) ? round(price, 4) : null,
      priceDisplay: Number.isFinite(price) && price > 0 ? formatCurrency(price) : quote.priceDisplay || 'Atualizando',
      changePercent: Number.isFinite(Number(quote.changePercent ?? quote.variationPercent)) ? round(Number(quote.changePercent ?? quote.variationPercent), 4) : null,
      changeDisplay: quote.changeDisplay || quote.variationDisplay || '',
      dy12m: Number.isFinite(dy12m) ? round(dy12m, 4) : null,
      pvp: Number.isFinite(pvp) ? round(pvp, 4) : null,
      dailyLiquidity: Number.isFinite(dailyLiquidity) ? round(dailyLiquidity, 2) : null,
      variation12mPercent: variation12m,
      source: quote.source || 'Yahoo Finance Chart API + Fundamentus'
    },
    metrics,
    chart: {
      id: 'yahoo_price_history',
      title: `Cotação ${ticker}`,
      range: oneYearHistory?.range || '1Y',
      interval: oneYearHistory?.interval || '1d',
      currency: oneYearHistory?.currency || 'BRL',
      source: 'Yahoo Finance Chart API',
      points: chartPoints,
      summary: chartSummary(chartPoints),
      warning: oneYearHistory?.error || undefined
    },
    returns: {
      title: `Rentabilidade de ${quote.name || ticker}`,
      rows: returnRows,
      inflationSource: ipca?.source || 'BCB SGS 433',
      nominalSource: 'Yahoo Finance Chart API'
    },
    information: {
      title: `Informações sobre ${ticker}`,
      source: 'Investidor10',
      sourceUrl: investidor10Info?.url || `https://investidor10.com.br/fiis/${ticker.toLowerCase()}/`,
      status: investidor10Info?.items?.length ? 'OK' : 'EMPTY',
      items: investidor10Info?.items || [],
      sections: investidor10Info?.sections || []
    },
    infoSections: investidor10Info?.sections || [],
    diagnostics: {
      assetsStatus: assetsPayload?.status,
      fundamentalsStatus: assetsPayload?.fundamentalsSnapshot?.status,
      chartOk: chartPoints.length > 1,
      ipcaStatus: ipca?.status,
      investidor10InfoStatus: investidor10Info?.status || 0,
      investidor10InfoCacheStatus: investidor10Info?.cacheStatus,
      investidor10InfoFound: Boolean(investidor10Info?.items?.length),
      investidor10InfoError: investidor10Info?.error,
      statusInvestDiscarded: true,
      legacyFallbackDiscarded: true
    }
  };
}


export const _test = { extractInvestidor10FiiInformation, cleanInvestidor10InfoValue };
