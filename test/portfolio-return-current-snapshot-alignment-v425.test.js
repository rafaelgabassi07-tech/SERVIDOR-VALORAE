import assert from 'node:assert/strict';
import {
  buildExposureOnlyReturnSeriesV5,
  reconcileCurrentMarketSnapshotV5,
  selectExposureReturnWindowV5
} from '../lib/portfolio/return-engine-v5.js';

const history = [
  {
    month: '2026-07',
    marketValue: 1000,
    totalValue: 1000,
    capitalExposed: true,
    completeValuation: true,
    partialValuation: false,
    valuationCoveragePercent: 100
  },
  {
    month: '2026-08',
    marketValue: 1100,
    totalValue: 1100,
    capitalExposed: true,
    currentMonthPartial: true,
    completeValuation: true,
    partialValuation: false,
    valuationCoveragePercent: 100
  }
];

const before = buildExposureOnlyReturnSeriesV5(history).rows;
assert.equal(before.length, 1);
assert.equal(before[0].monthlyReturnPercent, 10);

const alignedHistory = reconcileCurrentMarketSnapshotV5(history, {
  month: '2026-08',
  marketValue: 1050,
  complete: true
});
assert.equal(alignedHistory[1].marketValue, 1050);
assert.equal(alignedHistory[1].totalValue, 1050);
assert.equal(alignedHistory[1].currentSnapshotAligned, true);

const alignedRows = buildExposureOnlyReturnSeriesV5(alignedHistory).rows;
assert.equal(alignedRows.length, 1);
assert.equal(alignedRows[0].monthlyReturnPercent, 5);
const selected = selectExposureReturnWindowV5(alignedRows, 'SINCE_START', 12, new Date('2026-08-23T12:00:00Z'));
assert.equal(selected.rows.at(-1).portfolioReturnPercent, 5);
assert.equal(selected.rows.at(-1).marketValue, 1050);

const cashFlowHistory = [
  {
    month: '2026-07',
    marketValue: 1000,
    totalValue: 1000,
    capitalExposed: true,
    completeValuation: true,
    partialValuation: false,
    valuationCoveragePercent: 100
  },
  {
    month: '2026-08',
    marketValue: 1600,
    totalValue: 1600,
    capitalExposed: true,
    monthlyContributions: 500,
    monthlyWithdrawals: 0,
    weightedNetCashFlow: 250,
    currentMonthPartial: true,
    completeValuation: true,
    partialValuation: false,
    valuationCoveragePercent: 100
  }
];
const alignedCashFlow = reconcileCurrentMarketSnapshotV5(cashFlowHistory, {
  month: '2026-08',
  marketValue: 1500,
  complete: true
});
const cashFlowRows = buildExposureOnlyReturnSeriesV5(alignedCashFlow).rows;
assert.equal(cashFlowRows.at(-1).monthlyReturnPercent, 0, 'snapshot deve ser recalculado por Modified Dietz, não por P/L sobre custo');

const incomplete = reconcileCurrentMarketSnapshotV5(history, {
  month: '2026-08',
  marketValue: 900,
  complete: false
});
assert.equal(incomplete[1].marketValue, 1100, 'snapshot incompleto não pode substituir valuation consistente');

console.log('portfolio return current snapshot alignment v425 ok');
