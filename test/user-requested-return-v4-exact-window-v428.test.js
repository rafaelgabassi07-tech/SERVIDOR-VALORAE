import assert from 'node:assert/strict';
import {
  buildExactPortfolioReturnSeriesV4,
  selectPortfolioReturnWindowV4,
  summarizePortfolioReturnV4
} from '../lib/portfolio/return-engine-v4.js';

const points = [
  { month: '2026-01', marketValue: 1000, valuationCoveragePercent: 100, monthlyContributions: 1000, weightedNetCashFlow: 500 },
  { month: '2026-02', marketValue: 1100, valuationCoveragePercent: 100, monthlyContributions: 0, weightedNetCashFlow: 0 },
  { month: '2026-03', marketValue: 1210, valuationCoveragePercent: 100, monthlyContributions: 0, weightedNetCashFlow: 0 },
  { month: '2026-04', marketValue: 1331, valuationCoveragePercent: 100, monthlyContributions: 0, weightedNetCashFlow: 0, currentMonthPartial: true }
];
const built = buildExactPortfolioReturnSeriesV4(points);
assert.equal(built.diagnostics.engine, 'VALORAE_RETURN_V4_EXACT_WINDOW');
assert.ok(built.rows.length >= 3);

// V4 must rebuild the selected curve from monthly returns, not trust inherited cumulative values.
const altered = built.rows.map((row, index) => ({ ...row, portfolioReturnPercent: 900 + index }));
const selected = selectPortfolioReturnWindowV4(altered, '3M', 3, new Date('2026-04-20T12:00:00Z'));
assert.ok(selected.rows.length >= 2);
assert.ok(selected.rows.every(row => row.portfolioReturnPercent < 100), 'window must be compounded from monthly returns instead of inherited cumulative values');

// A calendar gap must never be drawn as a continuous comparison line.
const gapped = [
  { ...built.rows[0], month: '2026-01', returnChainId: 0, monthlyReturnPercent: 2 },
  { ...built.rows[1], month: '2026-02', returnChainId: 0, monthlyReturnPercent: 3 },
  { ...built.rows.at(-1), month: '2026-04', returnChainId: 0, monthlyReturnPercent: 4 }
];
const gapWindow = selectPortfolioReturnWindowV4(gapped, 'SINCE_START', 12, new Date('2026-04-20T12:00:00Z'));
assert.deepEqual(gapWindow.rows.map(row => row.month), ['2026-04']);

const summary = summarizePortfolioReturnV4([
  { month: '2026-01', monthlyReturnPercent: 2, portfolioReturnPercent: 2, currentMonthPartial: false },
  { month: '2026-02', monthlyReturnPercent: -1, portfolioReturnPercent: 0.98, currentMonthPartial: false },
  { month: '2026-03', monthlyReturnPercent: 50, portfolioReturnPercent: 51.47, currentMonthPartial: true }
]);
assert.equal(summary.bestMonth.month, '2026-01', 'current-month preview must not become best closed month');
assert.equal(summary.worstMonth.month, '2026-02', 'current-month preview must not become worst closed month');

console.log('ok - Return v4 exact window');
