import fs from 'node:fs';
import assert from 'node:assert/strict';

const required = [
  'lib/scrape/scrape-input.js',
  'lib/cache/scrape-result-cache.js',
  'lib/scrape/fast-selectors.js',
  'lib/performance/scrape-metrics.js',
  'lib/resilience/inflight.js',
  'lib/http/response-shape.js',
  'scripts/benchmark-scrape.js',
];
for (const file of required) assert.ok(fs.existsSync(file), `${file} ausente`);
const scrape = fs.readFileSync('routes/scrape.js', 'utf8');
assert.ok(scrape.includes('RESULT_HIT'), 'routes/scrape.js precisa usar cache final');
assert.ok(scrape.includes('extractFastSelectors'), 'routes/scrape.js precisa usar fast selectors');
const batch = fs.readFileSync('routes/batch-scrape.js', 'utf8');
assert.ok(batch.includes('buildFetchKey'), 'batch precisa separar fetchKey');
assert.ok(batch.includes('batchMetrics'), 'batch precisa expor métricas de coalescing');
const engine = fs.readFileSync('lib/Valorae-engine.js', 'utf8');
assert.ok(engine.includes('buildHtmlCacheKey'), 'Engine precisa usar cache HTML seguro');
assert.ok(engine.includes('STALE_HIT'), 'Engine precisa contemplar stale hit seguro');
console.log('Scrape optimization audit v21.11.4 OK.');
