import assert from 'node:assert/strict';
import { recordRequestStart, recordResponse, resetServerMetricsForTests, getServerMetricsSnapshot } from '../lib/observability/server-metrics.js';

function req(url, { method = 'GET', headers = {} } = {}) {
  return { url, method, headers: { 'user-agent': 'audit-command-center/1.0', ...headers }, socket: { remoteAddress: '127.0.0.1' } };
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

// O painel pode consultar métricas várias vezes sem inflar o tráfego externo.
for (let i = 0; i < 3; i += 1) {
  recordRequestStart(req('/api/server/metrics?ts=' + i), { route: '/api/server/metrics' });
}
let snap = getServerMetricsSnapshot();
assert.equal(snap.summary.requests, 0, 'telemetria interna não pode contar como request externo');
assert.equal(snap.summary.responses, 0, 'telemetria interna não pode contar como response externo');
assert.equal(snap.summary.internalTelemetryRequests, 3, 'leituras internas devem ser separadas');
assert.equal(snap.distributions.routes.length, 0, 'rotas externas não devem incluir /api/server/metrics');
assert.ok(snap.distributions.internalTelemetry.some(x => x.name === '/api/server/metrics'), 'telemetria interna deve ter distribuição própria');

// 304/HEAD-like não tem corpo, mas é sucesso HTTP real.
const r304 = req('/api/health', { headers: { 'content-length': '128' } });
recordRequestStart(r304, { route: '/api/health' });
recordResponse(r304, res(304, { 'Content-Length': '9999' }), { status: 'OK' }, { status: 304, route: '/api/health', responseBytes: 9999 });
snap = getServerMetricsSnapshot();
assert.equal(snap.summary.requests, 1);
assert.equal(snap.summary.responses, 1);
assert.equal(snap.summary.bytesOut, 0, '304 deve contabilizar 0 bytes de saída');
assert.equal(snap.summary.successRatePercent, 100, '304 deve ser tratado como resposta bem-sucedida');
assert.equal(snap.summary.bytesIn, 128, 'content-length de entrada deve ser medido');
assert.equal(snap.routeDetails[0].avgBytesIn, 128, 'rota deve guardar média de entrada');
assert.ok(snap.summary.runtimePressureScore >= 0 && snap.summary.runtimePressureScore <= 100, 'runtimePressureScore precisa estar normalizado');
assert.ok(Array.isArray(snap.operations.runbook) && snap.operations.runbook.length > 0, 'runbook precisa ser gerado');
assert.ok(Array.isArray(snap.operations.slowRoutes), 'operações deve expor rotas lentas');
assert.ok(typeof snap.summary.sloStatus === 'string' && snap.summary.sloStatus.length > 0, 'sloStatus precisa existir');

console.log('Command center audit OK: telemetria isolada, 304 sem corpo, runtime, runbook e SLO validados.');
