import assert from 'node:assert/strict';
import { buildPortfolioHistory } from '../lib/portfolio/history.js';

const now = Math.floor(Date.now() / 1000);
const timestamps = [now - 3600, now - 1800, now - 300];
const originalFetch = globalThis.fetch;
globalThis.fetch = async () => new Response(JSON.stringify({
  chart: {
    result: [{
      meta: { currency: 'BRL', timezone: 'America/Sao_Paulo', regularMarketPrice: 2036.01, chartPreviousClose: 1964.85 },
      timestamp: timestamps,
      indicators: { quote: [{ close: [1998.0, 2021.0, 2036.01], open: [1998.0, 2021.0, 2036.01], high: [2000, 2024, 2038], low: [1996, 2018, 2032], volume: [1, 1, 1] }] }
    }],
    error: null
  }
}), { status: 200, headers: { 'content-type': 'application/json' } });

try {
  const result = await buildPortfolioHistory([
    { ticker: 'TEST3', quantity: 1, averagePrice: 1900, currentPrice: 1985.85 }
  ], { range: '1d', interval: '5m', timeoutMs: 1000, maxConcurrency: 1 });

  assert.equal(result.ok, true);
  assert.equal(result.summary.lastValue, 1985.85);
  assert.ok(result.series.every(point => point.liveAligned !== true), 'a série histórica não pode ser reescalada pelo valor atual');
  assert.deepEqual(result.series.map(point => point.totalValue), [1998, 2021, 1985.85]);
  assert.equal(result.series.at(-1).source, 'currentPrice');
  assert.equal(result.series.at(-1).totalValue, 1985.85);
} finally {
  globalThis.fetch = originalFetch;
}

console.log('portfolio-history-intraday-official-close-v307 ok');
