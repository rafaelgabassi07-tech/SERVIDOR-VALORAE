import assert from 'node:assert/strict';
import fs from 'node:fs';

const requiredFiles = [
  'lib/normalizers/numbers.js',
  'lib/resilience/engine-policy.js',
  'lib/resilience/failure-cache.js',
  'lib/quality/chart-series.js',
  'test/engine-performance-precision-v21-11-2.test.js',
];
for (const file of requiredFiles) assert.ok(fs.existsSync(file), `${file} ausente`);
const engine = fs.readFileSync('lib/Valorae-engine.js', 'utf8');
assert.match(engine, /21\.12\.0/);
assert.match(engine, /buildEngineProviderPlan/);
assert.match(engine, /getFailureCache/);
assert.match(engine, /numberNormalizerStats/);
const server = fs.readFileSync('public/server.html', 'utf8');
assert.match(server, /Engine Core/);
const sw = fs.readFileSync('public/service-worker.js', 'utf8');
assert.match(sw, /url\.pathname\.startsWith\('\/api'\)/);
console.log('audit engine performance v21.12.0 OK');
