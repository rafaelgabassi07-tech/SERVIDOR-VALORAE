import { fetchYahooHistory } from '../market/yahoo.js';
import { canonicalTicker } from '../market/yahoo.js';

export const PORTFOLIO_HISTORY_VERSION = '21.12.328-full-regression-corrections-improvements-v299';
export const PORTFOLIO_HISTORY_ENGINE_HARDENING_V291 = 'VALORAE_REALTIME_PORTFOLIO_HISTORY_ENGINE_V291';

function toNumber(value, fallback = 0) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const n = Number(String(value ?? '').replace(/[^0-9,.-]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : fallback;
}

function parseArrayInput(value) {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null) return [];
  if (typeof value === 'string') {
    const raw = value.trim();
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

export function normalizePortfolioPositions(input = {}) {
  const positionRows = parseArrayInput(input.positions);
  if (positionRows.length) {
    return positionRows.map(p => ({
      ticker: canonicalTicker(p.ticker || p.symbol || p.codigo || p.ativo),
      quantity: toNumber(p.quantity ?? p.qtd ?? p.shares ?? p.quantidade),
      averagePrice: toNumber(p.averagePrice ?? p.avgPrice ?? p.precoMedio ?? p.average ?? p.avg),
      firstPurchaseAt: toNumber(p.firstPurchaseAt ?? p.firstPurchaseMillis ?? p.purchaseAt ?? p.dataPrimeiraCompra ?? p.date ?? p.data, 0),
      currentPrice: toNumber(p.currentPrice ?? p.price ?? p.precoAtual ?? p.cotacao ?? p.lastPrice, 0),
      assetClass: p.assetClass || p.assetType || p.type || p.classe || undefined,
      name: p.name || p.nome || p.ticker || p.symbol || undefined,
      account: p.account || p.corretora || undefined,
    })).filter(p => p.ticker && p.quantity > 0);
  }
  const tickers = String(input.tickers || input.ticker || input.symbols || input.symbol || '').split(',').map(s => canonicalTicker(s.trim())).filter(Boolean);
  const quantities = String(input.quantities || input.quantity || input.qtd || '').split(',').map(x => toNumber(x));
  const avgPrices = String(input.avgPrices || input.averagePrices || input.averagePrice || input.precoMedio || '').split(',').map(x => toNumber(x));
  return tickers.map((ticker, i) => ({ ticker, quantity: quantities[i] || 0, averagePrice: avgPrices[i] || 0, currentPrice: 0, firstPurchaseAt: 0 })).filter(p => p.ticker && p.quantity > 0);
}

function parsePortfolioDateSeconds(value) {
  if (value === undefined || value === null) return 0;
  const raw = String(value).trim();
  if (!raw) return 0;
  const numeric = Number(raw);
  if (Number.isFinite(numeric) && numeric > 0) return Math.floor(numeric > 9_999_999_999 ? numeric / 1000 : numeric);
  const iso = Date.parse(raw);
  if (Number.isFinite(iso)) return Math.floor(iso / 1000);
  const br = raw.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})$/);
  if (br) {
    const day = Number(br[1]);
    const month = Number(br[2]);
    const year = Number(br[3].length === 2 ? `20${br[3]}` : br[3]);
    const ts = Date.UTC(year, month - 1, day) / 1000;
    return Number.isFinite(ts) ? Math.floor(ts) : 0;
  }
  return 0;
}

function normalizeTransactionSide(tx = {}, quantity = 0) {
  const raw = String(tx.side || tx.operation || tx.tipo || tx.type || '').trim().toUpperCase();
  if (/^(SELL|SALE|VENDA|V|SAIDA|SAÍDA|RESGATE)/.test(raw)) return 'SELL';
  if (/^(BUY|COMPRA|C|ENTRADA|APORTE)/.test(raw)) return 'BUY';
  return Number(quantity) < 0 ? 'SELL' : 'BUY';
}

