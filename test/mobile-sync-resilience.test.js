import assert from 'node:assert/strict';
import { buildMobilePortfolioSync } from '../lib/contracts/mobile.js';
import { buildDividendsContract } from '../lib/portfolio/dividends-contract.js';

process.env.VALORAE_STATUSINVEST_ENABLED = '0';
process.env.VALORAE_INVESTIDOR10_AGENDA_ENABLED = '0';
process.env.VALORAE_AGENDA_ENABLED = '0';

const mobile = await buildMobilePortfolioSync({
  positions: [
    { ticker: 'PETR4', quantity: 100, avgPrice: 30, currentPrice: 33, firstPurchaseDate: '2024-01-02' }
  ],
  includeAnalysis: true,
  includeHistory: false,
  includeIpca: false,
  includeDividends: false,
  includeRankings: false
});

assert.equal(mobile.endpoint, 'mobile-portfolio-sync');
assert.equal(mobile.blockStatus.history, 'SKIPPED');
assert.equal(mobile.blockStatus.ipca, 'SKIPPED');
assert.equal(mobile.blockStatus.dividends, 'SKIPPED');
assert.deepEqual(mobile.portfolioHistory, []);
assert.deepEqual(mobile.ipcaSeries, []);
assert.deepEqual(mobile.portfolioUpcomingAll, []);
assert.deepEqual(mobile.portfolioAgenda, []);
assert.deepEqual(mobile.officialFutureEvents, []);
assert.deepEqual(mobile.allOfficialFuturePayments, []);

const dividends = await buildDividendsContract({
  positions: [{ ticker: 'MXRF11', quantity: 10, avgPrice: 10, currentPrice: 10, type: 'FII' }],
  tickers: 'MXRF11,PETR4',
  mode: 'normal',
  timeoutMs: 50
});

assert.equal(dividends.status, 'OK');
assert.ok(Array.isArray(dividends.officialEvents));
assert.ok(Array.isArray(dividends.portfolioUpcomingAll));
assert.ok(Array.isArray(dividends.portfolioAgenda));
assert.ok(dividends.tickers.includes('MXRF11'));
assert.ok(dividends.tickers.includes('PETR4'));
