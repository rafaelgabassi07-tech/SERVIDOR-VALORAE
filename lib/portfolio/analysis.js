import { portfolioSummary, normalizePositions, normalizeTransactions } from './positions.js';
import { classifyTicker } from '../core/tickers.js';
import { getAssetHistory } from '../sources/asset-details.js';
import { round } from '../core/numbers.js';

export function buildPortfolioAnalysis(payload = {}) {
  const summary = portfolioSummary(payload.positions || []);
  const positions = normalizePositions(payload.positions || []);
  const total = summary.totalMarketValue || 1;
  const allocation = positions.map(p => ({ ticker: p.ticker, marketValue: p.marketValue, invested: p.invested, weight: round((p.marketValue / total) * 100, 2), assetClass: classifyTicker(p.ticker) })).sort((a,b) => b.weight - a.weight);
  const classes = {};
  for (const item of allocation) classes[item.assetClass] = round((classes[item.assetClass] || 0) + item.weight, 2);
  const concentrationTop5 = round(allocation.slice(0,5).reduce((s,p) => s + p.weight, 0), 2);
  const alerts = [];
  if (allocation[0]?.weight > 30) alerts.push({ level: 'warning', code: 'HIGH_SINGLE_ASSET', message: `${allocation[0].ticker} concentra ${allocation[0].weight}% da carteira.` });
  if (positions.length < 5 && positions.length > 0) alerts.push({ level: 'info', code: 'LOW_DIVERSIFICATION', message: 'Carteira com poucos ativos; revisar diversificação.' });
  return {
    status: 'OK',
    summary,
    totals: summary,
    allocation,
    allocationByTicker: allocation,
    allocationByClass: Object.entries(classes).map(([assetClass, weight]) => ({ assetClass, weight })),
    risk: { concentrationTop5, alerts, diversificationScore: Math.max(0, Math.min(100, round(100 - concentrationTop5 + Math.min(positions.length, 20), 1))) },
    rebalance: allocation.map(p => ({ ticker: p.ticker, currentWeight: p.weight, targetWeight: round(100 / Math.max(positions.length, 1), 2), action: p.weight > 100 / Math.max(positions.length, 1) * 1.5 ? 'REDUZIR' : 'MANTER' })),
    income: { monthlyEstimate: 0, annualEstimate: 0, note: 'Estimativa calculada quando os eventos de proventos retornam valor elegível.' }
  };
}

function portfolioStartDate(payload = {}, positions = []) {
  const raw = payload.startDate || payload.firstPurchaseDate || payload.firstPurchaseAt ||
    positions.map(p => p.firstPurchaseDate).filter(Boolean).sort()[0] || '';
  if (!raw) return null;
  if (typeof raw === 'number' || /^\d+$/.test(String(raw))) {
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0) return new Date(n > 10_000_000_000 ? n : n * 1000);
  }
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function tsMillis(value) {
  if (!value) return 0;
  if (typeof value === 'number' || /^\d+$/.test(String(value))) {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? (n > 10_000_000_000 ? n : n * 1000) : 0;
  }
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

function monthStartUtc(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function monthEndUtc(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0, 23, 59, 59, 999));
}

function historyRangeForMonths(months) {
  const n = Number(months || 12);
  if (n <= 12) return '1Y';
  if (n <= 60) return '5Y';
  return 'MAX';
}

function pricePointMillis(point = {}) {
  return tsMillis(point.date || point.time || point.timestamp || point.month);
}

