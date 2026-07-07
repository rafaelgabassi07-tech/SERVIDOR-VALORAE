import { fetchYahooHistory } from '../market/yahoo.js';
import { canonicalTicker } from '../market/yahoo.js';

export const PORTFOLIO_HISTORY_VERSION = '21.12.0';

function toNumber(value, fallback = 0) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const n = Number(String(value ?? '').replace(/[^0-9,.-]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : fallback;
}

export function normalizePortfolioPositions(input = {}) {
  if (Array.isArray(input.positions)) {
    return input.positions.map(p => ({
      ticker: canonicalTicker(p.ticker),
      quantity: toNumber(p.quantity ?? p.qtd ?? p.shares),
      averagePrice: toNumber(p.averagePrice ?? p.avgPrice ?? p.precoMedio),
      firstPurchaseAt: toNumber(p.firstPurchaseAt ?? p.firstPurchaseMillis ?? p.purchaseAt ?? p.dataPrimeiraCompra, 0),
      currentPrice: toNumber(p.currentPrice ?? p.price ?? p.precoAtual ?? p.cotacao, 0),
      assetClass: p.assetClass || p.type || p.classe || undefined,
      name: p.name || p.nome || p.ticker || undefined,
      account: p.account || p.corretora || undefined,
    })).filter(p => p.ticker && p.quantity > 0);
  }
  const tickers = String(input.tickers || input.ticker || '').split(',').map(s => canonicalTicker(s.trim())).filter(Boolean);
  const quantities = String(input.quantities || input.quantity || input.qtd || '').split(',').map(x => toNumber(x));
  const avgPrices = String(input.avgPrices || input.averagePrices || input.averagePrice || input.precoMedio || '').split(',').map(x => toNumber(x));
  return tickers.map((ticker, i) => ({ ticker, quantity: quantities[i] || 0, averagePrice: avgPrices[i] || 0, currentPrice: 0, firstPurchaseAt: 0 })).filter(p => p.ticker && p.quantity > 0);
}

function rangeSeconds(range = '1Y') {
  const key = String(range || '1Y').toLowerCase();
  if (key === '1d') return 6 * 60 * 60;
  if (key === '5d') return 5 * 24 * 60 * 60;
  if (key === '1mo' || key === '1m') return 31 * 24 * 60 * 60;
  if (key === '3mo' || key === '3m') return 93 * 24 * 60 * 60;
  if (key === '6mo' || key === '6m') return 186 * 24 * 60 * 60;
  if (key === '5y') return 5 * 366 * 24 * 60 * 60;
  if (key === 'max') return 5 * 366 * 24 * 60 * 60;
  return 366 * 24 * 60 * 60;
}

function positionInvestedValue(p = {}) {
  return Number((toNumber(p.averagePrice) * toNumber(p.quantity)).toFixed(2));
}

function positionCurrentValue(p = {}) {
  const currentPrice = toNumber(p.currentPrice, 0);
  const price = currentPrice > 0 ? currentPrice : toNumber(p.averagePrice, 0);
  return Number((price * toNumber(p.quantity)).toFixed(2));
}

function isIntradayPortfolioHistory(range = '', interval = '') {
  const r = String(range || '').toLowerCase();
  const i = String(interval || '').toLowerCase();
  return r === '1d' || r === '5d' || /(?:m|h)$/.test(i);
}

function pointTimestampSeconds(point = {}) {
  const explicit = Number(point.timestamp ?? point.time ?? 0);
  if (Number.isFinite(explicit) && explicit > 0) return Math.floor(explicit > 9_999_999_999 ? explicit / 1000 : explicit);
  const parsed = Date.parse(String(point.date || point.datetime || point.label || ''));
  return Number.isFinite(parsed) ? Math.floor(parsed / 1000) : 0;
}

function pointDateKeyFromTimestamp(timestamp = 0) {
  if (!Number.isFinite(timestamp) || timestamp <= 0) return '';
  return new Date(timestamp * 1000).toISOString().slice(0, 10);
}

function normalizePortfolioHistoryPointsForPosition(history = {}, position = {}, { intraday = false } = {}) {
  const firstPurchaseAt = Number(position.firstPurchaseAt || 0);
  const firstPurchaseMs = firstPurchaseAt > 0 ? (firstPurchaseAt > 9_999_999_999 ? firstPurchaseAt : firstPurchaseAt * 1000) : 0;
  return (history?.points || [])
    .map(point => {
      const timestamp = pointTimestampSeconds(point);
      const close = toNumber(point.close, NaN);
      if (!timestamp || !Number.isFinite(close) || close <= 0) return null;
      if (firstPurchaseMs > 0 && timestamp * 1000 < firstPurchaseMs) return null;
      const dateKey = pointDateKeyFromTimestamp(timestamp);
      const bucketTimestamp = intraday ? timestamp : Math.floor(Date.parse(`${dateKey}T00:00:00Z`) / 1000);
      return {
        timestamp: bucketTimestamp,
        date: intraday ? new Date(timestamp * 1000).toISOString() : dateKey,
        close
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.timestamp - b.timestamp)
    .filter((point, index, array) => index === 0 || point.timestamp !== array[index - 1].timestamp || point.close !== array[index - 1].close);
}

function buildMergedPortfolioSeries(histories = [], normalized = [], { range = '1Y', interval } = {}) {
  const intraday = isIntradayPortfolioHistory(range, interval);
  const perPosition = histories.map((history, index) => ({
    position: normalized[index],
    points: normalizePortfolioHistoryPointsForPosition(history, normalized[index], { intraday })
  })).filter(row => row.position && row.points.length);
  if (!perPosition.length) return [];

  const timestamps = [...new Set(perPosition.flatMap(row => row.points.map(point => point.timestamp)))]
    .filter(value => Number.isFinite(value) && value > 0)
    .sort((a, b) => a - b);
  if (timestamps.length < 2) return [];

  const indices = new Array(perPosition.length).fill(0);
  const rows = [];
  for (const timestamp of timestamps) {
    let totalValue = 0;
    let investedValue = 0;
    const positions = {};
    const investedByTicker = {};
    let included = 0;
    perPosition.forEach((entry, idx) => {
      const points = entry.points;
      while (indices[idx] + 1 < points.length && points[indices[idx] + 1].timestamp <= timestamp) indices[idx] += 1;
      const point = points[indices[idx]];
      if (!point || point.timestamp > timestamp) return;
      const quantity = toNumber(entry.position.quantity);
      const price = toNumber(point.close);
      if (!(quantity > 0 && price > 0)) return;
      const value = Number((price * quantity).toFixed(2));
      const invested = Number((toNumber(entry.position.averagePrice) * quantity).toFixed(2));
      totalValue = Number((totalValue + value).toFixed(2));
      investedValue = Number((investedValue + invested).toFixed(2));
      positions[entry.position.ticker] = value;
      investedByTicker[entry.position.ticker] = invested;
      included += 1;
    });
    if (included > 0 && totalValue > 0) {
      const rowInvestedValue = investedValue || Number(normalized.reduce((sum, p) => sum + positionInvestedValue(p), 0).toFixed(2));
      const pnl = totalValue - rowInvestedValue;
      const returnPercent = rowInvestedValue ? Number(((pnl / rowInvestedValue) * 100).toFixed(2)) : undefined;
      rows.push({
        date: intraday ? new Date(timestamp * 1000).toISOString() : pointDateKeyFromTimestamp(timestamp),
        timestamp,
        totalValue,
        investedValue: rowInvestedValue,
        costBasis: rowInvestedValue,
        positions,
        investedByTicker,
        unrealizedPnL: Number(pnl.toFixed(2)),
        unrealizedPnLPct: returnPercent,
        unrealizedPnLPercent: returnPercent,
        returnPercent,
        returnPct: returnPercent,
        source: intraday ? 'YahooChartIntraday' : 'YahooChartDaily'
      });
    }
  }
  return rows;
}

function fallbackPortfolioHistorySeries(normalized = [], range = '1Y') {
  const nowMs = Date.now();
  const now = Math.floor(nowMs / 1000);
  const firstPurchaseSeconds = normalized
    .map(p => Number(p.firstPurchaseAt || 0))
    .filter(v => Number.isFinite(v) && v > 0)
    .map(v => Math.floor(v > 9_999_999_999 ? v / 1000 : v))
    .sort((a, b) => a - b)[0] || 0;
  const start = Math.min(
    Math.max(0, now - rangeSeconds(range)),
    Math.max(0, now - 60)
  );
  const effectiveStart = Math.max(start, firstPurchaseSeconds || 0);
  const safeStart = Math.min(effectiveStart || start, Math.max(0, now - 60));
  const mid = Math.min(now - 30, safeStart + Math.max(60, Math.floor((now - safeStart) / 2)));
  const investedValue = Number(normalized.reduce((sum, p) => sum + positionInvestedValue(p), 0).toFixed(2));
  const currentValue = Number(normalized.reduce((sum, p) => sum + positionCurrentValue(p), 0).toFixed(2));
  if (!(currentValue > 0 || investedValue > 0)) return [];
  const firstValue = investedValue > 0 ? investedValue : currentValue;
  const finalValue = currentValue > 0 ? currentValue : firstValue;
  const middleValue = Number(((firstValue + finalValue) / 2).toFixed(2));
  const dates = [safeStart, mid, now].filter((v, i, arr) => Number.isFinite(v) && v > 0 && arr.indexOf(v) === i).sort((a, b) => a - b);
  const values = dates.length <= 2 ? [firstValue, finalValue] : [firstValue, middleValue, finalValue];
  return dates.map((seconds, index) => {
    const totalValue = Number((values[Math.min(index, values.length - 1)] || finalValue).toFixed(2));
    const rowInvestedValue = investedValue || firstValue;
    const pnl = totalValue - rowInvestedValue;
    const returnPercent = rowInvestedValue ? Number(((pnl / rowInvestedValue) * 100).toFixed(2)) : undefined;
    const date = new Date(seconds * 1000).toISOString().slice(0, 10);
    return {
      date,
      timestamp: seconds,
      totalValue,
      investedValue: rowInvestedValue,
      costBasis: rowInvestedValue,
      positions: {},
      investedByTicker: {},
      unrealizedPnL: Number(pnl.toFixed(2)),
      unrealizedPnLPct: returnPercent,
      unrealizedPnLPercent: returnPercent,
      returnPercent,
      returnPct: returnPercent,
      fallback: true
    };
  });
}

function appendCurrentPortfolioPoint(series = [], normalized = [], { range = '1Y', interval } = {}) {
  const currentValue = Number(normalized.reduce((sum, p) => sum + positionCurrentValue(p), 0).toFixed(2));
  if (!Number.isFinite(currentValue) || currentValue <= 0) return series;
  const investedValue = Number(normalized.reduce((sum, p) => sum + positionInvestedValue(p), 0).toFixed(2));
  const now = new Date();
  const nowSeconds = Math.floor(now.getTime() / 1000);
  const date = now.toISOString().slice(0, 10);
  const pnl = currentValue - investedValue;
  const returnPercent = investedValue ? Number(((pnl / investedValue) * 100).toFixed(2)) : undefined;
  const currentRow = {
    date: isIntradayPortfolioHistory(range, interval) ? now.toISOString() : date,
    timestamp: nowSeconds,
    totalValue: currentValue,
    investedValue,
    costBasis: investedValue,
    positions: {},
    investedByTicker: {},
    unrealizedPnL: Number(pnl.toFixed(2)),
    unrealizedPnLPct: returnPercent,
    unrealizedPnLPercent: returnPercent,
    returnPercent,
    returnPct: returnPercent,
    source: 'currentPrice'
  };
  const cleanSeries = Array.isArray(series) ? series.filter(row => row && Number(row.totalValue) > 0) : [];
  if (!cleanSeries.length) return [currentRow];

  const intraday = isIntradayPortfolioHistory(range, interval);
  let clean;
  if (intraday) {
    const last = cleanSeries[cleanSeries.length - 1];
    const lastTimestamp = Number(last.timestamp || pointTimestampSeconds(last));
    clean = cleanSeries.slice();
    if (Number.isFinite(lastTimestamp) && Math.abs(nowSeconds - lastTimestamp) <= 15 * 60) {
      clean[clean.length - 1] = { ...currentRow, timestamp: Math.max(lastTimestamp, nowSeconds) };
      return clean.sort((a, b) => Number(a.timestamp || 0) - Number(b.timestamp || 0));
    }
    return [...clean, currentRow].sort((a, b) => Number(a.timestamp || 0) - Number(b.timestamp || 0));
  }

  clean = cleanSeries.filter(row => String(row.date || '').slice(0, 10) !== date);
  return [...clean, currentRow].sort((a, b) => Number(a.timestamp || pointTimestampSeconds(a) || 0) - Number(b.timestamp || pointTimestampSeconds(b) || 0));
}

function summary(series = [], investedValue = 0) {
  if (!series.length) return { points: 0, investedValue };
  const first = series[0];
  const last = series[series.length - 1];
  const values = series.map(p => p.totalValue).filter(Number.isFinite);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const finalInvestedValue = Number((last.investedValue || investedValue || 0).toFixed(2));
  const pnl = last.totalValue - finalInvestedValue;
  return {
    points: series.length,
    investedValue: finalInvestedValue,
    firstValue: first.totalValue,
    lastValue: last.totalValue,
    minValue: min,
    maxValue: max,
    unrealizedPnL: Number(pnl.toFixed(2)),
    unrealizedPnLPct: finalInvestedValue ? Number(((pnl / finalInvestedValue) * 100).toFixed(2)) : undefined,
    periodVariationPct: first.totalValue ? Number((((last.totalValue - first.totalValue) / first.totalValue) * 100).toFixed(2)) : undefined,
  };
}

export async function buildPortfolioHistory(positions, options = {}) {
  const normalized = normalizePortfolioPositions({ positions });
  const range = options.range || '1Y';
  const interval = options.interval;
  const timeoutMs = Number(options.timeoutMs || 9000);
  const maxConcurrency = Math.max(1, Math.min(Number(options.maxConcurrency || 4), 8, normalized.length || 1));
  const started = performance.now();
  const histories = new Array(normalized.length);
  const errors = [];
  let cursor = 0;
  async function worker() {
    while (cursor < normalized.length) {
      const i = cursor++;
      const p = normalized[i];
      const h = await fetchYahooHistory(p.ticker, { range, interval, timeoutMs, limit: options.limit });
      if (!h.ok) errors.push({ ticker: p.ticker, error: h.error });
      histories[i] = h;
    }
  }
  await Promise.all(Array.from({ length: maxConcurrency }, () => worker()));

  const investedValue = Number(normalized.reduce((sum, p) => sum + p.quantity * p.averagePrice, 0).toFixed(2));
  let series = buildMergedPortfolioSeries(histories, normalized, { range, interval });
  const remotePointCount = series.length;
  series = appendCurrentPortfolioPoint(series, normalized, { range, interval });
  if (series.length < 2) series = fallbackPortfolioHistorySeries(normalized, range);
  return {
    ok: series.length > 0,
    version: PORTFOLIO_HISTORY_VERSION,
    source: remotePointCount > 0 ? 'YahooChart+CurrentPrice' : 'CurrentPriceFallback',
    range,
    interval: interval || undefined,
    positions: normalized,
    count: normalized.length,
    remotePointCount,
    fallbackUsed: remotePointCount === 0 || series.some(row => row.fallback),
    summary: summary(series, investedValue),
    series,
    points: series,
    history: series,
    errors,
    durationMs: Math.round(performance.now() - started),
  };
}
