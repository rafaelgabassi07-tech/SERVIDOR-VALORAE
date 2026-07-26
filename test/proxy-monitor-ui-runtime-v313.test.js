import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const index = fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const server = fs.readFileSync(new URL('../public/server.html', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../public/monitor-valorae.css', import.meta.url), 'utf8');
const runtime = fs.readFileSync(new URL('../public/monitor-valorae.js', import.meta.url), 'utf8');

assert.equal(index, server, 'index.html e server.html precisam permanecer idênticos');
assert.equal([...index.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].length, 0, 'runtime deve ficar separado do HTML');
assert.doesNotThrow(() => new vm.Script(runtime, { filename: 'monitor-valorae.js' }));
assert.match(index, /valorae-monitor-material3-themes-v366/);
assert.match(index, /<title>V-Proxy · Central operacional<\/title>/);
for (const id of [
  'appSidebar', 'monitorMain', 'view-overview', 'view-traffic', 'view-request', 'view-routes',
  'view-sources', 'view-health', 'view-diagnostics', 'view-architecture', 'view-benchmark',
  'view-settings', 'overviewMetrics', 'eventFeed', 'requestPayload', 'routeTable',
  'sourceDistribution', 'trafficChart', 'rawSnapshot', 'apiBaseInput',
]) assert.ok(index.includes(`id="${id}"`), `elemento essencial ausente: ${id}`);
for (const fn of ['renderTraffic', 'renderRequest', 'renderRoutes', 'renderSources', 'renderHealth', 'renderDiagnostics', 'routeFromLocation', 'navigate']) {
  assert.match(runtime, new RegExp(`function ${fn}\\(`), `função ausente: ${fn}`);
}
assert.match(runtime, /apiUrl\('\/api\/server\/metrics'\)/);
assert.match(runtime, /event\.safeQuery/);
assert.match(runtime, /exportEvents\('json'\)/);
assert.match(runtime, /exportEvents\('csv'\)/);
assert.match(runtime, /'syncAction','status','errorCode','retryable'/, 'CSV deve identificar ação e código do sync');
assert.match(runtime, /storage\.get\(STORAGE\.poll, '30000'\)/);
assert.match(runtime, /bounded\(storage\.get\(STORAGE\.poll, '30000'\), 30000, 15000, 120000\)/);
assert.match(css, /@media\(max-width:900px\)/);
assert.match(css, /@media\(max-width:620px\)/);
assert.match(css, /@media\(prefers-reduced-motion:reduce\)/);
assert.doesNotMatch(css, /(?:linear|radial|conic)-gradient\s*\(/i);
assert.doesNotMatch(css, /backdrop-filter\s*:/i);
assert.doesNotMatch(css, /box-shadow\s*:/i);

console.log('proxy-monitor-ui-runtime-v366 ok');
