import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read = relative => fs.readFileSync(new URL(`../${relative}`, import.meta.url), 'utf8');
const index = read('public/index.html');
const server = read('public/server.html');
const css = read('public/monitor-valorae.css');
const runtime = read('public/monitor-valorae.js');
const worker = read('public/service-worker.js');
const benchmarkScript = read('scripts/benchmark-scraping-engines.js');
const benchmark = JSON.parse(read('public/assets/valorae-monitor-benchmarks.json'));

assert.equal(index, server);
assert.doesNotThrow(() => new vm.Script(runtime));
assert.match(index, /valorae-monitor-proxy-experience-v356/);
assert.match(index, /Core v350 · UI v356/);
assert.equal((index.match(/data-benchmark-scenario=/g) || []).length, 3);
assert.equal((index.match(/data-architecture-node=/g) || []).length, 9);
for (const id of ['benchmarkDecisionGrid', 'benchmarkScenarioIntro', 'benchmarkLeaderboard', 'engineCatalog', 'architectureLanes', 'architectureDetail']) {
  assert.match(index, new RegExp(`id="${id}"`));
}
assert.match(runtime, /benchmarkScenario: 'complex'/);
assert.match(runtime, /ARCHITECTURE_NODE_DETAILS/);
assert.match(runtime, /setBenchmarkScenario\(button\.dataset\.benchmarkScenario\)/);
assert.match(runtime, /renderArchitectureDetail\(button\.dataset\.architectureNode\)/);
assert.match(css, /\.benchmark-decision-grid/);
assert.match(css, /\.benchmark-rank-row/);
assert.match(css, /\.engine-tile-grid/);
assert.match(css, /\.architecture-lanes/);
assert.match(css, /\.architecture-detail/);
assert.match(worker, /ui-v356/);

assert.equal(benchmark.schemaVersion, 2);
assert.equal(Object.keys(benchmark.scenarios).length, 3);
assert.ok(benchmark.engineCatalog.length >= 10);
const measured = new Set([
  ...benchmark.currentRun.complex,
  ...benchmark.currentRun.simple,
  ...benchmark.currentRun.browser.results,
].map(item => item.engine));
for (const engine of ['parse5-direct-css-select', 'htmlparser2-direct-css-select', 'cheerio-parse5', 'cheerio-htmlparser2', 'valorae-hybrid-adaptive', 'valorae-single-pass-fast', 'playwright-chromium-dom']) assert.ok(measured.has(engine));
for (const reference of benchmark.engineCatalog.filter(item => item.status === 'reference')) assert.ok(!measured.has(reference.id), `referência não pode fingir medição: ${reference.id}`);
assert.equal(benchmark.currentRun.browser.available, true);
assert.ok(benchmark.currentRun.browser.startupMs > 0);
assert.match(benchmarkScript, /parse5Htmlparser2Adapter/);
assert.match(benchmarkScript, /parseDocument/);
assert.match(benchmarkScript, /playwright-core/);
assert.match(benchmarkScript, /browserBenchmark/);

console.log('proxy-monitor-benchmark-architecture-experience-v356 ok');
