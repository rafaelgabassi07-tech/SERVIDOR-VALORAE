import assert from 'node:assert/strict';
import { _test } from '../lib/analysis/stock-modal-contract.js';

const payoutApiLike = {
  xAxis: { categories: ['2022', '2023', '2024', '2025', 'Últ 12M'] },
  series: [
    { name: 'Lucro Líquido', data: ['188,33 B', '124,60 B', '36,70 B', '110,61 B', '108,04 B'] },
    { name: 'Payout', data: ['103,29%', '79,30%', '278,99%', '43,02%', '38,46%'] },
    { name: 'Dividend Yield', data: ['67,99%', '19,33%', '21,49%', '10,49%', '7,78%'] }
  ]
};

const normalized = _test.normalizeStockPayoutDedicatedSource(payoutApiLike, { ticker: 'PETR4' });
assert.equal(normalized.length, 5, 'parser deve preservar séries do payout-chart real');
assert.equal(normalized.find(point => point.label === '2024').payoutPercent, 278.99);
assert.equal(normalized.find(point => point.label === 'Últ 12M').dividendYieldPercent, 7.78);
assert.equal(normalized.find(point => point.label === '2025').netIncome, 110_610_000_000);

const chart = _test.buildStockPayoutChartPayload({
  ticker: 'PETR4',
  payoutRaw: payoutApiLike,
  canonical: { financial: { revenueProfit: [
    { year: 2022, netProfit: 188_328_000_000 },
    { year: 2023, netProfit: 124_600_000_000 },
    { year: 2024, netProfit: 36_700_000_000 },
    { year: 2025, netProfit: 110_610_000_000 }
  ] } },
  historicalIndicators: {
    rows: [
      { label: 'Payout', values: { Atual: '38,46%', '2025': '43,02%', '2024': '278,99%', '2023': '79,30%', '2022': '103,29%' } },
      { label: 'Dividend Yield', values: { Atual: '7,78%', '2025': '10,49%', '2024': '21,49%', '2023': '19,33%', '2022': '67,99%' } }
    ]
  }
});
assert.equal(chart.status, 'OK');
assert.equal(chart.source, 'Investidor10 API payout-chart');
assert.equal(chart.points.length, 5);
assert.equal(chart.points.at(-1).label, 'Últ 12M');
assert.equal(chart.points.at(-1).payoutDisplay, '38,46%');
assert.equal(chart.points.find(point => point.label === '2025').netIncomeDisplay, '110,61B');

const rowsLike = [
  { year: 2023, lucroLiquido: '124.600.000.000', payout: '79,30%', dividendYield: '19,33%' },
  { year: 2024, lucroLiquido: '36.700.000.000', payout: '278,99%', dividendYield: '21,49%' }
];
const normalizedRows = _test.normalizeStockPayoutDedicatedSource(rowsLike, { ticker: 'PETR4' });
assert.equal(normalizedRows.length, 2);
assert.equal(normalizedRows.find(point => point.label === '2024').netIncome, 36_700_000_000);
