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


function reconciliationMillis(value) {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number' || /^\d+$/.test(String(value))) {
    const number = Number(value);
    if (!Number.isFinite(number) || number <= 0) return 0;
    return number > 10_000_000_000 ? number : number * 1000;
  }
  const parsed = new Date(String(value)).getTime();
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

/**
 * Reconciles an incomplete transaction ledger against the current open position.
 *
 * B3/cloud histories can legitimately start in the middle of a position lifetime. When
 * the signed quantity represented by the known ledger is smaller than the current
 * quantity, the missing difference is opening inventory rather than market performance.
 * We materialize that difference only inside the Return calculation as an accounting
 * BUY at the position's explicit first-purchase date (or, conservatively, at the first
 * known transaction when chronology is unavailable). No quote is fabricated: market
 * valuation still comes exclusively from real history/current prices.
 */
export function reconcileReturnOpeningTransactions(positions = [], transactions = []) {
  const sourceTransactions = Array.isArray(transactions) ? transactions : [];
  const byTicker = new Map();
  for (const transaction of sourceTransactions) {
    const ticker = String(transaction?.ticker || '').trim().toUpperCase();
    if (!ticker) continue;
    if (!byTicker.has(ticker)) byTicker.set(ticker, []);
    byTicker.get(ticker).push(transaction);
  }

  const reconciliations = [];
  for (const position of (Array.isArray(positions) ? positions : [])) {
    const ticker = String(position?.ticker || position?.symbol || '').trim().toUpperCase();
    const currentQuantity = Number(position?.quantity ?? position?.qty ?? 0);
    if (!ticker || !Number.isFinite(currentQuantity) || currentQuantity <= 0) continue;
    const rows = (byTicker.get(ticker) || []).slice().sort((a, b) => Number(a?.millis || 0) - Number(b?.millis || 0));
    if (!rows.length) continue;
    const knownNetQuantity = rows.reduce((sum, transaction) => {
      const quantity = Number(transaction?.quantity || 0);
      return Number.isFinite(quantity) ? sum + quantity : sum;
    }, 0);
    const openingQuantity = currentQuantity - knownNetQuantity;
    if (!Number.isFinite(openingQuantity) || openingQuantity <= 0.000001) continue;

    const averagePrice = Number(position?.avgPrice ?? position?.averagePrice ?? 0);
    if (!Number.isFinite(averagePrice) || averagePrice <= 0) continue;
    const firstKnownMillis = rows.map(row => Number(row?.millis || 0)).filter(value => Number.isFinite(value) && value > 0).sort((a, b) => a - b)[0] || 0;
    const explicitStartMillis = reconciliationMillis(position?.firstPurchaseDate || position?.firstPurchaseAt || position?.purchaseDate || 0);
    const openingMillis = explicitStartMillis > 0 && (!firstKnownMillis || explicitStartMillis < firstKnownMillis)
      ? explicitStartMillis
      : firstKnownMillis;
    if (!openingMillis) continue;

    reconciliations.push({
      ticker,
      quantity: openingQuantity,
      price: averagePrice,
      date: new Date(openingMillis).toISOString().slice(0, 10),
      millis: openingMillis,
      isSell: false,
      openingReconciliation: true,
      reconciliationReason: 'CURRENT_POSITION_EXCEEDS_KNOWN_LEDGER'
    });
  }

  const combined = [...sourceTransactions, ...reconciliations]
    .sort((a, b) => Number(a?.millis || 0) - Number(b?.millis || 0));
  return {
    transactions: combined,
    reconciliations,
    tickers: [...new Set(reconciliations.map(item => item.ticker))].sort()
  };
}
