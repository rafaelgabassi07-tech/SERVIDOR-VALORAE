import assert from 'node:assert/strict';
import fs from 'node:fs';
import { routeManifest, _test } from '../routes/_router.js';

assert.ok(routeManifest().routes.includes('/news/article'));
assert.deepEqual(_test.routeMethods('/news/article'), ['POST']);
const source=fs.readFileSync(new URL('../lib/sources/news.js', import.meta.url),'utf8');
assert.match(source, /export async function getArticleContent/);
assert.match(source, /fetchAllowedScrapeText/);
assert.match(source, /allowedHosts:\s*\[parsed\.hostname\]/);
assert.match(source, /networkSafetyPolicy/);
console.log('news article proxy v398 OK');
