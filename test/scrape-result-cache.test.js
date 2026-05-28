import assert from 'node:assert/strict';
import { setScrapeResult, getScrapeResult, shapeScrapeResultCacheHit, clearScrapeResultCache } from '../lib/cache/scrape-result-cache.js';

clearScrapeResultCache();
setScrapeResult('unit:1', { ok: true, requestId: 'old', results: { title: ['A'] }, metrics: { cacheStatus: 'MISS' } });
const cached = getScrapeResult('unit:1');
assert.ok(cached);
assert.equal(cached.requestId, undefined);
const hit = shapeScrapeResultCacheHit(cached, { requestId: 'new', elapsedMs: 1 });
assert.equal(hit.requestId, 'new');
assert.equal(hit.cache, 'RESULT_HIT');
assert.equal(hit.metrics.fetchTimeMs, 0);
assert.equal(hit.results.title[0], 'A');
clearScrapeResultCache();
console.log('scrape result cache tests OK.');
