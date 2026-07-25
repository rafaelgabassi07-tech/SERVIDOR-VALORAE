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
assert.match(index, /valorae-monitor-professional-v364/);
assert.match(index, /Core v362 · Monitor v364/);
assert.equal((index.match(/data-benchmark-scenario=/g) || []).length, 3);
for (const id of ['benchmarkScenarioTitle','benchmarkScenarioDescription','benchmarkMetrics','benchmarkLeaderboard','benchmarkFacts','architectureFlow','architectureControls','architectureContracts']) assert.match(index, new RegExp(`id="${id}"`));
assert.match(runtime, /benchmarkScenario: 'complex'/);
assert.match(runtime, /button\.dataset\.benchmarkScenario/);
assert.match(css, /\.benchmark-list/);
assert.match(css, /\.architecture-flow/);
assert.match(worker, /ui-v364/);

assert.equal(benchmark.schemaVersion, 2);
assert.equal(Object.keys(benchmark.scenarios).length, 3);
assert.ok(benchmark.engineCatalog.length >= 10);
const measured = new Set([...benchmark.currentRun.complex,...benchmark.currentRun.simple,...benchmark.currentRun.browser.results].map(item => item.engine));
for (const engine of ['parse5-direct-css-select','htmlparser2-direct-css-select','cheerio-parse5','cheerio-htmlparser2','valorae-hybrid-adaptive','valorae-single-pass-fast','playwright-chromium-dom']) assert.ok(measured.has(engine));
for (const reference of benchmark.engineCatalog.filter(item => item.status === 'reference')) assert.ok(!measured.has(reference.id));
assert.equal(benchmark.currentRun.browser.available, true);
assert.ok(benchmark.currentRun.browser.startupMs > 0);
assert.match(benchmarkScript, /parse5Htmlparser2Adapter/);
assert.match(benchmarkScript, /playwright-core/);
assert.match(benchmarkScript, /browserBenchmark/);

console.log('proxy-monitor-benchmark-architecture-experience-v364 ok');
