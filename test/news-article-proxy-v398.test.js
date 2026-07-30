import assert from 'node:assert/strict';
import fs from 'node:fs';
import { routeManifest, _test } from '../routes/_router.js';
import { _test as newsTest } from '../lib/sources/news.js';

assert.ok(routeManifest().routes.includes('/news/article'));
assert.deepEqual(_test.routeMethods('/news/article'), ['POST']);
const source=fs.readFileSync(new URL('../lib/sources/news.js', import.meta.url),'utf8');
assert.match(source, /export async function getArticleContent/);
assert.match(source, /fetchAllowedScrapeText/);
assert.match(source, /initialAllowedHosts/);
assert.match(source, /outboundArticleUrlFromHtml/);
assert.equal(newsTest.sourceNameFromUrl('https://www.infomoney.com.br/mercados/x'), 'Infomoney');
assert.equal(newsTest.outboundArticleUrlFromHtml('<a href="https://www.infomoney.com.br/x">Ler</a>', 'https://news.google.com/'), 'https://www.infomoney.com.br/x');
assert.match(source, /networkSafetyPolicy/);
console.log('news article proxy v399 redirect and source-name OK');
