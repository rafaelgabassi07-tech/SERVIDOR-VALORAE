process.env.VALORAE_DISABLE_EXTERNAL = '1';
import assert from 'node:assert/strict';
import { _test } from '../lib/sources/asset-details.js';

assert.equal(_test.percentMetric(0.1234), 12.34);

const merged = _test.mergeFundamentalSnapshots(
  { indicators: { pvp: 1.2 }, indicatorCards: [{ label: 'P/VP', value: 1.2, display: '1,20', unit: '' }], profile: { sector: 'Financeiro' }, status: 'OK', diagnostics: [] },
  { indicators: { roe: 18.5, valorDeMercado: 1000000 }, indicatorCards: [{ label: 'ROE', value: 18.5, display: '18,50%', unit: '%' }], profile: { industry: 'Bancos' }, financialSeries: { revenueProfit: [{ year: '2024', label: '2024', netRevenue: 10, netProfit: 2 }], balance: [{ year: '2024', label: '2024', netWorth: 5, totalAssets: 8, totalLiabilities: 3 }] }, status: 'OK', diagnostics: [] }
);

assert.equal(merged.status, 'OK');
assert.equal(merged.indicators.pvp, 1.2);
assert.equal(merged.indicators.roe, 18.5);
assert.equal(merged.profile.sector, 'Financeiro');
assert.equal(merged.profile.industry, 'Bancos');
assert.equal(merged.indicatorCards.length, 2);

const financial = _test.buildSimpleFinancialSeries(merged.indicators, [{ close: 10 }], merged);
assert.equal(financial.revenueProfit.length, 1);
assert.equal(financial.balance.length, 1);
