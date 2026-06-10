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
      account: p.account || p.corretora || undefined,
    })).filter(p => p.ticker && p.quantity > 0);
  }
  const tickers = String(input.tickers || input.ticker || '').split(',').map(s => canonicalTicker(s.trim())).filter(Boolean);
  const quantities = String(input.quantities || input.quantity || input.qtd || '').split(',').map(x => toNumber(x));
  const avgPrices = String(input.avgPrices || input.averagePrices || input.averagePrice || input.precoMedio || '').split(',').map(x => toNumber(x));
  return tickers.map((ticker, i) => ({ ticker, quantity: quantities[i] || 0, averagePrice: avgPrices[i] || 0, firstPurchaseAt: 0 })).filter(p => p.ticker && p.quantity > 0);
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

  const byDate = new Map();
  histories.forEach((h, i) => {
    const p = normalized[i];
    for (const point of h?.points || []) {
      const date = String(point.date || '').slice(0, 10);
      if (!date || !Number.isFinite(point.close)) continue;
      const firstPurchaseAt = Number(p.firstPurchaseAt || 0);
      if (firstPurchaseAt > 0) {
        const pointMs = Date.parse(`${date}T23:59:59Z`);
        if (Number.isFinite(pointMs) && pointMs < firstPurchaseAt) continue;
      }
      const row = byDate.get(date) || { date, totalValue: 0, investedValue: 0, positions: {}, investedByTicker: {} };
      const value = Number((point.close * p.quantity).toFixed(2));
      const investedForTicker = Number((p.averagePrice * p.quantity).toFixed(2));
      row.totalValue = Number((row.totalValue + value).toFixed(2));
      row.investedValue = Number(((row.investedValue || 0) + investedForTicker).toFixed(2));
      row.positions[p.ticker] = value;
      row.investedByTicker[p.ticker] = investedForTicker;
      byDate.set(date, row);
    }
  });
  const investedValue = Number(normalized.reduce((sum, p) => sum + p.quantity * p.averagePrice, 0).toFixed(2));
  const series = Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date)).map(row => {
    const rowInvestedValue = Number((row.investedValue || investedValue || 0).toFixed(2));
    const pnl = row.totalValue - rowInvestedValue;
    const returnPercent = rowInvestedValue ? Number(((pnl / rowInvestedValue) * 100).toFixed(2)) : undefined;
    return { ...row, investedValue: rowInvestedValue, costBasis: rowInvestedValue, unrealizedPnL: Number(pnl.toFixed(2)), unrealizedPnLPct: returnPercent, unrealizedPnLPercent: returnPercent, returnPercent, returnPct: returnPercent };
  });
  return {
    ok: series.length > 0,
    version: PORTFOLIO_HISTORY_VERSION,
    source: 'YahooChart',
    range,
    interval: interval || undefined,
    positions: normalized,
    count: normalized.length,
    summary: summary(series, investedValue),
    series,
    points: series,
    history: series,
    errors,
    durationMs: Math.round(performance.now() - started),
  };
}
