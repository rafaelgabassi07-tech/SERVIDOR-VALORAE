import { classifyTicker, normalizeTicker } from '../core/tickers.js';
import { round } from '../core/numbers.js';
import { buildAssetsPayload } from '../sources/quotes.js';
import { fetchYahooHistory } from '../market/yahoo.js';
import { getIpcaSeries } from '../sources/ipca.js';
import { RELEASE } from '../core/release.js';

const FII_MODAL_VERSION = '26.asset-modal.fii.v1';

const RETURN_PERIODS = Object.freeze([
  { key: '1m', label: '1 mês', range: '1M', interval: '1d', months: 1 },
  { key: '3m', label: '3 meses', range: '3M', interval: '1d', months: 3 },
  { key: '1y', label: '1 ano', range: '1Y', interval: '1d', months: 12 },
  { key: '2y', label: '2 anos', range: '2Y', interval: '1wk', months: 24 },
  { key: '5y', label: '5 anos', range: '5Y', interval: '1wk', months: 60 },
  { key: '10y', label: '10 anos', range: '10Y', interval: '1mo', months: 120 }
]);

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
  const [assetsPayload, oneYearHistory, ipca] = await Promise.all([
    buildAssetsPayload({ tickers: [ticker], max: 1, timeoutMs: Number(payload.quoteTimeoutMs || 4200), fundamentalTimeoutMs: Number(payload.fundamentalTimeoutMs || 5200), fundamentusTimeoutMs: Number(payload.fundamentusTimeoutMs || 5200) })
      .catch(error => ({ status: 'ERROR', items: [], error: error?.message || String(error) })),
    fetchYahooHistory(ticker, { range: payload.range || '1Y', interval: payload.interval || '1d', timeoutMs, limit: Number(payload.limit || 260) })
      .catch(error => ({ ok: false, points: [], error: error?.message || String(error), source: 'YahooChart' })),
    getIpcaSeries(120).catch(error => ({ status: 'EMPTY', points: [], error: error?.message || String(error) }))
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
    sourcePolicy: 'Reconstrução do modal de FII sem StatusInvest, sem Investidor10 e sem fallback visual legado. Cotação e gráfico usam Yahoo Finance Chart API; indicadores rápidos usam snapshot fundamentalista via Fundamentus quando disponível; rentabilidade real usa IPCA BCB quando disponível.',
    sources: [
      { id: 'yahoo_chart', role: 'cotacao_grafico_rentabilidade' },
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
    diagnostics: {
      assetsStatus: assetsPayload?.status,
      fundamentalsStatus: assetsPayload?.fundamentalsSnapshot?.status,
      chartOk: chartPoints.length > 1,
      ipcaStatus: ipca?.status,
      statusInvestDiscarded: true,
      investidor10Discarded: true,
      legacyFallbackDiscarded: true
    }
  };
}
