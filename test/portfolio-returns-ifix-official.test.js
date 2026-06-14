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
assert.match(ifix.source || '', /B3 Oficial|B3/i);
assert.notEqual(ifix.source, 'YahooChart');
assert.notEqual(ifix.proxyTickerUsed, true);
assert.notEqual(ifix.simulated, true);
assert.ok(contract.diagnostics.warnings.some(w => /IFIX oficial B3|IFIX/i.test(w)), 'must warn instead of simulating IFIX when official source is unavailable');
console.log('Portfolio returns IFIX official-only test OK.');