function pricePointClose(point = {}) {
  const value = Number(point.close ?? point.price ?? point.value ?? point.adjClose ?? point.lastPrice ?? 0);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function normalizeHistoryPricePoints(history = {}) {
  const rows = history.points || history.history || history.series || history.prices || history.chartHistory || [];
  if (!Array.isArray(rows)) return [];
  return rows
    .map((point) => ({ millis: pricePointMillis(point), close: pricePointClose(point) }))
    .filter((point) => point.millis > 0 && point.close > 0)
    .sort((a, b) => a.millis - b.millis);
}

function monthCloseAtOrBefore(points = [], monthStart, boundary) {
  let selected = null;
  for (const point of points) {
    if (point.millis < monthStart) continue;
    if (point.millis > boundary) break;
    selected = point;
  }
  return selected?.close || 0;
}

function transactionBucketsAtBoundary(transactions = [], boundary) {
  const buckets = new Map();
  const ordered = transactions.filter(t => t.millis > 0 && t.millis <= boundary).sort((a, b) => a.millis - b.millis);
  for (const tx of ordered) {
    const bucket = buckets.get(tx.ticker) || { quantity: 0, costBasis: 0 };
    const qty = Math.abs(Number(tx.quantity || 0));
    const price = Number(tx.price || 0);
    if (!Number.isFinite(qty) || qty <= 0) continue;
    if (tx.quantity >= 0) {
      bucket.quantity += qty;
      bucket.costBasis += qty * (Number.isFinite(price) && price > 0 ? price : 0);
    } else if (bucket.quantity > 0) {
      const sold = Math.min(qty, bucket.quantity);
      const avg = bucket.quantity > 0 ? bucket.costBasis / bucket.quantity : 0;
      bucket.quantity -= sold;
      bucket.costBasis -= sold * avg;
      if (bucket.quantity <= 0.000001) {
        bucket.quantity = 0;
        bucket.costBasis = 0;
      }
    }
    buckets.set(tx.ticker, bucket);
  }
  return buckets;
}

function normalizeProvidedPortfolioHistory(payload = {}) {
  const rows = payload.portfolioHistory || payload.historyPoints || payload.history || payload.points || payload.series || [];
  if (!Array.isArray(rows) || rows.length === 0) {
    return { status: 'EMPTY', points: [], history: [], series: [], source: 'VALORAE Proxy real-only portfolio-history', reason: 'real-market-history-required' };
  }
  const syntheticPattern = /(fallback|estimativa|simulad|synthetic|normalized|position-aware|transaction-aware)/i;
  const points = rows.map((item = {}) => {
    const source = String(item.source || payload.source || 'VALORAE external portfolio-history');
    if (syntheticPattern.test(source)) return null;
    const date = item.date || item.time || item.timestamp || item.month;
    const millis = tsMillis(date);
    const value = round(Number(item.totalValue ?? item.value ?? item.portfolioValue ?? 0), 2);
    const invested = round(Number(item.investedValue ?? item.invested ?? item.costBasis ?? 0), 2);
    const rawReturn = Number(item.returnPercent ?? item.returnPct ?? item.variationPct ?? item.rentabilidadePercentual ?? NaN);
    const returnPercent = Number.isFinite(rawReturn) ? round(rawReturn, 2) : (invested > 0 && value > 0 ? round(((value - invested) / invested) * 100, 2) : 0);
    if (!millis || (value <= 0 && invested <= 0 && returnPercent === 0)) return null;
    return {
      date: new Date(millis).toISOString().slice(0, 10),
      month: new Date(millis).toISOString().slice(0, 7),
      value,
      patrimonio: value,
      totalValue: value,
      investedValue: invested,
      invested,
      returnPercent,
      returnPct: returnPercent,
      source
    };
  }).filter(Boolean).sort((a, b) => tsMillis(a.date) - tsMillis(b.date));
  return { status: points.length ? 'OK' : 'EMPTY', points, history: points, series: points, source: 'VALORAE Proxy external real portfolio-history', reason: points.length ? undefined : 'provided-history-empty-or-synthetic' };
}

export function buildHistory(payload = {}) {
  // Real-only mode: this synchronous compatibility path no longer fabricates portfolio
  // curves from current prices. It only echoes already-provided real portfolio history.
  return normalizeProvidedPortfolioHistory(payload);
}

export async function buildRealMarketHistory(payload = {}) {
  const provided = normalizeProvidedPortfolioHistory(payload);
  if (provided.points.length) return provided;

  const positions = normalizePositions(payload.positions || []);
  const transactions = normalizeTransactions(payload.transactions || []);
  if (!transactions.length) {
    return { status: 'EMPTY', points: [], history: [], series: [], source: 'VALORAE Proxy real-only portfolio-history', reason: 'transactions-required-for-real-portfolio-history' };
  }

  const requestedMonths = Number(payload.historyMonths || payload.months || 12);
  const now = new Date();
  const firstTxMillis = Math.min(...transactions.map(t => t.millis).filter(Number.isFinite));
  if (!Number.isFinite(firstTxMillis) || firstTxMillis <= 0) {
    return { status: 'EMPTY', points: [], history: [], series: [], source: 'VALORAE Proxy real-only portfolio-history', reason: 'valid-transaction-dates-required' };
  }
  const startDate = portfolioStartDate(payload, positions) || new Date(firstTxMillis);
  const ageMonths = ((now.getUTCFullYear() - startDate.getUTCFullYear()) * 12 + (now.getUTCMonth() - startDate.getUTCMonth()) + 1);
  const months = Math.max(1, Math.min(120, Number.isFinite(requestedMonths) ? Math.max(requestedMonths, ageMonths || 1) : (ageMonths || 12)));
  const tickers = [...new Set(transactions.map(t => t.ticker).filter(Boolean))].slice(0, Number(payload.maxHistoryTickers || 35));
  if (!tickers.length) {
    return { status: 'EMPTY', points: [], history: [], series: [], source: 'VALORAE Proxy real-only portfolio-history', reason: 'tickers-required' };
  }

  const range = historyRangeForMonths(months);
  const priceEntries = await Promise.all(tickers.map(async (ticker) => {
    try {
      const history = await getAssetHistory({ ticker, range, timeoutMs: Number(payload.timeoutMs || 3800), limit: 320 });
      return [ticker, normalizeHistoryPricePoints(history), history?.status || 'EMPTY'];
    } catch (error) {
      return [ticker, [], 'ERROR'];
    }
  }));
  const pricesByTicker = new Map(priceEntries.map(([ticker, points]) => [ticker, points]));
  const unavailableTickers = priceEntries.filter(([, points]) => !points.length).map(([ticker]) => ticker);

  const points = [];
  const skippedMonths = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = monthStartUtc(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1)));
    if (d < monthStartUtc(startDate)) continue;
    const monthStart = d.getTime();
    const boundary = monthEndUtc(d).getTime();
    const buckets = transactionBucketsAtBoundary(transactions, boundary);
    const active = [...buckets.entries()].filter(([, b]) => b.quantity > 0.000001 && b.costBasis > 0);
    if (!active.length) continue;

    let invested = 0;
    let value = 0;
    let missing = false;
    const components = [];
    for (const [ticker, bucket] of active) {
      const close = monthCloseAtOrBefore(pricesByTicker.get(ticker) || [], monthStart, boundary);
      if (close <= 0) {
        missing = true;
        break;
      }
      const tickerValue = bucket.quantity * close;
      invested += Math.max(0, bucket.costBasis);
      value += tickerValue;
      components.push({ ticker, quantity: round(bucket.quantity, 8), close: round(close, 4), value: round(tickerValue, 2), invested: round(bucket.costBasis, 2) });
    }
    if (missing || invested <= 0 || value <= 0) {
      skippedMonths.push(d.toISOString().slice(0, 7));
      continue;
    }
    const totalValue = round(value, 2);
    const investedValue = round(invested, 2);
    const returnPercent = round(((totalValue - investedValue) / investedValue) * 100, 2);
    points.push({
      date: d.toISOString().slice(0, 10),
      month: d.toISOString().slice(0, 7),
      value: totalValue,
      patrimonio: totalValue,
      totalValue,
      investedValue,
      invested: investedValue,
      returnPercent,
      returnPct: returnPercent,
      components,
      source: 'VALORAE Proxy real portfolio-history Yahoo Finance + transações'
    });
  }

  return {
    status: points.length ? (skippedMonths.length || unavailableTickers.length ? 'PARTIAL' : 'OK') : 'EMPTY',
    points,
    history: points,
    series: points,
    source: 'VALORAE Proxy real portfolio-history Yahoo Finance + transações',
    realOnly: true,
    partial: Boolean(skippedMonths.length || unavailableTickers.length),
    skippedMonths,
    unavailableTickers,
    reason: points.length ? undefined : 'insufficient-real-price-history'
  };
}

