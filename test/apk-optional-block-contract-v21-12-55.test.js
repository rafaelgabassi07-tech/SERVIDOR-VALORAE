import assert from 'node:assert/strict';
import historyHandler from '../routes/asset/history.js';
import newsHandler from '../routes/news.js';
import { clearValoraeCaches } from '../lib/Valorae-engine.js';

function mockRes() {
  return {
    statusCode: 200,
    headers: {},
    body: '',
    setHeader(k, v) { this.headers[String(k).toLowerCase()] = String(v); },
    getHeader(k) { return this.headers[String(k).toLowerCase()]; },
    removeHeader(k) { delete this.headers[String(k).toLowerCase()]; },
    status(c) { this.statusCode = c; return this; },
    send(b) { this.body = String(b ?? ''); return this; },
    end(b = '') { this.body = String(b ?? ''); return this; },
  };
}

function req(url, query = {}) {
  return { method: 'GET', url, query, body: {}, headers: {}, socket: { remoteAddress: '127.0.0.1' } };
}
function parse(res) { return JSON.parse(res.body || '{}'); }

const originalFetch = globalThis.fetch;
try {
  globalThis.fetch = async () => { throw Object.assign(new Error('fetch failed'), { name: 'TypeError' }); };

  const historyRes = mockRes();
  await historyHandler(req('/api/v1/asset/history?ticker=PETR4', { ticker: 'PETR4', range: '1Y', timeoutMs: '1000' }), historyRes);
  const history = parse(historyRes);
  assert.equal(historyRes.statusCode, 200, 'histórico opcional não deve retornar 502 para o APK');
  assert.equal(history.ok, false);
  assert.equal(history.empty, true);
  assert.equal(history.endpoint, 'asset-history');
  assert.equal(history.appPolicy.optionalBlock, true);
  assert.equal(history.appPolicy.shouldKeepPreviousHistory, true);
  assert.equal(Object.prototype.hasOwnProperty.call(history, 'error'), false, 'histórico não deve expor root error fatal para APK legado');

  clearValoraeCaches('news');
  const newsRes = mockRes();
  await newsHandler(req('/api/v1/news?ticker=PETR4', { ticker: 'PETR4', limit: '3', newsTimeoutMs: '500', nocache: '1' }), newsRes);
  const news = parse(newsRes);
  assert.equal(newsRes.statusCode, 200, 'notícias opcionais não devem derrubar HTTP');
  assert.equal(news.ok, false);
  assert.equal(news.appPolicy.optionalBlock, true);
  assert.equal(news.appPolicy.shouldKeepPreviousNews, true);
  assert.equal(Object.prototype.hasOwnProperty.call(news, 'error'), false, 'notícias não devem expor root error fatal para APK legado');
  assert.ok(news.warning || news.message);
} finally {
  globalThis.fetch = originalFetch;
  clearValoraeCaches('news');
}
console.log('apk-optional-block-contract-v21-12-55 OK');
