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
  const fallback = Number(fallbackReturnPercent || 0);
  if (!Number.isFinite(beginning) || beginning <= 0) return Number.isFinite(fallback) ? fallback : 0;

  const netCashFlow = contributed - withdrawn;
  const numerator = ending + distributed - beginning - netCashFlow;
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
    : (Number.isFinite(fallback) ? fallback : 0);
}
