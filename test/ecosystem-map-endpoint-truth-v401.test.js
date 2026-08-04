import assert from 'node:assert/strict';
import fs from 'node:fs';

const page = fs.readFileSync('public/index.html', 'utf8');
const sectionStart = page.indexOf('<section id="ecosystem-map"');
const sectionEnd = page.indexOf('<section id="journeys"', sectionStart);
const html = page.slice(sectionStart, sectionEnd);
const router = fs.readFileSync('routes/_router.js', 'utf8');

const documented = [...new Set(html.match(/\/api\/v1\/[a-z0-9_/-]+/gi) || [])].sort();
const allowed = new Set([
  '/api/v1/assets',
  '/api/v1/quotes',
  '/api/v1/asset/quote',
  '/api/v1/asset/history',
  '/api/v1/asset/modal',
  '/api/v1/asset/logo',
  '/api/v1/market/indices',
  '/api/v1/market/rankings',
  '/api/v1/news',
  '/api/v1/news/article',
  '/api/v1/mobile/alerts',
  '/api/v1/mobile/daily-close',
  '/api/v1/dividends/batch',
  '/api/v1/portfolio/equilibrium',
  '/api/v1/portfolio/history',
  '/api/v1/portfolio/returns',
  '/api/v1/sync',
]);

for (const endpoint of documented) {
  assert.ok(allowed.has(endpoint), `endpoint não homologado foi documentado: ${endpoint}`);
  const internal = endpoint.replace('/api/v1', '');
  assert.ok(router.includes(`'${internal}'`) || router.includes(`"${internal}"`), `endpoint não localizado no router: ${endpoint}`);
}

for (const required of allowed) assert.ok(documented.includes(required), `jornada essencial ausente da árvore: ${required}`);
assert.equal(documented.length, 17, `quantidade inesperada de endpoints documentados: ${documented.join(', ')}`);
console.log('ecosystem-map-endpoint-truth-v402 ok');