export function normalizePortfolioTransactions(input = {}) {
  const rows = parseArrayInput(input.transactions);
  return rows.map(tx => {
    const ticker = canonicalTicker(tx.ticker || tx.symbol || tx.codigo || tx.ativo);
    const rawQuantity = toNumber(tx.quantity ?? tx.qtd ?? tx.shares ?? tx.quantidade, 0);
    const side = normalizeTransactionSide(tx, rawQuantity);
    const quantity = Math.abs(rawQuantity);
    const price = toNumber(tx.price ?? tx.preco ?? tx.unitPrice ?? tx.precoUnitario, 0);
    const grossValue = Math.abs(toNumber(tx.grossValue ?? tx.total ?? tx.valor ?? tx.value, 0)) || Number((quantity * price).toFixed(2));
    const timestamp = parsePortfolioDateSeconds(tx.timestamp ?? tx.time ?? tx.date ?? tx.data ?? tx.firstPurchaseAt);
    return {
      ticker,
      quantity,
      price,
      grossValue,
      timestamp,
      date: timestamp ? new Date(timestamp * 1000).toISOString().slice(0, 10) : String(tx.date || tx.data || ''),
      side,
      operation: tx.operation || tx.side || undefined,
      assetClass: tx.assetClass || tx.assetType || tx.type || undefined,
      source: tx.source || undefined,
    };
  }).filter(tx => tx.ticker && tx.quantity > 0 && tx.timestamp > 0)
    .sort((a, b) => a.timestamp - b.timestamp || a.ticker.localeCompare(b.ticker));
}

function mergeHistoryPositions(activePositions = [], transactions = []) {
  const byTicker = new Map();
  for (const p of activePositions) byTicker.set(p.ticker, { ...p, quantity: toNumber(p.quantity), averagePrice: toNumber(p.averagePrice), currentPrice: toNumber(p.currentPrice), firstPurchaseAt: toNumber(p.firstPurchaseAt, 0) });
  const txByTicker = new Map();
  for (const tx of transactions) {
    if (!txByTicker.has(tx.ticker)) txByTicker.set(tx.ticker, []);
    txByTicker.get(tx.ticker).push(tx);
  }
  for (const [ticker, txs] of txByTicker.entries()) {
    let quantity = 0;
    let cost = 0;
    let buyGross = 0;
    let buyQty = 0;
    let firstPurchaseAt = 0;
    for (const tx of txs.sort((a, b) => a.timestamp - b.timestamp)) {
      if (tx.side === 'SELL') {
        if (quantity > 0) {
          const soldQty = Math.min(quantity, tx.quantity);
          const avg = quantity > 0 ? cost / quantity : 0;
          quantity = Number((quantity - soldQty).toFixed(8));
          cost = Number(Math.max(0, cost - avg * soldQty).toFixed(8));
        }
      } else {
        firstPurchaseAt = firstPurchaseAt || tx.timestamp;
        quantity = Number((quantity + tx.quantity).toFixed(8));
        cost = Number((cost + (tx.grossValue || tx.quantity * tx.price)).toFixed(8));
        buyQty += tx.quantity;
        buyGross += tx.grossValue || tx.quantity * tx.price;
      }
    }
    const existing = byTicker.get(ticker);
    const averagePrice = existing?.averagePrice || (quantity > 0 && cost > 0 ? cost / quantity : (buyQty > 0 ? buyGross / buyQty : 0));
    byTicker.set(ticker, {
      ticker,
      quantity: existing?.quantity ?? Math.max(0, quantity),
      averagePrice,
      currentPrice: existing?.currentPrice || 0,
      firstPurchaseAt: existing?.firstPurchaseAt || firstPurchaseAt || 0,
      assetClass: existing?.assetClass || txs.find(t => t.assetClass)?.assetClass,
      name: existing?.name || ticker,
    });
  }
  return [...byTicker.values()].filter(p => p.ticker && (p.quantity > 0 || txByTicker.has(p.ticker)));
}

function historyCurrentPrice(history = {}, fallback = 0) {
  const lastPoint = Array.isArray(history?.points) ? history.points.filter(p => toNumber(p?.close, 0) > 0).at(-1) : null;
  const price = toNumber(history?.regularMarketPrice, 0) || toNumber(lastPoint?.close, 0) || toNumber(fallback, 0);
  return Number.isFinite(price) && price > 0 ? price : 0;
}

function enrichPositionsWithHistoryPrices(positions = [], histories = []) {
  return positions.map((position, index) => {
    const currentPrice = toNumber(position.currentPrice, 0);
    const remotePrice = historyCurrentPrice(histories[index], currentPrice);
    return {
      ...position,
      currentPrice: currentPrice > 0 ? currentPrice : remotePrice,
      currentPriceSource: currentPrice > 0 ? (position.currentPriceSource || 'payload') : (remotePrice > 0 ? 'YahooChartHistory' : position.currentPriceSource)
    };
  });
}

