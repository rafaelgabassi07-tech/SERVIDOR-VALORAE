import assert from 'node:assert/strict';
import { _test } from '../lib/analysis/stock-modal-contract.js';

const nestedChartJsShape = {
  data: {
    labels: ['Atual', '2025', '2024', '2023'],
    datasets: [
      { label: 'ROE', unit: 'percent', data: [24.17, 26.49, 10, 32.75] },
      { label: 'Dividend Yield', unit: 'percent', data: [7.69, 10.49, 21.49, 19.33] },
      { label: 'P/L', data: [4.58, 3.61, 12.74, 3.85] }
    ]
  }
};
const nested = _test.normalizeStockHistoricalIndicatorsDataset(nestedChartJsShape);
assert.equal(nested.status, 'OK');
assert.equal(nested.rows.find(row => row.label === 'ROE')?.values.Atual, '24,17%');
assert.equal(nested.rows.find(row => row.label === 'Dividend Yield')?.values['2024'], '21,49%');
assert.equal(nested.rows.find(row => row.label === 'P/L')?.values['2023'], '3,85');

const periodRecordShape = {
  data: [
    { ano: 'Atual', pl: 4.58, p_vp: 1.11, dividend_yield: '7,69%', payout: '38,46%', roe: '24,17%' },
    { ano: 2025, pl: 3.61, p_vp: 0.96, dividend_yield: '10,49%', payout: '43,02%', roe: '26,49%' },
    { ano: 2024, pl: 12.74, p_vp: 1.27, dividend_yield: '21,49%', payout: '278,99%', roe: '10,00%' }
  ]
};
const transposed = _test.normalizeStockHistoricalIndicatorsDataset(periodRecordShape);
assert.equal(transposed.status, 'OK');
assert.equal(transposed.rows.find(row => row.label === 'P/L')?.values['2024'], '12,74');
assert.equal(transposed.rows.find(row => row.label === 'P/VP')?.values.Atual, '1,11');
assert.equal(transposed.rows.find(row => row.label === 'Payout')?.values['2025'], '43,02%');

const primitiveMetricArrays = {
  chartData: {
    labels: ['Atual', '2025', '2024'],
    roe: [24.17, 26.49, 10],
    dividend_yield: [7.69, 10.49, 21.49],
    p_l: [4.58, 3.61, 12.74]
  }
};
const primitive = _test.normalizeStockHistoricalIndicatorsDataset(primitiveMetricArrays);
assert.equal(primitive.status, 'OK');
assert.equal(primitive.rows.find(row => row.label === 'ROE')?.values['2025'], '26,49%');
assert.equal(primitive.rows.find(row => row.label === 'P/L')?.values.Atual, '4,58');

const ids = _test.extractInvestidor10StockIdsFromPayload({
  results: [
    { ticker: 'VALE3', companyId: 123, tickerId: 888 },
    { ticker: 'PETR4', url: '/acoes/petr4/', empresa_id: 95, acaoId: 456 }
  ]
}, 'PETR4');
assert.equal(ids.companyId, '95');
assert.equal(ids.tickerId, '456');

console.log('stock-modal-historical-indicators-dynamic-i10-v246 ok');
