import { round } from '../core/numbers.js';

/**
 * Cash-flow-aware monthly portfolio return.
 *
 * Modified Dietz weights external cash flows by the fraction of the period in which
 * capital was exposed. This prevents a large contribution from being mistaken for
 * investment performance in the portfolio-vs-index comparison.
 */
export function modifiedDietzMonthlyReturnPercent({
  beginningMarketValue = 0,
  endingMarketValue = 0,
  contributions = 0,
  withdrawals = 0,
  weightedNetCashFlow = 0,
  dividends = 0,
  fallbackReturnPercent = 0
} = {}) {
  const beginning = Number(beginningMarketValue || 0);
  const ending = Number(endingMarketValue || 0);
  const contributed = Math.max(0, Number(contributions || 0));
  const withdrawn = Math.max(0, Number(withdrawals || 0));
  const distributed = Math.max(0, Number(dividends || 0));
  const weightedFlow = Number(weightedNetCashFlow || 0);
  const fallbackRaw = Number(fallbackReturnPercent);
  const fallback = Number.isFinite(fallbackRaw) ? fallbackRaw : Number.NaN;
  if (!Number.isFinite(beginning) || !Number.isFinite(ending)) return fallback;

  const netCashFlow = contributed - withdrawn;
  const numerator = ending + distributed - beginning - netCashFlow;

  // A portfolio can legitimately restart after being fully liquidated. In that month
  // beginning market value is zero, but a new contribution provides an exposure base.
  // Falling back to return-on-cost ignored the timing of the new cash and could create
  // a large discontinuity in the portfolio-vs-index chart.
  if (beginning <= 0) {
    if (contributed <= 0) return fallback;
    const weightedContributionBase = Math.abs(weightedFlow) > 0.01
      ? Math.abs(weightedFlow)
      : contributed * 0.5;
    return weightedContributionBase > 0
      ? (numerator / weightedContributionBase) * 100
      : fallback;
  }

  const denominator = beginning + weightedFlow;
  if (Number.isFinite(denominator) && Math.abs(denominator) > 0.01) {
    return (numerator / denominator) * 100;
  }
  if (contributed <= 0) {
    // Full/near-full withdrawals can collapse average capital to ~zero. Preserve the
    // realized result rather than dividing by a vanishing exposure base.
    return ((ending + withdrawn + distributed) / beginning - 1) * 100;
  }
  const conservativeCapital = beginning + contributed * 0.5;
  return conservativeCapital > 0
    ? (numerator / conservativeCapital) * 100
    : fallback;
}


/**
 * Cash-flow totals and Modified Dietz weights for the interval in which the
 * portfolio actually had capital at risk. This is intentionally independent
 * from provider/history code so liquidation and re-entry math can be tested
 * without network dependencies.
 */
export function monthHasCapitalExposure({
  beginningPositionCount = 0,
  endingPositionCount = 0,
  contributions = 0,
  withdrawals = 0
} = {}) {
  // A withdrawal by itself is not evidence of exposure: imported histories can begin with
  // an orphan SELL whose purchase is outside the available ledger. Beginning inventory,
  // ending inventory or a real contribution can establish exposure; a matched liquidation
  // is already covered by beginningPositionCount > 0.
  return Number(beginningPositionCount || 0) > 0 ||
    Number(endingPositionCount || 0) > 0 ||
    Number(contributions || 0) > 0;
}

export function weightedPortfolioCashFlows(
  transactions = [],
  periodStart = 0,
  periodEnd = 0,
  { beginningHasCapital = false, endingHasCapital = false } = {}
) {
  const start = Number(periodStart || 0);
  const end = Number(periodEnd || 0);
  const monthTransactions = (Array.isArray(transactions) ? transactions : [])
    .filter(tx => Number(tx?.millis || 0) >= start && Number(tx?.millis || 0) <= end)
    .sort((a, b) => Number(a.millis || 0) - Number(b.millis || 0));
  const firstContribution = monthTransactions.find(tx => Number(tx?.quantity || 0) > 0)?.millis;
  const lastTransaction = monthTransactions.at(-1)?.millis;
  const exposureStart = beginningHasCapital ? start : Number(firstContribution || start);
  const exposureEnd = endingHasCapital ? end : Number(lastTransaction || end);
  const safeStart = Math.max(start, Math.min(end, exposureStart));
  const safeEnd = Math.max(safeStart, Math.min(end, exposureEnd));
  const duration = Math.max(1, safeEnd - safeStart);
  let contributions = 0;
  let withdrawals = 0;
  let weightedNetCashFlow = 0;

  for (const tx of monthTransactions) {
    const quantity = Number(tx?.quantity || 0);
    const price = Number(tx?.price || 0);
    const amount = Math.abs(quantity) * price;
    if (!Number.isFinite(amount) || amount <= 0) continue;
    const isContribution = quantity >= 0;
    if (isContribution) contributions += amount;
    else withdrawals += amount;
    const clampedMillis = Math.max(safeStart, Math.min(safeEnd, Number(tx.millis || 0)));
    const remainingWeight = Math.max(0, Math.min(1, (safeEnd - clampedMillis) / duration));
    weightedNetCashFlow += (isContribution ? amount : -amount) * remainingWeight;
  }

  return {
    contributions: round(contributions, 2),
    withdrawals: round(withdrawals, 2),
    netFlow: round(contributions - withdrawals, 2),
    weightedNetCashFlow: round(weightedNetCashFlow, 2),
    exposureStart: safeStart,
    exposureEnd: safeEnd
  };
}
