import assert from 'node:assert/strict';
import batchScrapeHandler from '../routes/batch-scrape.js';
import { ValoraeEngine } from '../lib/Valorae-engine.js';
import { clearScrapeResultCache } from '../lib/cache/scrape-result-cache.js';

function mockRes() {
  return { statusCode: 200, headers: {}, setHeader(k,v){ this.headers[k.toLowerCase()] = v; }, getHeader(k){ return this.headers[k.toLowerCase()]; }, removeHeader(k){ delete this.headers[k.toLowerCase()]; }, status(c){ this.statusCode = c; return this; }, send(b){ this.body = b; return this; }, end(b=''){ this.body = b; return this; } };
}

clearScrapeResultCache();
let calls = 0;
const original = ValoraeEngine.scrapeUrl;
ValoraeEngine.scrapeUrl = async url => { calls += 1; return { ok: true, status: 200, url, finalUrl: url, hostname: 'investidor10.com.br', contentType: 'text/html', html: '<html><title>A</title></html>', htmlLength: 28, selectorResults: {}, provider: 'DirectFetch', cache: 'MISS', elapsedMs: 1 }; };
try {
  for (let i=0; i<2; i++) {
    const res = mockRes();
    await batchScrapeHandler({ method: 'POST', url: '/api/batch-scrape', query: {}, body: { jobs: [ { id: 'a', url: 'https://investidor10.com.br/acoes/petr4/', selectors: { title: 'title' } } ] }, headers: {}, socket: {} }, res);
    assert.equal(res.statusCode, 200);
  }
  assert.equal(calls, 1);
} finally { ValoraeEngine.scrapeUrl = original; clearScrapeResultCache(); }
console.log('batch result cache tests OK.');
