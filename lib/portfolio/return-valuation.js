import { normalizeTicker } from '../core/tickers.js';
import { normalizeReturnLedgerTransactions, returnLedgerBucketsAtBoundary } from './return-ledger-engine.js';

export function monthCloseAtOrBefore(points = [], monthStart, boundary) {
  let selected = null;
  for (const point of (Array.isArray(points) ? points : [])) {
    const millis = Number(point?.millis || 0);
    if (millis < monthStart) continue;
    if (millis > boundary) break;
    selected = point;
  }
  const close = Number(selected?.close || 0);
  return Number.isFinite(close) && close > 0 ? close : 0;
}

export function lastRealCloseAtOrBefore(points = [], boundary) {
  let selected = null;
  for (const point of (Array.isArray(points) ? points : [])) {
    const millis = Number(point?.millis || 0);
    if (!Number.isFinite(millis) || millis <= 0) continue;
    if (millis > boundary) break;
    const close = Number(point?.close || 0);
    if (Number.isFinite(close) && close > 0) selected = point;
  }
  const close = Number(selected?.close || 0);
  return Number.isFinite(close) && close > 0 ? close : 0;
}

export function resolveHistoricalPortfolioValuation(points = [], monthStart, boundary, bucket = {}, allowCostBasisCarry = false) {
  const marketClose = monthCloseAtOrBefore(points, monthStart, boundary);
  if (Number.isFinite(marketClose) && marketClose > 0) {
    return { close: marketClose, mode: 'MARKET_CLOSE', partial: false };
  }

  if (allowCostBasisCarry) {
    // The older stable Return implementation carried the last real quote through a
    // provider hole instead of deleting the whole month. Keep that behavior, but mark
    // the point partial so the UI/diagnostics never present a stale quote as complete.
    const lastRealClose = lastRealCloseAtOrBefore(points, boundary);
    if (Number.isFinite(lastRealClose) && lastRealClose > 0) {
      return { close: lastRealClose, mode: 'LAST_REAL_CLOSE_CARRY', partial: true };
    }
  }

  const quantity = Number(bucket.quantity || 0);
  const costBasis = Number(bucket.costBasis || 0);
  const accountingClose = quantity > 0 && costBasis > 0 ? costBasis / quantity : 0;
  if (allowCostBasisCarry && Number.isFinite(accountingClose) && accountingClose > 0) {
    return { close: accountingClose, mode: 'COST_BASIS_CARRY', partial: true };
  }
  return { close: 0, mode: 'MISSING', partial: false };
}


/**
 * Audits the current open inventory against the transaction ledger without rewriting history.
 *
 * Older builds used the *current* position quantity to synthesize a BUY at the first known
 * transaction whenever the terminal ledger did not match. That can move a later purchase
 * backwards in time and bridge a real zero-capital interval. Return must fail closed instead:
 * current positions are an audit target, never evidence that historical exposure existed.
 */
export function reconcileReturnOpeningTransactions(positions = [], transactions = []) {
  const sourceTransactions = Array.isArray(transactions) ? transactions : [];
  const normalizedTransactions = normalizeReturnLedgerTransactions(sourceTransactions);
  const terminalBoundary = normalizedTransactions.reduce(
    (latest, transaction) => Math.max(latest, Number(transaction?.millis || 0)),
    0
  );
  const terminalBuckets = returnLedgerBucketsAtBoundary(normalizedTransactions, terminalBoundary);
  const currentByTicker = new Map();

  for (const position of (Array.isArray(positions) ? positions : [])) {
    const ticker = normalizeTicker(position?.ticker || position?.symbol || '');
    const quantity = Number(position?.quantity ?? position?.qty ?? 0);
    if (!ticker || !Number.isFinite(quantity) || quantity <= 0.00000001) continue;
    currentByTicker.set(ticker, Math.max(0, quantity));
  }

  const tickers = new Set([
    ...terminalBuckets.keys(),
    ...currentByTicker.keys()
  ]);
  const inventoryMismatches = [...tickers].map(ticker => {
    const ledgerQuantity = Math.max(0, Number(terminalBuckets.get(ticker)?.quantity || 0));
    const currentQuantity = Math.max(0, Number(currentByTicker.get(ticker) || 0));
    const delta = currentQuantity - ledgerQuantity;
    if (Math.abs(delta) <= 0.000001) return null;
    return {
      ticker,
      ledgerQuantity,
      currentQuantity,
      delta
    };
  }).filter(Boolean).sort((a, b) => a.ticker.localeCompare(b.ticker));

  return {
    transactions: sourceTransactions,
    reconciliations: [],
    tickers: [],
    inventoryMismatches,
    inventoryMismatchTickers: inventoryMismatches.map(item => item.ticker),
    historicalBackfillDisabled: true
  };
}
