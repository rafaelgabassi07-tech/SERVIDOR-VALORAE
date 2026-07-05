import assert from 'node:assert/strict';
import { _test } from '../lib/analysis/stock-modal-contract.js';

const restAssetTickerShape = {
  data: {
    ticker: 'PETR4',
    asset: { id: 456, companyId: 95, symbol: 'PETR4' },
    indicators_history: {
      periods: ['Atual', '2025', '2024', '2023', '2022', '2021'],
      indicators: [
        { indicator: 'P/L', values: [4.54, 3.61, 12.74, 3.85, 1.68, 3.44] },
        { indicator: 'Dividend Yield', unit: 'percent', values: [7.78, 10.49, 21.49, 19.33, 67.99, 19.85] },
        { indicator: 'Payout', unit: 'percent', values: [38.46, 43.02, 278.99, 79.30, 103.29, 68.31] },
        { indicator: 'ROE', unit: 'percent', values: [24.17, 26.49, 10, 32.75, 51.6, 27.54] }
      ]
    }
  }
};

const candidates = _test.collectStockHistoricalIndicatorCandidates(restAssetTickerShape);
assert.ok(candidates.length >= 1, 'REST asset ticker payload should yield historical indicator candidates');
const built = _test.buildStockHistoricalIndicators(candidates, 'PETR4', {});
assert.equal(built.status, 'OK');
assert.ok(built.periods.includes('5y'));
assert.equal(built.rows.find(row => row.label === 'P/L')?.values.Atual, '4,54');
assert.equal(built.rows.find(row => row.label === 'Dividend Yield')?.values['2024'], '21,49%');
assert.equal(built.rows.find(row => row.label === 'Payout')?.values['2022'], '103,29%');
assert.equal(built.rows.find(row => row.label === 'ROE')?.values['2023'], '32,75%');

const nestedRestShape = {
  response: {
    ticker: 'PETR4',
    fundamentals: {
      historicalIndicators: {
        fiveYears: {
          columns: ['Atual', 2025, 2024],
          rows: [
            ['P/VP', 1.10, 0.96, 1.27],
            ['Margem Líquida', '21,60%', '22,13%', '7,46%'],
            ['CAGR Receitas 5 anos', 12.83, 12.83, 10.18]
          ]
        },
        tenYears: {
          columns: ['Atual', 2025, 2024, 2023],
          rows: [
            ['P/VP', 1.10, 0.96, 1.27, 1.26],
            ['Margem Líquida', '21,60%', '22,13%', '7,46%', '24,34%']
          ]
        }
      }
    }
  }
};
const sources = _test.buildStockHistoricalIndicatorSources({ ticker: 'PETR4', apiExtras: { rawJson: { assetTickerRest: nestedRestShape } } });
const builtNested = _test.buildStockHistoricalIndicators(sources, 'PETR4', {});
assert.equal(builtNested.status, 'OK');
assert.ok(builtNested.periods.includes('5y'));
assert.ok(builtNested.periods.includes('10y'));
assert.equal(builtNested.tablesByPeriod['5y'].rows.find(row => row.label === 'P/VP')?.values['2024'], '1,27');
assert.equal(builtNested.tablesByPeriod['10y'].rows.find(row => row.label === 'Margem Líquida')?.values['2023'], '24,34%');

console.log('stock-modal-historical-indicators-rest-i10-v256 ok');
