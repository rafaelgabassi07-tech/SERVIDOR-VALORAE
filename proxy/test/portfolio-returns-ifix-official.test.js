import assert from 'node:assert/strict';
import { buildPortfolioReturns } from '../lib/portfolio/analysis.js';

process.env.VALORAE_DISABLE_EXTERNAL = '1';

const contract = await buildPortfolioReturns({
  range: '12M',
  assetFilter: 'ALL',
  benchmarks: ['IFIX'],
  portfolioHistory: [
    { date: '2026-01-01', totalValue: 1000, investedValue: 1000, returnPercent: 0, source: 'broker-real-history' },
    { date: '2026-02-01', totalValue: 1100, investedValue: 1000, returnPercent: 10, source: 'broker-real-history' },
    { date: '2026-03-01', totalValue: 1050, investedValue: 1000, returnPercent: 5, source: 'broker-real-history' }
  ]
});

const ifix = contract.benchmarks.find(item => item.ticker === 'IFIX');
assert.ok(ifix, 'IFIX benchmark should exist');
assert.match(ifix.source || '', /Yahoo Finance Chart API|B3 Oficial|B3/i);
assert.ok(/IFIX\.SA|B3/i.test(ifix.source || '') || ifix.yahooSymbol === 'IFIX.SA', 'IFIX should prefer the direct Yahoo index symbol or B3 fallback');
assert.notEqual(ifix.source, 'YahooChart');
assert.notEqual(ifix.proxyTickerUsed, true);
assert.notEqual(ifix.simulated, true);
assert.ok(contract.diagnostics.warnings.some(w => /IFIX|Yahoo Finance|B3/i.test(w)), 'must warn instead of simulating IFIX when all external sources are unavailable');
console.log('Portfolio returns IFIX direct-source test OK.');
