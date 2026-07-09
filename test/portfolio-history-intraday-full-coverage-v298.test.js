import assert from 'node:assert/strict';
import { buildPortfolioHistory } from '../lib/portfolio/history.js';

const now = Math.floor(Date.now() / 1000);
const t1 = now - 3600;
const t2 = now - 1800;
const t3 = now - 900;

function yahooPayload(timestamps, closes, price) {
  return {
    chart: {
      result: [{
        meta: {
          currency: 'BRL',
          timezone: 'America/Sao_Paulo',
          regularMarketPrice: price,
          chartPreviousClose: closes[0]
        },
        timestamp: timestamps,
        indicators: {
          quote: [{
            open: closes,
            high: closes.map(v => v + 1),
            low: closes.map(v => Math.max(0.01, v - 1)),
            close: closes,
            volume: closes.map(() => 1000)
          }]
        }
      }],
      error: null
    }
  };
}

globalThis.fetch = async (url) => {
  const rawUrl = String(url);
  const ticker = rawUrl.includes('BBB4.SA') ? 'BBB4' : 'AAA3';
  const payload = ticker === 'AAA3'
    ? yahooPayload([t1, t2, t3], [100, 101, 102], 102)
    : yahooPayload([t2, t3], [200, 201], 201);
  return new Response(JSON.stringify(payload), { status: 200, headers: { 'content-type': 'application/json' } });
};

const result = await buildPortfolioHistory([
  { ticker: 'AAA3', quantity: 1, averagePrice: 90, currentPrice: 102 },
  { ticker: 'BBB4', quantity: 1, averagePrice: 180, currentPrice: 201 }
], { range: '1d', interval: '5m', timeoutMs: 1000, maxConcurrency: 1 });

assert.equal(result.ok, true);
assert.equal(result.fallbackUsed, false);
assert.ok(result.remotePointCount >= 2, `remotePointCount=${result.remotePointCount}`);
assert.ok(result.series.length >= 2, `series.length=${result.series.length}`);
const min = Math.min(...result.series.map(point => point.totalValue));
assert.ok(min >= 295, `intraday series must not expose partial single-asset portfolio values, min=${min}`);
assert.ok(result.summary.firstValue >= 300, `firstValue=${result.summary.firstValue}`);
console.log('portfolio-history-intraday-full-coverage-v298 ok');
