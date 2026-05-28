import assert from 'node:assert/strict';
import { buildHtmlCacheKey } from '../lib/scrape/scrape-input.js';
const url = 'https://investidor10.com.br/acoes/petr4/';
assert.notEqual(buildHtmlCacheKey(url, { maxChars: 10000, provider: 'direct' }), buildHtmlCacheKey(url, { maxChars: 3200000, provider: 'direct' }));
assert.notEqual(buildHtmlCacheKey(url, { maxChars: 10000, provider: 'direct' }), buildHtmlCacheKey(url, { maxChars: 10000, provider: 'valorae-scrape' }));
assert.equal(buildHtmlCacheKey(`${url}#frag`, { maxChars: 10000, provider: 'direct' }), buildHtmlCacheKey(url, { maxChars: 10000, provider: 'direct' }));
console.log('scrape html cache key tests OK.');
