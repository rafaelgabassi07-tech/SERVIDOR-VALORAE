import assert from 'node:assert/strict';
import { buildExposureOnlyReturnSeriesV5, selectExposureReturnWindowV5, summarizeExposureReturnV5 } from '../lib/portfolio/return-engine-v5.js';

const points = [
  { month: '2026-01', marketValue: 1000, valuationCoveragePercent: 100, monthlyContributions: 1000, weightedNetCashFlow: 500 },
  { month: '2026-02', marketValue: 1100, valuationCoveragePercent: 100 },
  { month: '2026-03', marketValue: 1210, valuationCoveragePercent: 100 },
  { month: '2026-04', marketValue: 1331, valuationCoveragePercent: 100, currentMonthPartial: true }
];
const built = buildExposureOnlyReturnSeriesV5(points);
assert.equal(built.diagnostics.engine, 'VALORAE_RETURN_V5_EXPOSURE_ONLY');
assert.equal(built.rows.length, 4);
const altered = built.rows.map((row, index) => ({ ...row, portfolioReturnPercent: 900 + index }));
const selected = selectExposureReturnWindowV5(altered, '3M', 3, new Date('2026-04-20T12:00:00Z'));
assert.ok(selected.rows.every(row => row.portfolioReturnPercent < 100));
const summary = summarizeExposureReturnV5([
  { month: '2026-01', monthlyReturnPercent: 2, portfolioReturnPercent: 2 },
  { month: '2026-02', monthlyReturnPercent: -1, portfolioReturnPercent: 0.98 },
  { month: '2026-03', monthlyReturnPercent: 50, portfolioReturnPercent: 51.47, currentMonthPartial: true }
]);
assert.equal(summary.bestMonth.month, '2026-01');
assert.equal(summary.worstMonth.month, '2026-02');
console.log('ok - Return v5 exposure-only');
