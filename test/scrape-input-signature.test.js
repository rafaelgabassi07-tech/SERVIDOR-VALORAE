import assert from 'node:assert/strict';
import { normalizeScrapeInput, buildFetchKey, buildResultKey, buildHtmlCacheKey } from '../lib/scrape/scrape-input.js';

const a = normalizeScrapeInput({ url: 'https://investidor10.com.br/acoes/petr4/#x', selectors: { b: '.price', a: 'title' }, includeHtml: 0 });
const b = normalizeScrapeInput({ url: 'https://investidor10.com.br/acoes/petr4/', selectors: { a: 'title', b: '.price' }, includeHtml: false });
assert.equal(a.url, b.url);
assert.equal(buildResultKey(a), buildResultKey(b));

const c = normalizeScrapeInput({ ...a, includeHtml: true });
assert.notEqual(buildResultKey(a), buildResultKey(c));
assert.equal(buildFetchKey(a), buildFetchKey(c), 'includeHtml não deve quebrar coalescing de fetch quando HTML é buscado uma vez');
assert.notEqual(buildHtmlCacheKey(a.url, { maxChars: 10000 }), buildHtmlCacheKey(a.url, { maxChars: 3200000 }));

console.log('scrape input signature tests OK.');
