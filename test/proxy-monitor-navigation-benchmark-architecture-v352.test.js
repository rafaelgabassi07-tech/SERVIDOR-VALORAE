import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const server = fs.readFileSync(new URL('../public/server.html', import.meta.url), 'utf8');
const runtime = fs.readFileSync(new URL('../public/monitor-valorae.js', import.meta.url), 'utf8');
const benchmark = JSON.parse(fs.readFileSync(new URL('../public/assets/valorae-monitor-benchmarks.json', import.meta.url), 'utf8'));
const manifest = JSON.parse(fs.readFileSync(new URL('../public/manifest.webmanifest', import.meta.url), 'utf8'));

assert.equal(html, server);
assert.doesNotThrow(() => new vm.Script(runtime));
for (const view of ['overview','traffic','routes','sources','health','diagnostics','architecture','benchmark','settings']) {
  assert.ok(html.includes(`data-nav="${view}"`), `menu ausente: ${view}`);
  assert.ok(html.includes(`data-view-panel="${view}"`), `página ausente: ${view}`);
}
assert.match(html, /data-view-panel="request"/);
for (const id of ['benchmarkMetrics','benchmarkScenarioTabs','benchmarkLeaderboard','benchmarkFacts','architectureMetrics','architectureFlow','architectureControls','architectureContracts']) assert.ok(html.includes(`id="${id}"`), `elemento ausente: ${id}`);
assert.equal((html.match(/data-benchmark-scenario=/g) || []).length, 3);
assert.match(runtime, /benchmarkScenario: 'complex'/);
assert.match(runtime, /function renderBenchmark\(\)/);
assert.match(runtime, /function renderArchitecture\(\)/);
assert.match(runtime, /BENCHMARK_URL/);
assert.equal(manifest.icons.length, 3);
assert.ok(manifest.icons.slice(0, 2).every(icon => icon.purpose.includes('maskable')));

const run = benchmark.currentRun;
assert.equal(benchmark.schemaVersion, 2);
assert.equal(benchmark.command, 'npm run benchmark:scraping');
assert.equal(run.rows, 900);
assert.equal(run.iterations, 12);
const engines = Object.fromEntries([...run.complex, ...run.simple, ...(run.browser?.results || [])].map(item => [item.engine, item]));
for (const name of ['parse5-direct-css-select','htmlparser2-direct-css-select','cheerio-parse5','cheerio-htmlparser2','valorae-hybrid-adaptive','valorae-single-pass-fast','playwright-chromium-dom']) {
  assert.ok(engines[name], `motor ausente: ${name}`);
  assert.ok(engines[name].averageMs > 0);
}
assert.equal(engines['valorae-hybrid-adaptive'].parityWithParse5, true);
assert.equal(engines['valorae-single-pass-fast'].parityWithParse5, true);
assert.equal(engines['playwright-chromium-dom'].parityWithParse5, true);
assert.ok(benchmark.methodology.caveat.includes('Microbenchmark'));

console.log('proxy-monitor-navigation-benchmark-architecture-v364 ok');
