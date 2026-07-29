import assert from 'node:assert/strict';
import { buildPortfolioHistory } from '../lib/portfolio/history.js';

const now = Math.floor(Date.now() / 1000);
const timestamps = [now - 3600, now - 1800, now - 600];

globalThis.fetch = async () => new Response(JSON.stringify({
  chart: {
    result: [{
      meta: { currency: 'BRL', regularMarketPrice: 110, chartPreviousClose: 100 },
      timestamp: timestamps,
      indicators: { quote: [{ close: [100, 104, 110], volume: [1000, 1000, 1000] }] }
    }],
    error: null
  }
}), { status: 200, headers: { 'content-type': 'application/json' } });

const raw = await buildPortfolioHistory([
  { ticker: 'TEST3', quantity: 1, averagePrice: 90, currentPrice: 100 }
], { range: '1d', interval: '5m', timeoutMs: 1000, maxConcurrency: 1 });
assert.deepEqual(raw.series.filter(row => row.source === 'YahooChartIntraday').map(row => row.totalValue), [100, 104, 110]);
assert.equal(raw.series.some(row => row.liveAligned === true), false);

const aligned = await buildPortfolioHistory([
  { ticker: 'TEST3', quantity: 1, averagePrice: 90, currentPrice: 100 }
], { range: '1d', interval: '5m', timeoutMs: 1000, maxConcurrency: 1, liveAlignment: true });
const remote = aligned.series.filter(row => row.source === 'YahooChartIntraday');
assert.deepEqual(remote.map(row => row.totalValue), [90.91, 94.55, 100]);
assert.ok(remote.every(row => row.liveAligned === true));
assert.equal(aligned.series.at(-1).totalValue, 100);
console.log('portfolio-history-apk-live-alignment-v398 ok');
