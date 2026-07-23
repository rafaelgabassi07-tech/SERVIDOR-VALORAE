import assert from 'node:assert/strict';
import { buildPortfolioHistory } from '../lib/portfolio/history.js';

const now = Math.floor(Date.now() / 1000);
const timestamps = [now - 3600, now - 1800, now - 900];

globalThis.fetch = async () => new Response(JSON.stringify({
  chart: {
    result: [{
      meta: {
        currency: 'BRL',
        timezone: 'America/Sao_Paulo',
        regularMarketPrice: 110,
        chartPreviousClose: 100
      },
      timestamp: timestamps,
      indicators: {
        quote: [{
          open: [100, 104, 110],
          high: [101, 105, 111],
          low: [99, 103, 109],
          close: [100, 104, 110],
          volume: [1000, 1100, 1200]
        }]
      }
    }],
    error: null
  }
}), { status: 200, headers: { 'content-type': 'application/json' } });

const result = await buildPortfolioHistory([
  { ticker: 'ALGN3', quantity: 1, averagePrice: 90, currentPrice: 100 }
], { range: '1d', interval: '5m', timeoutMs: 1000, maxConcurrency: 1 });

assert.equal(result.ok, true);
assert.equal(result.fallbackUsed, false);
assert.equal(result.summary.lastValue, 100);
const values = result.series.map(point => point.totalValue);
assert.deepEqual(values.slice(0, 3), [100, 104, 110], 'remote intraday closes must remain source-authentic');
assert.equal(result.series.at(-1).source, 'currentPrice');
assert.equal(result.series.at(-1).totalValue, 100);
assert.ok(result.series.every(point => point.liveAligned !== true), 'historical points must not be synthetically rescaled');
console.log('portfolio-history-intraday-live-alignment-v298 ok');
