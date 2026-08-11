import assert from 'node:assert/strict';
import { buildPortfolioHistory } from '../lib/portfolio/history.js';

// Deterministic Tuesday during B3 regular session (15:00 America/Sao_Paulo).
// Intraday tests must not depend on the wall clock of the CI runner.
const __realDateNow = Date.now;
const __marketNowMs = Date.parse('2026-08-11T18:00:00.000Z');
Date.now = () => __marketNowMs;

const now = Math.floor(Date.now() / 1000);
const timestamps = [now - 3600, now - 2700, now - 1800, now - 900];

globalThis.fetch = async () => new Response(JSON.stringify({
  chart: {
    result: [{
      meta: {
        currency: 'BRL',
        timezone: 'America/Sao_Paulo',
        regularMarketPrice: 101,
        chartPreviousClose: 100
      },
      timestamp: timestamps,
      indicators: {
        quote: [{
          open: [10, 100, 100.5, 101],
          high: [10, 101, 101, 101.5],
          low: [9, 99, 99.5, 100.5],
          close: [10, 100, 100.5, 101],
          volume: [1000, 1000, 1000, 1000]
        }]
      }
    }],
    error: null
  }
}), { status: 200, headers: { 'content-type': 'application/json' } });

const result = await buildPortfolioHistory([
  { ticker: 'EDGE3', quantity: 1, averagePrice: 90, currentPrice: 101 }
], { range: '1d', interval: '5m', timeoutMs: 1000, maxConcurrency: 1 });

assert.equal(result.ok, true);
assert.equal(result.fallbackUsed, false);
assert.ok(result.series.length >= 3, `series.length=${result.series.length}`);
assert.ok(result.summary.firstValue >= 95, `isolated edge outlier must not drive firstValue: ${JSON.stringify(result.series)}`);
assert.ok(Math.min(...result.series.map(point => point.totalValue)) >= 95, `edge outlier remained in series: ${JSON.stringify(result.series)}`);
assert.equal(result.version, '21.12.405-regular-session-calendar-v365');
Date.now = __realDateNow;
console.log('portfolio-history-intraday-edge-stability-v299 ok');
