import assert from 'node:assert/strict';
import { _test } from '../lib/analysis/stock-modal-contract.js';

const transposedChartShape = {
  data: {
    ticker: 'PETR4',
    chartData: {
      categories: ['P/L', 'P/Receita (PSR)', 'P/VP', 'Dividend Yield', 'Payout', 'Margem Líquida', 'ROE', 'CAGR Receitas 5 anos'],
      series: [
        { name: 'Atual', data: [4.54, 0.98, 1.10, 7.78, 38.46, 21.60, 24.17, 12.83] },
        { name: '2025', data: [3.61, 0.80, 0.96, 10.49, 43.02, 22.13, 26.49, 12.83] },
        { name: '2024', data: [12.74, 0.95, 1.27, 21.49, 278.99, 7.46, 10.00, 10.18] }
      ]
    }
  }
};

const built = _test.buildStockHistoricalIndicators(
  _test.buildStockHistoricalIndicatorSources({ ticker: 'PETR4', apiExtras: { rawJson: { historicoIndicadores: transposedChartShape } } }),
  'PETR4',
  {}
);

assert.equal(built.status, 'OK');
assert.equal(built.rows.find(row => row.label === 'P/L')?.values.Atual, '4,54');
assert.equal(built.rows.find(row => row.label === 'P/Receita (PSR)')?.values['2025'], '0,80');
assert.equal(built.rows.find(row => row.label === 'P/VP')?.values['2024'], '1,27');
assert.equal(built.rows.find(row => row.label === 'Dividend Yield')?.values['2024'], '21,49%');
assert.equal(built.rows.find(row => row.label === 'Payout')?.values['2024'], '278,99%');
assert.equal(built.rows.find(row => row.label === 'Margem Líquida')?.values.Atual, '21,60%');
assert.equal(built.rows.find(row => row.label === 'ROE')?.values['2025'], '26,49%');
assert.equal(built.rows.find(row => row.label === 'CAGR Receitas 5 anos')?.values['2024'], '10,18%');
assert.deepEqual(built.tablesByPeriod['5y'].columns, ['Atual', '2025', '2024']);

console.log('stock-modal-historical-indicators-transposed-i10-v261 ok');
