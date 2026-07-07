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
        regularMarketPrice: 9.7,
        chartPreviousClose: 9.0
      },
      timestamp: timestamps,
      indicators: {
        quote: [{
          open: [9.0, 9.2, 9.5],
          high: [9.2, 9.6, 9.8],
          low: [8.9, 9.1, 9.4],
          close: [9.0, 9.4, 9.2],
          volume: [1000, 1100, 1200]
        }]
      }
    }],
    error: null
  }
}), { status: 200, headers: { 'content-type': 'application/json' } });

const result = await buildPortfolioHistory([
  { ticker: 'TEST3', quantity: 1, averagePrice: 9.0, currentPrice: 9.7 }
], { range: '1d', interval: '5m', timeoutMs: 1000 });

assert.equal(result.ok, true);
assert.equal(result.fallbackUsed, false);
assert.ok(result.remotePointCount >= 3, `remotePointCount=${result.remotePointCount}`);
assert.ok(result.series.length >= 3, `series.length=${result.series.length}`);
assert.ok(result.series.every(point => Number.isFinite(point.timestamp) && point.timestamp > 0));
assert.ok(new Set(result.series.map(point => String(point.date).slice(0, 10))).size <= 2);
assert.ok(result.series.some(point => String(point.source || '').includes('Intraday')));
assert.ok(result.series[result.series.length - 1].totalValue > 0);
console.log('portfolio-history-intraday-v282 ok');
