import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const index = fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const server = fs.readFileSync(new URL('../public/server.html', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../public/monitor-valorae.css', import.meta.url), 'utf8');
const runtime = fs.readFileSync(new URL('../public/monitor-valorae.js', import.meta.url), 'utf8');

assert.equal(index, server, 'index.html e server.html precisam permanecer idênticos');
const inlineScripts = [...index.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].map(match => match[1]);
assert.equal(inlineScripts.length, 0, 'runtime do monitor deve permanecer separado do HTML');
assert.doesNotThrow(() => new vm.Script(runtime, { filename: 'monitor-valorae.js' }));
assert.ok(index.includes('21.12.382-quote-state-resilience-v350'));
assert.ok(index.includes('/monitor-valorae.css'));
assert.ok(index.includes('/monitor-valorae.js'));
for (const id of [
  'view-live', 'liveMetrics', 'captureLine', 'activeRequests', 'eventFeed',
  'eventDetail', 'routeTable', 'sourceDistribution', 'trafficChart',
  'captureFacts', 'runtimeFacts', 'rawSnapshot', 'view-settings',
]) {
  const actualId = id === 'activeRequests' ? 'inflightList' : id;
  assert.ok(index.includes(`id="${actualId}"`), `elemento essencial ausente: ${actualId}`);
}
assert.ok(runtime.includes("apiUrl('/api/server/metrics')"));
assert.ok(runtime.includes('function renderFeed()'));
assert.ok(runtime.includes('function renderRoutes()'));
assert.ok(runtime.includes('function renderHealth()'));
assert.ok(runtime.includes('event.safeQuery'));
assert.ok(runtime.includes("exportEvents('json')"));
assert.ok(runtime.includes("exportEvents('csv')"));
assert.ok(css.includes('--accent:#e8b84f'));
assert.ok(css.includes('--bg:#080808'));
assert.ok(css.includes('@media(max-width:760px)'));
assert.ok(css.includes('@media(max-width:430px)'));
assert.ok(css.includes('@media(prefers-reduced-motion:reduce)'));
assert.doesNotMatch(index, /class="[^"]*\bcard\b/i, 'monitor renovado não deve reintroduzir cards');
assert.doesNotMatch(css, /(?:linear|radial|conic)-gradient\s*\(/i, 'monitor deve permanecer sem gradientes decorativos');
assert.doesNotMatch(css, /backdrop-filter\s*:/i, 'monitor deve permanecer sem vidro/desfoque');
assert.doesNotMatch(css, /box-shadow\s*:/i, 'monitor deve permanecer sem sombras de containers');

console.log('proxy-monitor-ui-runtime-v313 ok');
