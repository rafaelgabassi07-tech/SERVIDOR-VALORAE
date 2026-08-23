import test from 'node:test';
import assert from 'node:assert/strict';
import { buildExposureOnlyReturnSeriesV5, selectExposureReturnWindowV5, summarizeExposureReturnV5 } from '../lib/portfolio/return-engine-v5.js';

const complete = (month, marketValue, extra = {}) => ({ month, marketValue, valuationCoveragePercent: 100, partialValuation: false, ...extra });

test('liquidação total, inatividade e reentrada preservam trajetória sem criar meses de retorno', () => {
  const result = buildExposureOnlyReturnSeriesV5([
    complete('2026-01', 1100, { monthlyContributions: 1000, weightedNetCashFlow: 1000, components: [{ ticker: 'OLD3' }] }),
    complete('2026-02', 0, { capitalExposed: true, monthlyWithdrawals: 1150, weightedNetCashFlow: -50, components: [] }),
    complete('2026-03', 0, { capitalExposed: false, components: [] }),
    complete('2026-04', 1020, { monthlyContributions: 1000, weightedNetCashFlow: 1000, components: [{ ticker: 'NEW3' }] }),
    complete('2026-05', 1071, { components: [{ ticker: 'NEW3' }] })
  ]);
  assert.deepEqual(result.rows.map(row => row.month), ['2026-01', '2026-02', '2026-04', '2026-05']);
  assert.deepEqual(result.diagnostics.inactiveMonths, ['2026-03']);
  assert.ok(result.rows.slice(1).every(row => !(row.components || []).some(item => item.ticker === 'OLD3')));
  const selected = selectExposureReturnWindowV5(result.rows, 'SINCE_START', 120, new Date('2026-05-20T00:00:00Z'));
  assert.deepEqual(selected.rows.map(row => row.month), ['2026-01', '2026-02', '2026-04', '2026-05']);
  assert.equal(selected.rows.at(-1).portfolioReturnPercent > 0, true);
});

test('resumo contém somente meses que realmente tiveram exposição', () => {
  const summary = summarizeExposureReturnV5([
    { month: '2026-01', monthlyReturnPercent: 10, portfolioReturnPercent: 10 },
    { month: '2026-02', monthlyReturnPercent: -2, portfolioReturnPercent: 7.8 },
    { month: '2026-04', monthlyReturnPercent: 4, portfolioReturnPercent: 12.112 }
  ]);
  assert.equal(summary.bestMonth.month, '2026-01');
  assert.equal(summary.worstMonth.month, '2026-02');
  assert.equal(summary.averageMonthlyReturnPercent, 4);
});
