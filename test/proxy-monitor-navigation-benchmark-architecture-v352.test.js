import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const serverHtml = fs.readFileSync(new URL('../public/server.html', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../public/monitor-valorae.css', import.meta.url), 'utf8');
const runtime = fs.readFileSync(new URL('../public/monitor-valorae.js', import.meta.url), 'utf8');
const logo = fs.readFileSync(new URL('../public/assets/valorae-logo.svg', import.meta.url), 'utf8');
const benchmark = JSON.parse(fs.readFileSync(new URL('../public/assets/valorae-monitor-benchmarks.json', import.meta.url), 'utf8'));
const manifest = JSON.parse(fs.readFileSync(new URL('../public/manifest.webmanifest', import.meta.url), 'utf8'));

assert.equal(html, serverHtml, 'index e server devem continuar idênticos');
assert.doesNotThrow(() => new vm.Script(runtime, { filename: 'monitor-valorae.js' }));

for (const id of [
  'menuButton', 'menuBackdrop', 'appDrawer', 'menuCloseButton', 'currentPageLabel',
  'view-live', 'view-routes', 'view-health', 'view-benchmark', 'view-architecture', 'view-settings',
  'benchmarkMetrics', 'complexBenchmarkBars', 'simpleBenchmarkBars', 'benchmarkTable',
  'architectureMetrics', 'architectureRuntimeFacts', 'architecturePersistenceFacts',
]) assert.ok(html.includes(`id="${id}"`), `elemento ausente: ${id}`);

for (const view of ['live', 'routes', 'health', 'benchmark', 'architecture', 'settings']) {
  assert.ok(html.includes(`data-view="${view}"`), `item de menu ausente: ${view}`);
  assert.ok(html.includes(`data-view-panel="${view}"`), `painel ausente: ${view}`);
}
assert.match(html, /aria-controls="appDrawer"/);
assert.match(html, /aria-expanded="false"/);
assert.match(css, /body\.menu-open \.app-drawer/);
assert.match(css, /\.architecture-flow/);
assert.match(css, /\.benchmark-bars/);
assert.match(runtime, /function openMenu\(\)/);
assert.match(runtime, /function closeMenu\(/);
assert.match(runtime, /function renderBenchmark\(\)/);
assert.match(runtime, /function renderArchitecture\(\)/);
assert.match(runtime, /BENCHMARK_DATA_URL/);
assert.match(runtime, /\['live', 'routes', 'health', 'benchmark', 'architecture', 'settings'\]/);
assert.match(runtime, /function renderLive\([\s\S]*?const localSummary = summary;/);
assert.match(runtime, /function renderCapture\([\s\S]*?const localSummary = summary;/);

// O núcleo da marca deve replicar os quatro paths do launcher Android.
for (const path of [
  'M45 58h35v14H45z',
  'M54 18h16l24 64H78z',
  'M30 82h16l24-64H54z',
  'M6 18h16l24 64H30z',
]) assert.ok(logo.includes(path), `path da marca APK ausente: ${path}`);
assert.match(logo, /Identificador do Proxy/);
assert.match(logo, /#FFC107/);
assert.equal(manifest.icons.length, 2);
assert.ok(manifest.icons.every(icon => icon.purpose.includes('maskable')));

const run = benchmark.currentRun;
assert.equal(benchmark.command, 'node --expose-gc scripts/benchmark-scraping-engines.js --quick');
assert.equal(run.rows, 900);
assert.equal(run.iterations, 12);
assert.ok(run.htmlBytes > 250_000);
const engines = Object.fromEntries([...run.complex, ...run.simple].map(item => [item.engine, item]));
for (const name of ['cheerio-parse5', 'cheerio-htmlparser2', 'valorae-hybrid-adaptive', 'valorae-single-pass-fast']) {
  assert.ok(engines[name], `motor ausente: ${name}`);
  assert.ok(engines[name].averageMs > 0);
  assert.ok(engines[name].operationsPerSecond > 0);
}
assert.equal(engines['valorae-hybrid-adaptive'].parityWithParse5, true);
assert.ok(engines['valorae-hybrid-adaptive'].averageMs < engines['cheerio-parse5'].averageMs);
assert.ok(engines['valorae-hybrid-adaptive'].averageMs < engines['cheerio-htmlparser2'].averageMs);
assert.equal(engines['valorae-css-lite-legacy'].parityWithParse5, null, 'caminho parcial não pode ser apresentado como equivalente');
assert.ok(benchmark.methodology.caveat.includes('Microbenchmark'));

console.log('proxy-monitor-navigation-benchmark-architecture-v352 ok');
