import assert from 'node:assert/strict';
import { canUseFastSelectors, extractFastSelectors } from '../lib/scrape/fast-selectors.js';
import { extractCustomSelectors } from '../lib/scrape/custom-selectors.js';

const html = '<html><head><title>VALORAE</title><meta name="description" content="Proxy financeiro"></head><body><h1>Carteira</h1><a href="/x">Link</a><img src="/logo.png"><span class="price">R$ 10,00</span></body></html>';
const selectors = { title: 'title', h1: 'h1', price: '.price', href: { selector: 'a[href]', extract: 'href' }, logo: { selector: 'img[src]', extract: 'src' }, desc: 'meta[name=description]' };
assert.equal(canUseFastSelectors(selectors), true);
const fast = extractFastSelectors(html, selectors);
assert.equal(fast.strategy, 'single-pass');
assert.deepEqual(fast.results.title, ['VALORAE']);
assert.deepEqual(fast.results.price, ['R$ 10,00']);
assert.deepEqual(fast.results.href, ['/x']);
const legacy = extractCustomSelectors(html, { title: 'title', h1: 'h1', price: '.price' });
assert.deepEqual(fast.results.title, legacy.results.title);
assert.deepEqual(fast.results.h1, legacy.results.h1);
assert.deepEqual(fast.results.price, legacy.results.price);
assert.equal(canUseFastSelectors({ complex: 'div > span.price' }), false);
console.log('fast selector tests OK.');
