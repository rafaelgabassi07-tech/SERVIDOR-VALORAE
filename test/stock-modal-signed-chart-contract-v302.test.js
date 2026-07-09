import assert from 'node:assert/strict';
import { _test } from '../lib/analysis/stock-modal-contract.js';

const canonical = {
  financial: {
    revenueProfit: [
      { year: 2022, netRevenue: 120_000_000, netProfit: 18_000_000 },
      { year: 2023, netRevenue: 108_000_000, netProfit: -22_500_000 },
      { year: 2024, netRevenue: 131_000_000, netProfit: 31_000_000 }
    ],
    equityEvolution: [
      { year: 2022, netWorth: 210_000_000 },
      { year: 2023, netWorth: 185_000_000 },
      { year: 2024, netWorth: 238_000_000 }
    ]
  }
};

const revenueProfit = _test.buildStockRevenueProfitChartPayload({ ticker: 'TEST3', canonical });
assert.equal(revenueProfit.status, 'OK');
assert.equal(revenueProfit.points.find(point => point.label === '2023').netIncome, -22_500_000);
assert.equal(revenueProfit.points.find(point => point.label === '2023').netIncomeDisplay, '-22,50M');
assert.equal(revenueProfit.diagnostics.negativeNetIncome, 1);

const equityEvolution = _test.buildStockEquityEvolutionChartPayload({ ticker: 'TEST3', canonical });
assert.equal(equityEvolution.status, 'OK');
assert.equal(equityEvolution.points.find(point => point.label === '2023').netIncome, -22_500_000);
assert.equal(equityEvolution.points.find(point => point.label === '2023').netIncomeDisplay, '-22,50M');
assert.equal(equityEvolution.diagnostics.negativeNetIncome, 1);

const payout = _test.buildStockPayoutChartPayload({
  ticker: 'TEST3',
  payoutRaw: {
    xAxis: { categories: ['2022', '2023', '2024'] },
    series: [
      { name: 'Lucro Líquido', data: ['18,00 M', '-22,50 M', '31,00 M'] },
      { name: 'Payout', data: ['40,00%', '-10,00%', '35,00%'] },
      { name: 'Dividend Yield', data: ['4,00%', '0,00%', '5,00%'] }
    ]
  },
  canonical
});
assert.equal(payout.status, 'OK');
assert.equal(payout.points.find(point => point.label === '2023').netIncome, -22_500_000);
assert.equal(payout.points.find(point => point.label === '2023').payoutPercent, -10);
assert.equal(payout.diagnostics.negativeNetIncome, 1);

console.log('stock-modal-signed-chart-contract-v302 ok');
