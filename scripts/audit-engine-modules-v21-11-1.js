import fs from 'node:fs';
import assert from 'node:assert/strict';

const required = [
  ['lib/Valorae-engine.js', 'buildHtmlCacheFamilyKey'],
  ['lib/Valorae-engine.js', 'providerNameForHost'],
  ['lib/Valorae-engine.js', 'htmlFamilyHitRatePercent'],
  ['lib/resilience/circuit-breaker.js', 'score'],
  ['lib/resilience/circuit-breaker.js', 'rolling'],
  ['lib/resilience/error-classifier.js', 'RATE_LIMIT_SIGNAL'],
  ['lib/quality/chart-readiness.js', 'buildChartReadinessReport'],
  ['lib/quality/extraction-precision.js', 'chart-aware'],
  ['public/server.html', 'HTML family hit'],
  ['public/service-worker.js', 'v21-11-4'],
];
for (const [file, needle] of required) {
  const text = fs.readFileSync(file, 'utf8');
  assert.ok(text.includes(needle), `${file} precisa conter ${needle}`);
}
console.log('audit-engine-modules-v21-11-1 OK');
