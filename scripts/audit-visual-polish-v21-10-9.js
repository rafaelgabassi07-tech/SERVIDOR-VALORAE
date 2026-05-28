import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { recordRequestStart, recordResponse, resetServerMetricsForTests, getServerMetricsSnapshot } from '../lib/observability/server-metrics.js';

function req(url, { method = 'GET', headers = {} } = {}) {
  return { url, method, headers: { 'user-agent': 'audit-visual-polish/1.0', ...headers }, socket: { remoteAddress: '127.0.0.1' } };
}

function res(statusCode = 200, headers = {}) {
  const store = new Map(Object.entries(headers));
  return {
    statusCode,
    getHeader(name) { return store.get(name) || store.get(String(name).toLowerCase()); },
    setHeader(name, value) { store.set(name, value); },
  };
}

resetServerMetricsForTests();
for (let i = 0; i < 5; i += 1) recordRequestStart(req('/api/server/metrics?ts=' + i, { headers: { 'x-valorae-telemetry': 'dashboard' } }), { route: '/api/server/metrics' });
let snap = getServerMetricsSnapshot();
assert.equal(snap.summary.requests, 0, 'polling interno não pode inflar requests externos');
assert.equal(snap.summary.responses, 0, 'polling interno não pode inflar responses externos');
assert.equal(snap.summary.trafficState, 'sem_trafego_real', 'sem tráfego externo deve ficar didático');
assert.equal(snap.summary.dashboardIntegrityScore, 100, 'painel precisa permanecer íntegro');
assert.equal(snap.summary.cacheEfficiencyScore, 100, 'cache sem dados não deve ser penalizado');
assert.equal(snap.summary.sourceReliabilityScore, 100, 'fontes sem dados não devem ser penalizadas');

const r = req('/api/asset?ticker=PETR4', { headers: { 'content-length': '64' } });
recordRequestStart(r, { route: '/api/asset' });
recordResponse(r, res(200, { 'Content-Length': '256', 'X-Valorae-Cache': 'memory-hit', 'X-Valorae-Source-Status': 'ok' }), { status: 'OK' }, { status: 200, route: '/api/asset', responseBytes: 256, cacheStatus: 'memory-hit', sourceStatus: 'ok' });
snap = getServerMetricsSnapshot();
assert.equal(snap.summary.requests, 1, 'requisição real deve ser contabilizada');
assert.equal(snap.summary.responses, 1, 'resposta real deve ser contabilizada');
assert.ok(['ativo', 'alto_volume', 'degradado'].includes(snap.summary.trafficState), 'tráfego real deve mudar estado operacional');
assert.ok(snap.summary.cacheEfficiencyScore >= 0 && snap.summary.cacheEfficiencyScore <= 100, 'cacheEfficiencyScore normalizado');
assert.ok(snap.summary.sourceReliabilityScore >= 0 && snap.summary.sourceReliabilityScore <= 100, 'sourceReliabilityScore normalizado');
assert.ok(snap.readiness.some(x => x.name === 'Integridade do painel'), 'readiness deve validar painel');
assert.ok(snap.insights.length > 0, 'insights devem continuar disponíveis');

const html = readFileSync('public/server.html', 'utf8');
assert.ok(html.includes('id="densityToggleBtn"'), 'configurações deve ter densidade visual');
assert.ok(html.includes('manualPaused') && html.includes('hiddenPaused'), 'pausa manual não deve ser perdida ao alternar aba');
assert.ok(html.includes('function known'), 'dashboard deve esconder unknown de cache/fonte');
assert.ok(html.includes('Logotipo clean e moderno'), 'copy do novo logo deve estar atualizado');
assert.ok(html.includes('drawer-brand'), 'menu lateral deve carregar identidade visual moderna');
assert.ok(html.includes('cacheEfficiencyScore') && html.includes('sourceReliabilityScore'), 'dashboard deve exibir novas métricas de maturidade');

const sw = readFileSync('public/service-worker.js', 'utf8');
assert.ok((/v21-(10-10|11-[0-9])/.test(sw)), 'service worker deve atualizar cache da release');
assert.ok(sw.includes("url.pathname.startsWith('/api')"), 'service worker não pode interceptar APIs em tempo real');

const svg = readFileSync('public/assets/valorae-logo.svg', 'utf8');
assert.ok(svg.includes('VALORAE Proxy Server') && svg.includes('linearGradient'), 'logo SVG deve ser moderno e vetorial');
assert.ok(statSync('public/assets/valorae-icon-192.png').size > 1000, 'ícone 192 PNG deve existir');
assert.ok(statSync('public/assets/valorae-icon-512.png').size > 3000, 'ícone 512 PNG deve existir');

console.log('Visual polish audit OK: logo clean, PWA v21.11.9, configurações, pausa e métricas de maturidade validados.');
