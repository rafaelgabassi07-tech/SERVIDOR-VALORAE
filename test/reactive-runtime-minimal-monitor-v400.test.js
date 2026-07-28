import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const index = read('public/index.html');
const css = read('public/monitor.css');
const router = read('routes/_router.js');
const http = read('lib/core/http.js');
const ignore = read('.vercelignore');

assert.ok(index.includes('VALORAE Proxy'));
assert.ok(index.includes('Serviço sob demanda'));
assert.ok(index.includes('monitor.css'));
for (const forbidden of ['<script', 'fetch(', 'XMLHttpRequest', 'EventSource', 'WebSocket', 'setInterval', 'setTimeout', '/api/']) {
  assert.ok(!index.includes(forbidden), `monitor estático contém ${forbidden}`);
}
assert.ok(css.length < 12_000, 'CSS do monitor deve permanecer pequeno');
for (const removed of ['server.html', 'service-worker.js', 'manifest.webmanifest', 'tests.html', 'inspector.html']) {
  assert.equal(fs.existsSync(path.join(root, 'public', removed)), false, `${removed} não pode voltar ao monitor mínimo`);
}
assert.ok(router.includes('VALORAE_FIELD_OBSERVABILITY_ENABLED'));
assert.ok(router.includes('buildMobileAlertsCached'));
assert.ok(http.includes("const traceId = effectivePayload?.requestId || responseRequestId"));
for (const oldHeader of [
  'X-Valorae-Field-Observability',
  'X-Valorae-Source-Adapters',
  'X-Valorae-Dynamic-Render',
  'X-Valorae-Extraction-Intelligence',
  'X-Valorae-Scraping-Engine',
]) {
  assert.ok(!http.includes(`setHeader('${oldHeader}`), `${oldHeader} não deve ser serializado por resposta`);
}
assert.ok(ignore.includes('contracts/'));
console.log('reactive-runtime-minimal-monitor-v400 ok');
