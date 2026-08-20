import test from 'node:test';
import assert from 'node:assert/strict';
import { buildExposureOnlyReturnSeriesV5, selectExposureReturnWindowV5, summarizeExposureReturnV5 } from '../lib/portfolio/return-engine-v5.js';

const complete = (month, marketValue, extra = {}) => ({ month, marketValue, valuationCoveragePercent: 100, partialValuation: false, ...extra });

test('reentrada no fim de 2025 não transforma janeiro-outubro em rentabilidade', () => {
  const built = buildExposureOnlyReturnSeriesV5([
    ...Array.from({ length: 10 }, (_, index) => complete(`2025-${String(index + 1).padStart(2, '0')}`, 0, { capitalExposed: false })),
    complete('2025-11', 1015, { monthlyContributions: 1000, weightedNetCashFlow: 950, partialExposureMonth: true, capitalExposureStartDate: '2025-11-27' }),
    complete('2025-12', 1035.3)
  ]);
  const selected = selectExposureReturnWindowV5(built.rows, 'YTD', 12, new Date('2025-12-20T12:00:00Z'));
  assert.deepEqual(selected.rows.map(row => row.month), ['2025-11', '2025-12']);
  assert.equal(built.diagnostics.inactiveMonths.length, 10);
  assert.equal(selected.comparisonStartMonth, '2025-11');
});

test('resumo nunca recebe meses sem capital porque eles não existem no contrato', () => {
  const summary = summarizeExposureReturnV5([
    { month: '2025-11', monthlyReturnPercent: 1.5, portfolioReturnPercent: 1.5 },
    { month: '2025-12', monthlyReturnPercent: 2.0, portfolioReturnPercent: 3.53 }
  ]);
  assert.equal(summary.totalReturnPercent, 3.53);
  assert.equal(summary.bestMonth.month, '2025-12');
  assert.equal(summary.worstMonth.month, '2025-11');
});
