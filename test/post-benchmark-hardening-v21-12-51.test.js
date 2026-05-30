import assert from 'node:assert/strict';
import scrapeHandler from '../routes/scrape.js';
import batchScrapeHandler from '../routes/batch-scrape.js';
import { ValoraeEngine } from '../lib/Valorae-engine.js';
import { clearScrapeResultCache } from '../lib/cache/scrape-result-cache.js';

function mockRes() {
  return {
    statusCode: 200,
    headers: {},
    setHeader(k, v) { this.headers[String(k).toLowerCase()] = String(v); },
    getHeader(k) { return this.headers[String(k).toLowerCase()]; },
    removeHeader(k) { delete this.headers[String(k).toLowerCase()]; },
    status(c) { this.statusCode = c; return this; },
    send(b) { this.body = String(b ?? ''); return this; },
    end(b = '') { this.body = String(b ?? ''); return this; },
  };
}

function makeReq({ method = 'GET', url = '/api/scrape', query = {}, body = undefined } = {}) {
  return { method, url, query, body, headers: {}, socket: {} };
}

function parse(res) { return JSON.parse(res.body || '{}'); }

const original = ValoraeEngine.scrapeUrl;
clearScrapeResultCache();
let calls = 0;
ValoraeEngine.scrapeUrl = async url => {
  calls += 1;
  await new Promise(r => setTimeout(r, 5));
  return {
    ok: true,
    status: 200,
    url,
    finalUrl: url,
    hostname: new URL(url).hostname,
    contentType: 'text/html',
    html: '<html><head><title>PETR4</title></head><body><h1>PETR4</h1><span class="price">R$ 38,10</span><span class="dy">8,4%</span></body></html>',
    htmlLength: 132,
    rawHtmlLength: 132,
    selectorResults: {},
    provider: 'MockFetch',
    cache: 'MISS',
    elapsedMs: 5,
  };
};

try {
  const baseQuery = {
    url: 'https://investidor10.com.br/acoes/petr4/',
    selectors: JSON.stringify({ title: 'h1', price: '.price', dy: '.dy' }),
    profile: 'scrape-fast',
    includeCharts: '0',
    includeDiagnostics: '0',
    cache: '1',
  };

  const first = mockRes();
  await scrapeHandler(makeReq({ query: baseQuery }), first);
  assert.equal(first.statusCode, 200);
  const firstBody = parse(first);
  assert.equal(firstBody.ok, true);
  assert.equal(firstBody.precision.coveragePercent <= 100, true);
  assert.equal(firstBody.chartSeries, undefined, 'scrape-fast não deve calcular chartSeries por padrão');
  assert.ok(firstBody.metrics.handlerTotalMs >= firstBody.metrics.engineTimeMs);
  assert.ok(firstBody.metrics.responseBytes > 0);

  const second = mockRes();
  await scrapeHandler(makeReq({ query: baseQuery }), second);
  assert.equal(second.statusCode, 200);
  assert.equal(second.headers['x-valorae-cache'], 'RESULT_RESPONSE_HIT');
  assert.equal(parse(second).cache, 'RESULT_HIT');
  assert.equal(calls, 1, 'cache serializado deve evitar novo fetch');

  const fieldVariant = mockRes();
  await scrapeHandler(makeReq({ query: { ...baseQuery, fields: 'results' } }), fieldVariant);
  assert.equal(fieldVariant.statusCode, 200);
  assert.equal(calls, 2, 'fields diferente deve usar chave de cache diferente');

  clearScrapeResultCache();
  calls = 0;
  const concurrent = await Promise.all(Array.from({ length: 25 }, async () => {
    const res = mockRes();
    await scrapeHandler(makeReq({ query: baseQuery }), res);
    return parse(res);
  }));
  assert.equal(concurrent.every(x => x.ok === true), true, 'concorrência deve retornar ok=true em todos');
  assert.equal(calls, 1, '25 chamadas simultâneas iguais devem coalescer fetch real');

  clearScrapeResultCache();
  calls = 0;
  const jobs = Array.from({ length: 20 }, (_, i) => ({ id: `job-${i}`, url: 'https://investidor10.com.br/acoes/petr4/', selectors: { title: 'h1' } }));
  const batchInput = { jobs, batchProfile: 'fast', cache: '1', concurrency: 4 };
  const coldBatch = mockRes();
  await batchScrapeHandler(makeReq({ method: 'POST', url: '/api/batch-scrape', body: batchInput }), coldBatch);
  const cold = parse(coldBatch);
  assert.equal(cold.logical.inputCount, 20);
  assert.equal(cold.logical.uniqueRequestKeys, 1);
  assert.equal(cold.logical.dedupedCount, 19);
  assert.equal(cold.execution.networkFetches, 1);
  assert.equal(cold.results.length, 20);

  const hotBatch = mockRes();
  await batchScrapeHandler(makeReq({ method: 'POST', url: '/api/batch-scrape', body: batchInput }), hotBatch);
  const hot = parse(hotBatch);
  assert.equal(hot.logical.inputCount, 20);
  assert.equal(hot.logical.uniqueRequestKeys, 1);
  assert.equal(hot.logical.dedupedCount, 19);
  assert.equal(hot.execution.resultCacheHits, 20);
  assert.equal(hot.execution.networkFetches, 0);
} finally {
  ValoraeEngine.scrapeUrl = original;
  clearScrapeResultCache();
}

console.log('post-benchmark-hardening-v21-12-51 OK');
