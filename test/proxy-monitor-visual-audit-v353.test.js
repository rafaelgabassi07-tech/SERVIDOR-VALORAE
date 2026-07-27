import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const index = fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const server = fs.readFileSync(new URL('../public/server.html', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../public/monitor-valorae.css', import.meta.url), 'utf8');
const runtime = fs.readFileSync(new URL('../public/monitor-valorae.js', import.meta.url), 'utf8');
const worker = fs.readFileSync(new URL('../public/service-worker.js', import.meta.url), 'utf8');
const manifest = JSON.parse(fs.readFileSync(new URL('../public/manifest.webmanifest', import.meta.url), 'utf8'));

assert.equal(index, server);
assert.doesNotThrow(() => new vm.Script(runtime));
assert.doesNotThrow(() => new vm.Script(worker));
const ids = [...index.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
assert.equal(new Set(ids).size, ids.length, 'IDs HTML devem ser únicos');
assert.match(index, /valorae-monitor-material3-polish-v367/);
assert.match(index, /id="appSidebar"[^>]*aria-label="Navegação principal"/);
assert.match(index, /id="monitorMain"[^>]*aria-busy="false"/);
assert.match(index, /id="pauseButton"[^>]*aria-pressed="false"/);
for (const view of ['overview','traffic','request','routes','sources','health','diagnostics','architecture','benchmark','settings']) {
  assert.match(index, new RegExp(`id="view-${view}"[^>]*tabindex="-1"`), `página ${view} sem foco programático`);
}
for (const route of ['/monitor/traffic','/monitor/routes','/monitor/sources','/monitor/health','/monitor/diagnostics','/monitor/architecture','/monitor/benchmark','/monitor/settings']) {
  assert.ok(index.includes(`href="${route}"`), `navegação ausente: ${route}`);
}
assert.match(index, /id="trafficChart"[^>]*role="img"/);
assert.match(index, /class="table-scroll"[^>]*tabindex="0"/);
assert.match(runtime, /Tempo limite de 12 s/);
assert.match(runtime, /history\[replace\?'replaceState':'pushState'\]/);
assert.match(runtime, /path\.startsWith\('\/monitor\/requests'\)/);
assert.ok(runtime.includes("if(/^[\\s]*[=+\\-@]/.test(text))text=`'"), 'exportação CSV deve neutralizar fórmulas');
assert.match(css, /\.sidebar\{/);
assert.match(css, /\.monitor-main\{/);
assert.match(css, /\.view\[hidden\]\{display:none!important\}/);
assert.doesNotMatch(css, /(?:linear|radial|conic)-gradient\s*\(/i);
assert.doesNotMatch(css, /box-shadow\s*:/i);
assert.doesNotMatch(css, /backdrop-filter\s*:/i);
for (const eventName of ['install','activate','fetch']) assert.match(worker, new RegExp(`self\\.addEventListener\\('${eventName}'`));
assert.match(worker, /ui-v367/);
assert.match(worker, /url\.pathname\.startsWith\('\/api\/'\)/);
assert.match(worker, /caches\.match\('\/server\.html'\)/);
assert.equal(manifest.start_url, '/monitor');
assert.equal(manifest.id, '/monitor');
assert.equal(manifest.version, '21.12.395');
assert.equal(manifest.monitor_version, 'v367');

console.log('proxy-monitor-visual-audit-v366 ok');
