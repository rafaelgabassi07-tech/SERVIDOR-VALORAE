import assert from 'node:assert/strict';
import {
  buildPortfolioHistory,
  portfolioHistoryBucketKey,
  portfolioHistoryPointBelongsToLifetime
} from '../lib/portfolio/history.js';

const seconds = value => Math.floor(Date.parse(value) / 1000);

assert.equal(
  portfolioHistoryBucketKey(seconds('2026-08-01T00:00:00Z'), { range: '5y', interval: '1mo' }),
  portfolioHistoryBucketKey(seconds('2026-08-31T18:00:00Z'), { range: '5y', interval: '1mo' })
);
assert.equal(
  portfolioHistoryBucketKey(seconds('2026-08-03T00:00:00Z'), { range: '5y', interval: '1wk' }),
  portfolioHistoryBucketKey(seconds('2026-08-09T20:00:00Z'), { range: '5y', interval: '1wk' })
);
assert.notEqual(
  portfolioHistoryBucketKey(seconds('2026-08-03T00:00:00Z'), { range: '5d', interval: '15m' }),
  portfolioHistoryBucketKey(seconds('2026-08-03T00:16:00Z'), { range: '5d', interval: '15m' })
);

const purchase = seconds('2026-02-15T00:00:00Z');
assert.equal(portfolioHistoryPointBelongsToLifetime(seconds('2026-02-01T00:00:00Z'), purchase, { range: '5y', interval: '1mo' }), true);
assert.equal(portfolioHistoryPointBelongsToLifetime(seconds('2026-01-01T00:00:00Z'), purchase, { range: '5y', interval: '1mo' }), false);

const now = new Date();
const currentMonthStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1) / 1000;
const previousMonthStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1) / 1000;
globalThis.fetch = async () => new Response(JSON.stringify({
  chart: {
    result: [{
      meta: { regularMarketPrice: 15, chartPreviousClose: 12 },
      timestamp: [previousMonthStart, currentMonthStart],
      indicators: { quote: [{ close: [12, 14], open: [12, 14], high: [12, 14], low: [12, 14], volume: [1, 1] }] }
    }],
    error: null
  }
}), { status: 200, headers: { 'content-type': 'application/json' } });

const result = await buildPortfolioHistory([
  { ticker: 'BUCK3', quantity: 10, averagePrice: 10, currentPrice: 15, firstPurchaseAt: previousMonthStart }
], { range: '5y', interval: '1mo', timeoutMs: 1000, maxConcurrency: 1 });

const currentBucket = portfolioHistoryBucketKey(Math.floor(Date.now() / 1000), { range: '5y', interval: '1mo' });
const currentRows = result.series.filter(row => portfolioHistoryBucketKey(Number(row.timestamp), { range: '5y', interval: '1mo' }) === currentBucket);
assert.equal(currentRows.length, 1, JSON.stringify(result.series));
assert.equal(currentRows[0].totalValue, 150);
assert.equal(result.portfolioInceptionDate, new Date(previousMonthStart * 1000).toISOString().slice(0, 10));

console.log('portfolio-chart-bucket-lifetime-v409 ok');