export function buildRankings(payload = {}) {
  const positions = normalizePositions(payload.positions || []);
  const rows = positions.map((p, index) => ({ ticker: p.ticker, rank: index + 1, score: Math.max(1, round(100 - index * 4, 1)), assetClass: classifyTicker(p.ticker), reason: 'Ranking local leve para o contrato mobile.' }));
  return { status: rows.length ? 'OK' : 'EMPTY', portfolio: rows, items: rows, rankings: rows };
}


export function buildAssetHistory(payload = {}) {
  const ticker = String(payload.ticker || payload.symbol || payload.q || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  const currentPrice = Number(payload.currentPrice || payload.price || payload.lastPrice || payload.cotacao || 0);
  const months = Number(payload.months || payload.historyMonths || 12);
  if (!ticker) return { status: 'EMPTY', ticker: '', points: [], history: [], series: [], chartHistory: [] };
  if (!Number.isFinite(currentPrice) || currentPrice <= 0) {
    return { status: 'EMPTY', ticker, points: [], history: [], series: [], chartHistory: [], reason: 'missingPriceSource' };
  }
  const points = [];
  const now = new Date();
  for (let i = Math.max(1, months) - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const progress = months <= 1 ? 1 : (months - i) / months;
    const close = round(currentPrice * (0.96 + progress * 0.04), 2);
    points.push({ date: d.toISOString().slice(0,10), month: d.toISOString().slice(0,7), ticker, close, price: close, value: close });
  }
  return { status: 'OK', ticker, points, history: points, series: points, chartHistory: points, source: 'VALORAE Proxy normalized-asset-history' };
}
