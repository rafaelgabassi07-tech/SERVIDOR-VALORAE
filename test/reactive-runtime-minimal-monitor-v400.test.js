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
assert.ok(index.includes('somente quando o aplicativo solicita'));
assert.ok(index.includes('Superfície de produção alinhada ao APK'));
assert.ok(index.includes('/api/v1/asset/modal'));
assert.ok(index.includes('Notificações e segundo plano'));
assert.ok(index.includes('Autenticação e dados financeiros em nuvem'));
assert.ok(index.includes('monitor.css'));
assert.ok(index.includes('vertical-flow-shell'), 'fluxo vertical completo deve existir diretamente no HTML');
assert.ok(!index.includes('<script '), 'monitor estático não deve carregar JavaScript');
assert.ok(index.includes("script-src 'none'"), 'CSP deve bloquear scripts no monitor estático');
assert.ok(index.includes("connect-src 'none'"), 'CSP deve impedir chamadas de rede pela documentação');
for (const forbidden of ['fetch(', 'XMLHttpRequest', 'EventSource', 'WebSocket', 'setInterval', 'onclick=', 'onload=', '<script>']) {
  assert.ok(!index.includes(forbidden), `documentação não deve conter comunicação ou script inline: ${forbidden}`);
}
assert.ok(css.length < 16_000, 'CSS base do monitor deve permanecer controlado');
for (const cardPattern of ['box-shadow:', '.card{', '.panel{', 'section{background:', 'section{border-radius:']) {
  assert.ok(!css.includes(cardPattern), `página informativa não deve voltar a usar containers: ${cardPattern}`);
}
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