function currentAnchorPositions(activePositions = [], historyPositions = []) {
  const map = new Map();
  const enrichedByTicker = new Map(historyPositions.map(p => [p.ticker, p]));
  for (const p of activePositions) {
    if (!p?.ticker || toNumber(p.quantity) <= 0) continue;
    const enriched = enrichedByTicker.get(p.ticker) || {};
    map.set(p.ticker, {
      ...enriched,
      ...p,
      currentPrice: toNumber(p.currentPrice, 0) || toNumber(enriched.currentPrice, 0),
      currentPriceSource: toNumber(p.currentPrice, 0) > 0 ? (p.currentPriceSource || 'payload') : enriched.currentPriceSource
    });
  }
  for (const p of historyPositions) {
    if (!p?.ticker || toNumber(p.quantity) <= 0 || map.has(p.ticker)) continue;
    map.set(p.ticker, { ...p, currentAnchorFromHistory: true });
  }
  return [...map.values()].filter(p => p.ticker && toNumber(p.quantity) > 0);
}

function transactionOnlyTickers(activePositions = [], historyPositions = []) {
  const active = new Set(activePositions.map(p => p.ticker).filter(Boolean));
  return historyPositions.map(p => p.ticker).filter(ticker => ticker && !active.has(ticker));
}

function stateAtTimestamp(position = {}, transactions = [], timestamp = 0) {
  if (!transactions.length) {
    const first = Number(position.firstPurchaseAt || 0);
    const firstSeconds = first > 9_999_999_999 ? Math.floor(first / 1000) : Math.floor(first || 0);
    if (firstSeconds > 0 && timestamp < firstSeconds) return { quantity: 0, cost: 0 };
    const quantity = toNumber(position.quantity);
    return { quantity, cost: Number((toNumber(position.averagePrice) * quantity).toFixed(2)) };
  }
  let quantity = 0;
  let cost = 0;
  for (const tx of transactions) {
    if (tx.timestamp > timestamp) break;
    if (tx.side === 'SELL') {
      if (quantity > 0) {
        const soldQty = Math.min(quantity, tx.quantity);
        const avg = quantity > 0 ? cost / quantity : 0;
        quantity = Number((quantity - soldQty).toFixed(8));
        cost = Number(Math.max(0, cost - avg * soldQty).toFixed(8));
      }
    } else {
      quantity = Number((quantity + tx.quantity).toFixed(8));
      cost = Number((cost + (tx.grossValue || tx.quantity * tx.price)).toFixed(8));
    }
  }
  return { quantity: quantity > 0.000001 ? quantity : 0, cost: cost > 0.000001 ? cost : 0 };
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

// seedPortfolioHistorySeriesFromHistories: cria série real baseada nas cotações remotas antes do fallback sintético.
// enrichPositionsWithRemoteCurrentPrices: mantém currentPrice enriquecido por histórico/quote remotos quando disponíveis.
function buildMergedPortfolioSeries(histories = [], normalized = [], { range = '1Y', interval, transactions = [] } = {}) {
  const intraday = isIntradayPortfolioHistory(range, interval);
  const transactionsByTicker = new Map();
  for (const tx of transactions) {
    if (!transactionsByTicker.has(tx.ticker)) transactionsByTicker.set(tx.ticker, []);
    transactionsByTicker.get(tx.ticker).push(tx);
  }
  for (const txs of transactionsByTicker.values()) txs.sort((a, b) => a.timestamp - b.timestamp);
  const perPosition = histories.map((history, index) => ({
    position: normalized[index],
    transactions: transactionsByTicker.get(normalized[index]?.ticker) || [],
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
    let expectedIncluded = 0;
    const states = perPosition.map(entry => stateAtTimestamp(entry.position, entry.transactions, timestamp));
    states.forEach(state => {
      if (toNumber(state.quantity) > 0) expectedIncluded += 1;
    });
    perPosition.forEach((entry, idx) => {
      const points = entry.points;
      while (indices[idx] + 1 < points.length && points[indices[idx] + 1].timestamp <= timestamp) indices[idx] += 1;
      const point = points[indices[idx]];
      const state = states[idx];
      const quantity = toNumber(state.quantity);
      if (!(quantity > 0)) return;
      if (!point || point.timestamp > timestamp) return;
      const price = toNumber(point.close);
      if (!(price > 0)) return;
      const value = Number((price * quantity).toFixed(2));
      const invested = Number((state.cost || toNumber(entry.position.averagePrice) * quantity).toFixed(2));
      totalValue = Number((totalValue + value).toFixed(2));
      investedValue = Number((investedValue + invested).toFixed(2));
      positions[entry.position.ticker] = value;
      investedByTicker[entry.position.ticker] = invested;
      included += 1;
    });
    if (expectedIncluded > 0 && included < expectedIncluded) continue;
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
  const rangeKey = String(range || '').toLowerCase();
  const start = rangeKey === 'max' || rangeKey === 'MAX'.toLowerCase()
    ? (firstPurchaseSeconds || Math.max(0, now - rangeSeconds(range)))
    : Math.min(Math.max(0, now - rangeSeconds(range)), Math.max(0, now - 60));
  const effectiveStart = rangeKey === 'max' ? (firstPurchaseSeconds || start) : Math.max(start, firstPurchaseSeconds || 0);
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


function alignIntradaySeriesToCurrentPortfolioValue(series = [], normalized = [], { range = '1Y', interval } = {}) {
  if (!isIntradayPortfolioHistory(range, interval) || !Array.isArray(series) || series.length < 2) return series;
  const currentValue = Number(normalized.reduce((sum, p) => sum + positionCurrentValue(p), 0).toFixed(2));
  if (!Number.isFinite(currentValue) || currentValue <= 0) return series;
  const last = series[series.length - 1];
  const lastValue = toNumber(last?.totalValue, 0);
  if (!(lastValue > 0)) return series;
  const gap = Math.abs(currentValue - lastValue) / Math.max(currentValue, lastValue);
  const rangeKey = String(range || '').toLowerCase();
  const tolerance = rangeKey === '1d' ? 0.003 : 0.01;
  if (gap <= tolerance) return series;
  const ratio = currentValue / lastValue;
  if (!Number.isFinite(ratio) || ratio <= 0 || ratio < 0.5 || ratio > 2.0) return series;
  return series.map(row => {
    const totalValue = Number((toNumber(row.totalValue, 0) * ratio).toFixed(2));
    const investedValue = Number(toNumber(row.investedValue ?? row.costBasis, 0).toFixed(2));
    const positions = Object.fromEntries(Object.entries(row.positions || {}).map(([ticker, value]) => [ticker, Number((toNumber(value, 0) * ratio).toFixed(2))]));
    const pnl = Number((totalValue - investedValue).toFixed(2));
    const returnPercent = investedValue ? Number(((pnl / investedValue) * 100).toFixed(2)) : undefined;
    return {
      ...row,
      totalValue,
      positions,
      unrealizedPnL: pnl,
      unrealizedPnLPct: returnPercent,
      unrealizedPnLPercent: returnPercent,
      returnPercent,
      returnPct: returnPercent,
      liveAligned: true,
      liveAlignmentRatio: Number(ratio.toFixed(8))
    };
  });
}

function stabilizeIntradayEdgePoints(series = [], { range = '1Y', interval } = {}) {
  if (!isIntradayPortfolioHistory(range, interval) || !Array.isArray(series) || series.length < 4) return series;
  let clean = series.filter(row => row && toNumber(row.totalValue, 0) > 0).sort((a, b) => Number(a.timestamp || pointTimestampSeconds(a) || 0) - Number(b.timestamp || pointTimestampSeconds(b) || 0));
  if (clean.length < 4) return clean;

  const values = clean.map(row => toNumber(row.totalValue, 0)).filter(value => value > 0).sort((a, b) => a - b);
  const median = values[Math.floor(values.length / 2)] || 0;
  if (!(median > 0)) return clean;

  const adjacentGaps = clean.slice(0, -1).map((row, index) => {
    const leftValue = toNumber(row?.totalValue, 0);
    const rightValue = toNumber(clean[index + 1]?.totalValue, 0);
    return leftValue > 0 && rightValue > 0 ? Math.abs(rightValue - leftValue) / Math.max(leftValue, rightValue) : 0;
  }).filter(Number.isFinite).sort((a, b) => a - b);
  const typicalGap = adjacentGaps[Math.floor(adjacentGaps.length / 2)] || 0;
  const adaptiveEdgeLimit = Math.min(0.18, Math.max(0.035, typicalGap * 7));

  const edgeIsolated = (edge, neighbor, nextNeighbor) => {
    const edgeValue = toNumber(edge?.totalValue, 0);
    const neighborValue = toNumber(neighbor?.totalValue, 0);
    const nextValue = toNumber(nextNeighbor?.totalValue, 0);
    if (!(edgeValue > 0 && neighborValue > 0)) return false;
    const edgeGap = Math.abs(edgeValue - neighborValue) / Math.max(edgeValue, neighborValue);
    const neighborGap = nextValue > 0 ? Math.abs(neighborValue - nextValue) / Math.max(neighborValue, nextValue) : 0;
    const medianGap = Math.abs(edgeValue - median) / Math.max(edgeValue, median);
    return edgeGap > adaptiveEdgeLimit && medianGap > adaptiveEdgeLimit && neighborGap < Math.max(0.12, adaptiveEdgeLimit * 2);
  };

  if (edgeIsolated(clean[0], clean[1], clean[2])) clean = clean.slice(1);
  if (clean.length >= 4 && edgeIsolated(clean[clean.length - 1], clean[clean.length - 2], clean[clean.length - 3])) clean = clean.slice(0, -1);
  return clean;
}

function appendCurrentPortfolioPoint(series = [], normalized = [], { range = '1Y', interval } = {}) {
  const currentValue = Number(normalized.reduce((sum, p) => sum + positionCurrentValue(p), 0).toFixed(2));
  if (!Number.isFinite(currentValue) || currentValue <= 0) return series;
  const investedValue = Number(normalized.reduce((sum, p) => sum + positionInvestedValue(p), 0).toFixed(2));
  const currentPositions = {};
  const currentInvestedByTicker = {};
  for (const p of normalized) {
    const value = positionCurrentValue(p);
    const invested = positionInvestedValue(p);
    if (p?.ticker && value > 0) currentPositions[p.ticker] = value;
    if (p?.ticker && invested > 0) currentInvestedByTicker[p.ticker] = invested;
  }
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
    positions: currentPositions,
    investedByTicker: currentInvestedByTicker,
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
  const explicitPositions = normalizePortfolioPositions({ positions });
  const optionPositions = explicitPositions.length ? [] : normalizePortfolioPositions(options);
  const activePositions = explicitPositions.length ? explicitPositions : optionPositions;
  const transactions = normalizePortfolioTransactions({ transactions: options.transactions || [] });
  const normalizedBase = mergeHistoryPositions(activePositions, transactions);
  const range = options.range || '1Y';
  const interval = options.interval;
  const timeoutMs = Number(options.timeoutMs || 9000);
  const maxConcurrency = Math.max(1, Math.min(Number(options.maxConcurrency || 4), 8, normalizedBase.length || 1));
  const started = performance.now();
  const histories = new Array(normalizedBase.length);
  const errors = [];
  let cursor = 0;
  async function worker() {
    while (cursor < normalizedBase.length) {
      const i = cursor++;
      const p = normalizedBase[i];
      const h = await fetchYahooHistory(p.ticker, { range, interval, timeoutMs, limit: options.limit });
      if (!h.ok) errors.push({ ticker: p.ticker, error: h.error });
      histories[i] = h;
    }
  }
  await Promise.all(Array.from({ length: maxConcurrency }, () => worker()));

  const normalized = enrichPositionsWithHistoryPrices(normalizedBase, histories);
  const currentPositions = currentAnchorPositions(activePositions, normalized);
  const investedValue = Number(currentPositions.reduce((sum, p) => sum + p.quantity * p.averagePrice, 0).toFixed(2));
  let series = buildMergedPortfolioSeries(histories, normalized, { range, interval, transactions });
  series = alignIntradaySeriesToCurrentPortfolioValue(series, currentPositions, { range, interval });
  const remotePointCount = series.length;
  series = appendCurrentPortfolioPoint(series, currentPositions, { range, interval });
  series = stabilizeIntradayEdgePoints(series, { range, interval });
  if (series.length < 2) series = fallbackPortfolioHistorySeries(currentPositions.length ? currentPositions : normalized, range);
  return {
    ok: series.length > 0,
    version: PORTFOLIO_HISTORY_VERSION,
    source: remotePointCount > 0 ? 'YahooChart+CurrentPrice' : 'CurrentPriceFallback',
    routeEngine: 'VALORAE_PORTFOLIO_HISTORY_REBUILD_V292',
    engine: 'portfolio-history-rebuild-v292',
    range,
    interval: interval || undefined,
    positions: normalized,
    count: currentPositions.length,
    activeTickers: currentPositions.map(p => p.ticker),
    historyTickers: normalized.map(p => p.ticker),
    transactionOnlyTickers: transactionOnlyTickers(activePositions, normalized),
    transactionCount: transactions.length,
    ignoredTransactionCount: 0,
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
