import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const index = fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const server = fs.readFileSync(new URL('../public/server.html', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../public/monitor-valorae.css', import.meta.url), 'utf8');
const runtime = fs.readFileSync(new URL('../public/monitor-valorae.js', import.meta.url), 'utf8');
const worker = fs.readFileSync(new URL('../public/service-worker.js', import.meta.url), 'utf8');
const manifest = JSON.parse(fs.readFileSync(new URL('../public/manifest.webmanifest', import.meta.url), 'utf8'));

assert.equal(index, server, 'index.html e server.html precisam permanecer idênticos');
assert.doesNotThrow(() => new vm.Script(runtime, { filename: 'monitor-valorae.js' }));
assert.doesNotThrow(() => new vm.Script(worker, { filename: 'service-worker.js' }));

const ids = [...index.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
assert.equal(new Set(ids).size, ids.length, 'o monitor não pode conter IDs HTML duplicados');
assert.match(index, /content="valorae-monitor-gateway-experience-v359"/);
assert.match(index, /id="appDrawer"[^>]*role="dialog"[^>]*aria-modal="true"[^>]*inert/);
assert.match(index, /id="monitorMain"[^>]*aria-busy="false"/);
assert.match(index, /id="pauseButton"[^>]*aria-pressed="false"/);
assert.match(index, /class="pause-glyph"/);
assert.match(index, /class="play-glyph"/);
assert.match(index, /id="drawerReleaseLabel">Core v359 · UI v359</);
assert.match(index, /id="feedCount"[^>]*role="status"[^>]*aria-live="polite"/);
assert.match(index, /id="trafficChart"[^>]*role="img"/);
assert.match(index, /id="apiBaseInput"[^>]*autocomplete="url"[^>]*spellcheck="false"/);

for (const view of ['live', 'routes', 'health', 'benchmark', 'architecture', 'settings']) {
  assert.match(index, new RegExp(`id="view-${view}"[^>]*tabindex="-1"`), `painel ${view} deve receber foco programático`);
}
assert.ok([...index.matchAll(/class="table-scroll"[^>]*tabindex="0"/g)].length >= 2, 'tabelas roláveis precisam ser acessíveis pelo teclado');

for (const functionName of [
  'compactRelease', 'normalizeApiBase', 'clearRemoteSnapshot', 'drawerFocusableElements',
  'trapMenuFocus', 'setPauseState', 'csvValue',
]) assert.match(runtime, new RegExp(`function ${functionName}\\(`), `função corretiva ausente: ${functionName}`);

assert.match(runtime, /Tempo limite de 12 s ao consultar as métricas/);
assert.match(runtime, /if \(\/\^\[\\s\]\*\[=\+\\-@\]\/.test\(text\)\) text = `'/, 'exportação CSV deve neutralizar fórmulas');
assert.match(runtime, /renderRouteTable\(monitorAnalytics\(\)\?\.routeDetails \|\| state\.data\?\.routeDetails \|\| \[\]\)/);
assert.match(runtime, /drawer\.inert = false/);
assert.match(runtime, /drawer\.inert = true/);
assert.match(runtime, /\$\('monitorMain'\)\.inert = true/);
assert.match(runtime, /\$\('monitorMain'\)\.inert = false/);
assert.match(runtime, /themeMeta\.content = resolved/);
assert.match(runtime, /document\.execCommand\('copy'\)/);

assert.match(css, /\.metric-item\{[^}]*border:1px solid var\(--line\)/);
assert.match(css, /\.feed-pane,\.event-detail\{[^}]*background:var\(--raised\)/);
assert.match(css, /\.benchmark-table tbody\{display:grid;gap:9px\}/, 'benchmark mobile deve preservar todas as métricas em cartões');
assert.match(css, /\.architecture-lane,\.architecture-lane:first-child\{grid-template-columns:1fr/);
assert.match(css, /@media\(max-width:760px\)/);
assert.match(css, /@media\(max-width:430px\)/);
assert.doesNotMatch(css, /(?:linear|radial|conic)-gradient\s*\(/i);
assert.doesNotMatch(css, /box-shadow\s*:/i);
assert.doesNotMatch(css, /backdrop-filter\s*:/i);

for (const eventName of ['install', 'activate', 'fetch']) {
  assert.match(worker, new RegExp(`self\\.addEventListener\\('${eventName}'`), `service worker deve tratar ${eventName}`);
}
assert.match(worker, /url\.pathname\.startsWith\('\/api\/'\)/, 'service worker nunca deve armazenar respostas da API');
assert.match(worker, /caches\.match\('\/server\.html'\)/);
assert.equal(manifest.background_color, '#070B0F');
assert.equal(manifest.theme_color, '#091016');

console.log('proxy-monitor-visual-audit-v353 ok');
