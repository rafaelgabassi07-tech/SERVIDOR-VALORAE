import assert from 'node:assert/strict';
import { buildPortfolioReturns } from '../lib/portfolio/analysis.js';

const payload = {
  range: '12M',
  assetFilter: 'ALL',
  benchmarks: ['NONE'],
  portfolioHistory: [
    { date: '2026-01-01', totalValue: 1000, investedValue: 1000, returnPercent: 0, source: 'broker-real-history' },
    { date: '2026-02-01', totalValue: 1100, investedValue: 1000, returnPercent: 10, source: 'broker-real-history' },
    { date: '2026-03-01', totalValue: 1050, investedValue: 1000, returnPercent: 5, source: 'broker-real-history' }
  ]
};

const contract = await buildPortfolioReturns(payload);
assert.equal(contract.contractVersion, 'valorae-portfolio-returns-v2-index-provider-parity');
assert.equal(contract.status, 'OK');
assert.equal(contract.series.length, 3);
assert.equal(contract.summary.totalReturnPercent, 5);
assert.equal(contract.monthlyTable[0].year, 2026);
assert.ok(Object.prototype.hasOwnProperty.call(contract.monthlyTable[0], 'jan'));
assert.ok(Array.isArray(contract.highlights));
console.log('Portfolio returns contract test OK.');
