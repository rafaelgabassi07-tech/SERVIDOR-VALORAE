import assert from 'node:assert/strict';
import {
  accumulatedReturnForMonths,
  benchmarkAccumulatedMonthMap,
  buildDisplayPortfolioRows,
  selectPortfolioRowsForRange,
  compoundMonthlyReturns,
  summarizeReturnSeries
} from '../lib/portfolio/return-metrics.js';

const months = Array.from({ length: 13 }, (_, index) => `2025-${String(index + 1).padStart(2, '0')}`)
  .map((month, index) => ({
    month,
    label: month,
    monthlyReturnPercent: 1,
    portfolioReturnPercent: compoundMonthlyReturns(Array(index + 1).fill(1))
  }));

const visible = buildDisplayPortfolioRows(months, 12);
assert.equal(visible.length, 12, '12M view must expose twelve monthly intervals');
assert.ok(Math.abs(visible[0].portfolioReturnPercent - 1) < 0.0001,
  'first visible month must contain its return instead of being forced to zero');
const summary = summarizeReturnSeries(visible);
assert.ok(Math.abs(summary.totalReturnPercent - 12.68) < 0.01, 'total must compound all 12 months');
assert.ok(Math.abs(summary.last12MonthsReturnPercent - 12.68) < 0.01, 'last 12 months must include 12 intervals');
assert.equal(summary.lastMonthReturnPercent, 1);
assert.equal(summary.averageMonthlyReturnPercent, 1);
assert.equal(summary.volatilityMonthlyPercent, 0);

assert.equal(compoundMonthlyReturns([-100, 10]), -100,
  'a total-loss month must remain -100% instead of being silently discarded');

const benchmark = months.map(point => ({ month: point.month, accumulatedPercent: point.portfolioReturnPercent, monthlyPercent: 1 }));
const map = benchmarkAccumulatedMonthMap(benchmark, 'accumulatedPercent', months[1].month);
assert.ok(Math.abs(map.get(months[1].month) - 1) < 0.0001,
  'benchmark first visible month must be rebased against the previous close');
assert.ok(Math.abs(accumulatedReturnForMonths(benchmark, 12) - 12.68) < 0.01,
  'benchmark trailing return must compound twelve monthly observations');

assert.equal(accumulatedReturnForMonths([], 12), null,
  'missing benchmark data must remain distinguishable from a legitimate zero return');
const flatBenchmark = [
  { month: '2026-01', monthlyPercent: 0, accumulatedPercent: 0 },
  { month: '2026-02', monthlyPercent: 0, accumulatedPercent: 0 }
];
assert.equal(accumulatedReturnForMonths(flatBenchmark, 12), 0,
  'a legitimate zero benchmark return must not be treated as missing');


const missingBenchmark = benchmarkAccumulatedMonthMap([{ month: '2026-01', accumulatedPercent: null }], 'accumulatedPercent', '2026-01');
assert.equal(missingBenchmark.size, 0, 'null benchmark values must not become artificial zero series');

const ytdSource = [
  { month: '2025-12', monthlyReturnPercent: 5, portfolioReturnPercent: 5 },
  { month: '2026-01', monthlyReturnPercent: 10, portfolioReturnPercent: 15.5 },
  { month: '2026-02', monthlyReturnPercent: -5, portfolioReturnPercent: 9.725 }
];
const ytd = selectPortfolioRowsForRange(ytdSource, 'YTD', 8, new Date('2026-08-14T12:00:00Z'));
assert.deepEqual(ytd.rows.map(point => point.month), ['2026-01', '2026-02'],
  'YTD must never leak closing rows from the previous year');
assert.ok(Math.abs(ytd.rows.at(-1).portfolioReturnPercent - 4.5) < 0.0001,
  'YTD portfolio return must be recomputed from current-year monthly intervals');
const staleYtd = selectPortfolioRowsForRange(
  [{ month: '2025-11', monthlyReturnPercent: 1 }, { month: '2025-12', monthlyReturnPercent: 2 }],
  'ANO_ATUAL',
  8,
  new Date('2026-08-14T12:00:00Z')
);
assert.equal(staleYtd.rows.length, 0, 'stale previous-year history must produce an empty YTD window');

console.log('portfolio return metrics v403: ok');
