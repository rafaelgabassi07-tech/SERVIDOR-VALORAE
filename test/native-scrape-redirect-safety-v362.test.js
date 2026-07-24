import assert from 'node:assert/strict';
import fs from 'node:fs';

const router = fs.readFileSync(new URL('../routes/_router.js', import.meta.url), 'utf8');
const engine = fs.readFileSync(new URL('../lib/Valorae-engine.js', import.meta.url), 'utf8');
const fetchSource = fs.readFileSync(new URL('../lib/sources/fetch.js', import.meta.url), 'utf8');
const manifest = JSON.parse(fs.readFileSync(new URL('../contracts/checkpoint126/extraction-intelligence.json', import.meta.url), 'utf8'));

assert.match(router, /fetchAllowedScrapeText\(url,/);
assert.doesNotMatch(router, /fetchText\(url,\s*\{\s*timeoutMs:/);
assert.match(router, /htmlLimit/);
assert.match(router, /networkSafetyPolicy/);
assert.match(engine, /fetchAllowedScrapeText\(url,/);
assert.match(engine, /redirect:\s*'manual'/);
assert.doesNotMatch(engine.slice(engine.indexOf('export async function fetchPublicHtml'), engine.indexOf('export async function fetchPublicHtml') + 8000), /redirect:\s*'follow'/);
assert.match(fetchSource, /redirect = 'follow'/);
assert.match(fetchSource, /location: res\.headers\.get\('location'\)/);
assert.ok(manifest.features.includes('allowlisted-native-scrape-manual-redirect-dns-validation'));
assert.ok(manifest.features.includes('direct-provider-manual-redirect-dns-validation'));

console.log('native-scrape-redirect-safety-v362 ok');
