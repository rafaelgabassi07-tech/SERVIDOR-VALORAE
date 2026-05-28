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
ValoraeEngine.scrapeUrl = async url => { calls += 1; return { ok: true, status: 200, url, finalUrl: url, hostname: 'investidor10.com.br', contentType: 'text/html', html: '<html><title>A</title><body><span class="price">R$ 1</span><span class="dy">10%</span></body></html>', htmlLength: 95, selectorResults: {}, provider: 'DirectFetch', cache: 'MISS', elapsedMs: 1 }; };
try {
  const res = mockRes();
  await batchScrapeHandler({ method: 'POST', url: '/api/batch-scrape', query: {}, body: { jobs: [
    { id: 'a', url: 'https://investidor10.com.br/acoes/petr4/', selectors: { price: '.price' } },
    { id: 'b', url: 'https://investidor10.com.br/acoes/petr4/', selectors: { dy: '.dy' } },
  ] }, headers: {}, socket: {} }, res);
  const json = JSON.parse(res.body);
  assert.equal(calls, 1);
  assert.equal(json.batchMetrics.fetchGroups, 1);
  assert.equal(json.batchMetrics.resultGroups, 2);
  assert.equal(json.networkFetches, 1);
} finally { ValoraeEngine.scrapeUrl = original; clearScrapeResultCache(); }
console.log('batch fetch grouping tests OK.');
