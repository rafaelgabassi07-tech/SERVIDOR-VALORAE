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


const restMetricMapShape = {
  data: {
    ticker: 'PETR4',
    indicators_history: {
      periods: ['Atual', '2025', '2024', '2023'],
      indicators: {
        pl: [4.54, 3.61, 12.74, 3.85],
        pReceitaPsr: [0.98, 0.80, 0.95, 0.94],
        pVp: [1.10, 0.96, 1.27, 1.26],
        dividendYieldDy: { unit: 'percent', values: [7.78, 10.49, 21.49, 19.33] },
        payout: { type: 'percent', data: [38.46, 43.02, 278.99, 79.30] },
        margemLiquida: { unit: 'percent', values: [21.60, 22.13, 7.46, 24.34] },
        margemBruta: { unit: 'percent', values: [47.36, 47.63, 50.21, 52.72] },
        margemEbitda: { unit: 'percent', values: [46.35, 46.23, 35.37, 49.91] },
        evEbitda: [3.65, 3.23, 4.71, 2.82],
        pEbit: [3.40, 2.73, 3.40, 2.53],
        roe: { unit: 'percent', values: [24.17, 26.49, 10.00, 32.75] },
        roic: { unit: 'percent', values: [12.95, 13.21, 16.16, 20.05] },
        dividaLiquidaEbitda: [1.40, 1.45, 1.88, 0.89],
        cagrReceitas5Anos: { unit: 'percent', values: [12.83, 12.83, 10.18, 7.91] }
      }
    }
  }
};
const restMetricMapCandidates = _test.collectStockHistoricalIndicatorCandidates(restMetricMapShape);
const builtMetricMap = _test.buildStockHistoricalIndicators(restMetricMapCandidates, 'PETR4', {});
assert.equal(builtMetricMap.status, 'OK');
assert.equal(builtMetricMap.rows.find(row => row.label === 'P/L')?.values.Atual, '4,54');
assert.equal(builtMetricMap.rows.find(row => row.label === 'P/Receita (PSR)')?.values['2025'], '0,80');
assert.equal(builtMetricMap.rows.find(row => row.label === 'P/VP')?.values['2024'], '1,27');
assert.equal(builtMetricMap.rows.find(row => row.label === 'Dividend Yield')?.values['2024'], '21,49%');
assert.equal(builtMetricMap.rows.find(row => row.label === 'Payout')?.values['2023'], '79,30%');
assert.equal(builtMetricMap.rows.find(row => row.label === 'Margem Líquida')?.values.Atual, '21,60%');
assert.equal(builtMetricMap.rows.find(row => row.label === 'Margem Bruta')?.values['2025'], '47,63%');
assert.equal(builtMetricMap.rows.find(row => row.label === 'Margem Ebitda')?.values['2023'], '49,91%');
assert.equal(builtMetricMap.rows.find(row => row.label === 'EV/Ebitda')?.values['2024'], '4,71');
assert.equal(builtMetricMap.rows.find(row => row.label === 'P/Ebit')?.values['2025'], '2,73');
assert.equal(builtMetricMap.rows.find(row => row.label === 'ROE')?.values['2023'], '32,75%');
assert.equal(builtMetricMap.rows.find(row => row.label === 'ROIC')?.values['2024'], '16,16%');
assert.equal(builtMetricMap.rows.find(row => row.label === 'Dívida Líquida / Ebitda')?.values['2023'], '0,89');
assert.equal(builtMetricMap.rows.find(row => row.label === 'CAGR Receitas 5 anos')?.values['2025'], '12,83%');
assert.ok(builtMetricMap.rows.length >= 14, 'REST metric-map shape must not be limited to P/L and PSR');

const idBasedRestRowsShape = {
  response: {
    historical_indicators: {
      years: ['Atual', '2025', '2024'],
      metrics: [
        { id: 'pVp', values: [1.10, 0.96, 1.27] },
        { slug: 'dividendYieldDy', unit: 'percent', values: [7.78, 10.49, 21.49] },
        { code: 'margemLiquida', type: 'percent', values: [21.60, 22.13, 7.46] },
        { metricName: 'netDebtToEbitda', values: [1.40, 1.45, 1.88] }
      ]
    }
  }
};
const idBasedBuilt = _test.buildStockHistoricalIndicators(
  _test.buildStockHistoricalIndicatorSources({ ticker: 'PETR4', apiExtras: { rawJson: { assetTickerRest: idBasedRestRowsShape } } }),
  'PETR4',
  {}
);
assert.equal(idBasedBuilt.rows.find(row => row.label === 'P/VP')?.values['2024'], '1,27');
assert.equal(idBasedBuilt.rows.find(row => row.label === 'Dividend Yield')?.values['2025'], '10,49%');
assert.equal(idBasedBuilt.rows.find(row => row.label === 'Margem Líquida')?.values.Atual, '21,60%');
assert.equal(idBasedBuilt.rows.find(row => row.label === 'Dívida Líquida / Ebitda')?.values['2024'], '1,88');

console.log('stock-modal-historical-indicators-rest-i10-v256 ok');

const longRestWithDescriptionsShape = {
  data: {
    ticker: 'PETR4',
    indicators_history: {
      periods: ['Atual', '2025', '2024', '2023', '2022', '2021', '2020', '2019', '2018'],
      indicators: [
        {
          metricName: 'P/L',
          description: 'Preço da ação dividido pelo lucro por ação; não deve virar coluna nem célula da tabela.',
          values: [4.54, 3.61, 12.74, 3.85, 1.68, 3.44, 7.51, 16.62, 8.32]
        },
        {
          metricName: 'Dividend Yield',
          unit: 'percent',
          description: 'Descrição longa do indicador, fora da grade histórica.',
          values: [7.78, 10.49, 21.49, 19.33, 67.99, 19.85, 18.80, 3.20, 4.10]
        }
      ]
    }
  }
};
const longBuilt = _test.buildStockHistoricalIndicators(
  _test.buildStockHistoricalIndicatorSources({ ticker: 'PETR4', apiExtras: { rawJson: { assetTickerRest: longRestWithDescriptionsShape } } }),
  'PETR4',
  {}
);
assert.deepEqual(longBuilt.tablesByPeriod['5y'].columns, ['Atual', '2025', '2024', '2023', '2022', '2021']);
assert.deepEqual(longBuilt.tablesByPeriod['10y'].columns, ['Atual', '2025', '2024', '2023', '2022', '2021', '2020', '2019', '2018']);
assert.ok(!longBuilt.tablesByPeriod['5y'].columns.some(column => /description|descri/i.test(column)), 'description must not be rendered as a historical year column');
assert.ok(!Object.keys(longBuilt.tablesByPeriod['5y'].rows.find(row => row.label === 'P/L')?.values || {}).some(column => /description|descri/i.test(column)), 'description must not be injected into historical row values');
assert.equal(longBuilt.tablesByPeriod['10y'].rows.find(row => row.label === 'P/L')?.values['2019'], '16,62');

console.log('stock-modal-historical-indicators-rest-i10-v256 visual-regression ok');
