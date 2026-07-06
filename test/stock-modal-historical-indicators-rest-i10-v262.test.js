import assert from 'node:assert/strict';
import fs from 'node:fs';
import { _test } from '../lib/analysis/stock-modal-contract.js';

const restLongRecordShape = {
  data: {
    ticker: 'PETR4',
    company: { companyId: 95, tickerId: 456, ticker: 'PETR4' },
    historicalIndicators: [
      { indicador: { key: 'pl', label: 'P/L' }, ano: 'Atual', valor: 4.54 },
      { indicador: { key: 'pl', label: 'P/L' }, ano: 2025, valor: 3.61 },
      { indicador: { key: 'pl', label: 'P/L' }, ano: 2024, valor: 12.74 },
      { indicador: { key: 'pVp', label: 'P/VP' }, ano: 'Atual', valor: 1.10 },
      { indicador: { key: 'pVp', label: 'P/VP' }, ano: 2025, valor: 0.96 },
      { indicador: { key: 'pVp', label: 'P/VP' }, ano: 2024, valor: 1.27 },
      { indicator: 'Dividend Yield', period: 'Atual', value: 7.78, unit: 'percent', description: 'metadado não deve virar coluna' },
      { indicator: 'Dividend Yield', period: '2025-12-31', value: 10.49, unit: 'percent' },
      { indicator: 'Dividend Yield', period: '2024-12-31', value: 21.49, unit: 'percent' },
      { metricName: 'ROE', fiscalYear: 2024, metricValue: 10.0, unit: 'percent' },
      { metricName: 'ROE', fiscalYear: 2025, metricValue: 26.49, unit: 'percent' }
    ]
  }
};

const built = _test.buildStockHistoricalIndicators(
  _test.buildStockHistoricalIndicatorSources({ ticker: 'PETR4', apiExtras: { rawJson: { assetTickerRest: restLongRecordShape } } }),
  'PETR4',
  {}
);
assert.equal(built.status, 'OK');
assert.deepEqual(built.tablesByPeriod['5y'].columns, ['Atual', '2025', '2024']);
assert.equal(built.rows.find(row => row.label === 'P/L')?.values.Atual, '4,54');
assert.equal(built.rows.find(row => row.label === 'P/L')?.values['2025'], '3,61');
assert.equal(built.rows.find(row => row.label === 'P/VP')?.values['2024'], '1,27');
assert.equal(built.rows.find(row => row.label === 'Dividend Yield')?.values['2025'], '10,49%');
assert.equal(built.rows.find(row => row.label === 'ROE')?.values['2024'], '10,00%');
assert.ok(!built.tablesByPeriod['5y'].columns.some(column => /description|descri|value|valor|year|ano/i.test(column)), 'metadados de registro longo não devem virar coluna');

const ids = _test.extractInvestidor10StockIdsFromPayload(restLongRecordShape, 'PETR4');
assert.equal(ids.companyId, '95');
assert.equal(ids.tickerId, '456');

const source = fs.readFileSync('lib/analysis/stock-modal-contract.js', 'utf8');
assert.ok(source.includes('/api/rest/assets/tickers/${encodeURIComponent(symbol)}'), 'resolver de IDs deve consultar o endpoint REST de ticker antes dos endpoints históricos');
assert.ok(source.includes("'User-Agent': process.env.VALORAE_USER_AGENT || 'Mozilla/5.0'"), 'chamadas REST do Investidor10 devem usar User-Agent explícito');

console.log('stock-modal-historical-indicators-rest-i10-v262 ok');
