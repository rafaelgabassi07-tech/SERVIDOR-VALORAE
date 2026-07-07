import assert from 'node:assert/strict';
import { _test } from '../lib/analysis/stock-modal-contract.js';

const dataTablesShape = {
  draw: 1,
  recordsTotal: 3,
  recordsFiltered: 3,
  columns: [
    { data: 0, title: 'Indicador' },
    { data: 1, title: 'Atual' },
    { data: 2, title: '2025' },
    { data: 3, title: '2024' },
    { data: 4, title: '2023' }
  ],
  data: [
    { 0: 'P/L', 1: '4,54', 2: '3,61', 3: '12,74', 4: '3,85' },
    { 0: 'Dividend Yield', 1: '7,78%', 2: '10,49%', 3: '21,49%', 4: '19,33%' },
    { 0: 'ROE', 1: '24,17%', 2: '26,49%', 3: '10,00%', 4: '32,75%' }
  ]
};

const sources = _test.buildStockHistoricalIndicatorSources({
  ticker: 'PETR4',
  apiExtras: { rawJson: { historicoIndicadores: dataTablesShape } }
});
const built = _test.buildStockHistoricalIndicators(sources, 'PETR4', {});

assert.equal(built.status, 'OK');
assert.ok(built.periods.includes('5y'));
assert.equal(built.rows.find(row => row.label === 'P/L')?.values.Atual, '4,54');
assert.equal(built.rows.find(row => row.label === 'Dividend Yield')?.values['2024'], '21,49%');
assert.equal(built.rows.find(row => row.label === 'ROE')?.values['2023'], '32,75%');
assert.equal(built.rows.length, 3);

console.log('stock-modal-historical-indicators-indexed-rows-v274 ok');
