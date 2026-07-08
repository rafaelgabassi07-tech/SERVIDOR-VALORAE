import assert from 'node:assert/strict';
import { dispatchRoute } from '../routes/_router.js';

const now = Math.floor(Date.now() / 1000);
const timestamps = [now - 3600, now - 1800, now - 300];

globalThis.fetch = async () => new Response(JSON.stringify({
  chart: {
    result: [{
      meta: { currency: 'BRL', regularMarketPrice: 10.4, chartPreviousClose: 10.0 },
      timestamp: timestamps,
      indicators: { quote: [{ close: [10.0, 10.2, 10.4], volume: [100, 110, 120] }] }
    }],
    error: null
  }
}), { status: 200, headers: { 'content-type': 'application/json' } });

function mockResponse() {
  const headers = new Map();
  return {
    statusCode: 200,
    writableEnded: false,
    body: '',
    setHeader(key, value) { headers.set(key, value); },
    getHeader(key) { return headers.get(key); },
    removeHeader(key) { headers.delete(key); },
    end(body = '') { this.writableEnded = true; this.body = String(body || ''); return this; },
    status(code) { this.statusCode = code; return this; },
    send(body = '') { this.writableEnded = true; this.body = String(body || ''); return this; }
  };
}

const req = {
  method: 'GET',
  url: '/api/v1/portfolio/history?tickers=TEST3&quantities=2&avgPrices=9&range=1D&interval=5m&mode=mobile&source=apk-preco-carteira',
  headers: {}
};
const res = mockResponse();
await dispatchRoute(req, res);
const payload = JSON.parse(res.body);
assert.equal(payload.endpoint, 'portfolio-history');
assert.equal(payload.routeEngine, 'VALORAE_REALTIME_PORTFOLIO_HISTORY_ENGINE_V291');
assert.equal(payload.range, '1D');
assert.equal(payload.interval, '5m');
assert.equal(payload.fallbackUsed, false);
assert.ok(payload.series.length >= 3, `series.length=${payload.series?.length}`);
assert.ok(payload.series.some(point => String(point.source || '').includes('Intraday')));
console.log('portfolio-history-router-realtime-v291 ok');
