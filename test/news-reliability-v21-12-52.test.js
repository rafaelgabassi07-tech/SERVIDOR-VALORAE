import assert from 'node:assert/strict';
import newsHandler from '../routes/news.js';
import { ValoraeEngine, clearValoraeCaches } from '../lib/Valorae-engine.js';
import { buildOfficialAppView } from '../lib/quality/app-official-view.js';

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

function makeReq(query = {}) {
  return { method: 'GET', url: '/api/news', query, body: {}, headers: {}, socket: { remoteAddress: '127.0.0.1' } };
}

function parse(res) { return JSON.parse(res.body || '{}'); }

const originalFetch = globalThis.fetch;

try {
  clearValoraeCaches('news');
  let fetchCount = 0;
  globalThis.fetch = async () => {
    fetchCount += 1;
    return {
      ok: true,
      status: 200,
      text: async () => `<rss><channel><item><title><![CDATA[PETR4 Petrobras anuncia dividendos na B3]]></title><link>https://news.example/petr4</link><pubDate>Fri, 29 May 2026 12:00:00 GMT</pubDate><source>Agência Teste</source><description><![CDATA[Petrobras PETR4 informa proventos e resultado.]]></description></item></channel></rss>`,
    };
  };
  const ok = await ValoraeEngine.fetchNews('PETR4', ['Petrobras'], { limit: 3, newsTimeoutMs: 500 });
  assert.equal(ok.ok, true);
  assert.equal(ok.items.length, 1);
  assert.equal(ok.code, 'GOOGLE_NEWS_OK');
  assert.equal(ok.appPolicy.canReplacePreviousNews, true);
  assert.equal(ok.reliability.version, '21.12.52-news-reliability-upgrade');
  assert.equal(fetchCount, 1);

  globalThis.fetch = async () => { throw new Error('não deveria chamar rede em cache hit'); };
  const cached = await ValoraeEngine.fetchNews('PETR4', ['Petrobras'], { limit: 3, newsTimeoutMs: 500 });
  assert.equal(cached.ok, true);
  assert.equal(cached.items.length, 1);
  assert.equal(cached.cacheStatus, 'NEWS_CACHE_HIT');

  const view = buildOfficialAppView({
    schemaVersion: 'test',
    version: ValoraeEngine.version,
    status: 'OK',
    partial: false,
    ticker: 'PETR4',
    type: 'ACAO',
    metrics: { generatedAt: new Date().toISOString(), extractionCompleteness: { complete: true } },
    news: ok.items,
    newsStatus: { ok: true, code: ok.code, count: ok.items.length, cacheStatus: ok.cacheStatus, reliability: ok.reliability },
    appPayload: { ticker: 'PETR4' },
    appMobileSnapshot: { ticker: 'PETR4' },
    appSyncEnvelope: {},
    appResponseIntegrity: { renderSafe: true, cacheSafe: true },
  });
  assert.equal(Array.isArray(view.news), true, 'view=app deve preservar raiz news para APK');
  assert.equal(view.newsStatus.ok, true, 'view=app deve preservar newsStatus');
  assert.ok(view.appContract.stableRootOrder.includes('news'));

  clearValoraeCaches('news');
  globalThis.fetch = async () => ({ ok: true, status: 200, text: async () => '<rss><channel></channel></rss>' });
  const empty = await ValoraeEngine.fetchNews('PETR4', ['Petrobras'], { limit: 3, newsTimeoutMs: 500 });
  assert.equal(empty.ok, false, 'RSS vazio não pode ser ok=true');
  assert.equal(empty.empty, true);
  assert.equal(empty.code, 'GOOGLE_NEWS_EMPTY');
  assert.equal(empty.appPolicy.shouldKeepPreviousNews, true);
  assert.equal(empty.appPolicy.canReplacePreviousNews, false);

  clearValoraeCaches('news');
  globalThis.fetch = async () => ({ ok: true, status: 200, text: async () => '<rss><channel><item><title>sem link</title></item></channel></rss>' });
  const malformed = await ValoraeEngine.fetchNews('PETR4', ['Petrobras'], { limit: 3, newsTimeoutMs: 500 });
  assert.equal(malformed.ok, false, 'RSS sem item útil não pode substituir notícias boas');
  assert.equal(malformed.code, 'GOOGLE_NEWS_EMPTY');

  clearValoraeCaches('news');
  globalThis.fetch = async () => { throw Object.assign(new Error('fetch failed'), { name: 'TypeError' }); };
  const fail = await ValoraeEngine.fetchNews('PETR4', ['Petrobras'], { limit: 3, newsTimeoutMs: 500 });
  assert.equal(fail.ok, false);
  assert.equal(fail.code, 'GOOGLE_NEWS_FETCH_FAILED');
  assert.equal(fail.appPolicy.shouldKeepPreviousNews, true);

  clearValoraeCaches('news');
  globalThis.fetch = async () => ({ ok: true, status: 200, text: async () => `<rss><channel><item><title>PETR4 Petrobras resultado e dividendos</title><link>https://news.example/petr4-2</link><pubDate>Fri, 29 May 2026 13:00:00 GMT</pubDate><source>Teste</source><description>PETR4 na bolsa e proventos.</description></item></channel></rss>` });
  const res = mockRes();
  await newsHandler(makeReq({ ticker: 'PETR4', limit: '5', newsTimeoutMs: '500' }), res);
  const body = parse(res);
  assert.equal(res.statusCode, 200);
  assert.equal(body.ok, true);
  assert.equal(body.items.length, 1);
  assert.equal(body.reliability.version, '21.12.52-news-reliability-upgrade');
} finally {
  globalThis.fetch = originalFetch;
  clearValoraeCaches('news');
}

console.log('news-reliability-v21-12-52 OK');
