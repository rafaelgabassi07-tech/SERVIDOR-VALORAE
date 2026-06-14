import assert from 'node:assert/strict';
import { buildPortfolioReturns } from '../lib/portfolio/analysis.js';

process.env.VALORAE_DISABLE_EXTERNAL = '1';

const contract = await buildPortfolioReturns({
  range: '12M',
  assetFilter: 'ALL',
  benchmarks: ['IBOV', 'SMLL', 'IDIV'],
  portfolioHistory: [
    { date: '2026-01-01', totalValue: 1000, investedValue: 1000, returnPercent: 0, source: 'broker-real-history' },
    { date: '2026-02-01', totalValue: 1080, investedValue: 1000, returnPercent: 8, source: 'broker-real-history' },
    { date: '2026-03-01', totalValue: 1040, investedValue: 1000, returnPercent: 4, source: 'broker-real-history' }
  ]
});

for (const ticker of ['IBOV', 'SMLL', 'IDIV']) {
  const item = contract.benchmarks.find(row => row.ticker === ticker);
  assert.ok(item, `${ticker} benchmark should exist`);
  assert.match(item.source || '', /B3 Oficial|B3/i);
  assert.notEqual(item.source, 'YahooChart');
  assert.notEqual(item.proxyTickerUsed, true);
  assert.notEqual(item.simulated, true);
}
console.log('Portfolio returns B3 official indexes test OK.');
