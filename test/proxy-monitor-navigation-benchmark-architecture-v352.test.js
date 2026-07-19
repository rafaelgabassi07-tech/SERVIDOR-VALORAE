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
  'benchmarkMetrics', 'benchmarkDecisionGrid', 'benchmarkScenarioTabs', 'benchmarkLeaderboard', 'benchmarkTable', 'engineCatalog',
  'architectureMetrics', 'architectureLanes', 'architectureDetail', 'architectureRuntimeFacts', 'architecturePersistenceFacts',
]) assert.ok(html.includes(`id="${id}"`), `elemento ausente: ${id}`);

for (const view of ['live', 'routes', 'health', 'benchmark', 'architecture', 'settings']) {
  assert.ok(html.includes(`data-view="${view}"`), `item de menu ausente: ${view}`);
  assert.ok(html.includes(`data-view-panel="${view}"`), `painel ausente: ${view}`);
}
assert.match(html, /aria-controls="appDrawer"/);
assert.match(html, /aria-expanded="false"/);
assert.match(css, /body\.menu-open \.app-drawer/);
assert.match(css, /\.architecture-map-layout/);
assert.match(css, /\.benchmark-leaderboard/);
assert.match(runtime, /function openMenu\(\)/);
assert.match(runtime, /function closeMenu\(/);
assert.match(runtime, /function renderBenchmark\(\)/);
assert.match(runtime, /function renderBenchmarkLeaderboard\(\)/);
assert.match(runtime, /function setBenchmarkScenario\(/);
assert.match(runtime, /function renderArchitecture\(\)/);
assert.match(runtime, /function renderArchitectureDetail\(/);
assert.match(runtime, /BENCHMARK_DATA_URL/);
assert.match(runtime, /\['live', 'routes', 'health', 'benchmark', 'architecture', 'settings'\]/);
assert.match(runtime, /function renderLive\([\s\S]*?const localSummary = summary;/);
assert.match(runtime, /function renderCapture\([\s\S]*?const localSummary = summary;/);

assert.match(logo, /Símbolo exclusivo do VALORAE Proxy/);
assert.match(logo, /Gateway \/ ponte de dados/);
assert.match(logo, /Rotas do Proxy/);
assert.doesNotMatch(logo, /Identificador do Proxy/);
assert.equal(manifest.icons.length, 3);
assert.ok(manifest.icons.slice(0, 2).every(icon => icon.purpose.includes('maskable')));

const run = benchmark.currentRun;
assert.equal(benchmark.schemaVersion, 2);
assert.equal(benchmark.command, 'npm run benchmark:scraping');
assert.equal(run.rows, 900);
assert.equal(run.iterations, 12);
assert.ok(run.htmlBytes > 250_000);
const engines = Object.fromEntries([...run.complex, ...run.simple, ...(run.browser?.results || [])].map(item => [item.engine, item]));
for (const name of ['parse5-direct-css-select', 'htmlparser2-direct-css-select', 'cheerio-parse5', 'cheerio-htmlparser2', 'valorae-hybrid-adaptive', 'valorae-single-pass-fast', 'playwright-chromium-dom']) {
  assert.ok(engines[name], `motor ausente: ${name}`);
  assert.ok(engines[name].averageMs > 0);
  assert.ok(engines[name].operationsPerSecond > 0);
}
assert.equal(engines['valorae-hybrid-adaptive'].parityWithParse5, true);
assert.equal(engines['valorae-single-pass-fast'].parityWithParse5, true);
assert.equal(engines['playwright-chromium-dom'].parityWithParse5, true);
assert.ok(engines['valorae-hybrid-adaptive'].averageMs < engines['parse5-direct-css-select'].averageMs);
assert.ok(engines['valorae-hybrid-adaptive'].averageMs < engines['cheerio-parse5'].averageMs);
assert.equal(engines['valorae-css-lite-legacy'].parityWithParse5, null, 'caminho parcial não pode ser apresentado como equivalente');
assert.ok(benchmark.methodology.caveat.includes('Microbenchmark'));
assert.ok(benchmark.engineCatalog.some(item => item.id === 'jsdom-reference' && item.status === 'reference'));

console.log('proxy-monitor-navigation-benchmark-architecture-v352 ok');
