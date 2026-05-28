import assert from 'node:assert/strict';
import { recordRequestStart, recordResponse, getServerMetricsSnapshot, resetServerMetricsForTests } from '../lib/observability/server-metrics.js';

function mockReq(url = '/api/asset?ticker=PETR4', method = 'GET', headers = {}) {
  return { url, method, headers: { 'user-agent': 'audit-route-slo/1.0', ...headers }, socket: { remoteAddress: '127.0.0.1' } };
}

function mockRes(statusCode = 200) {
  const headers = new Map();
  return {
    statusCode,
    setHeader(k, v) { headers.set(String(k).toLowerCase(), String(v)); },
    getHeader(k) { return headers.get(String(k).toLowerCase()); },
    removeHeader(k) { headers.delete(String(k).toLowerCase()); },
  };
}

resetServerMetricsForTests();

for (let i = 0; i < 5; i += 1) {
  const req = mockReq('/api/server/metrics?ts=' + i);
  const res = mockRes(200);
  req.__valoraeInternalTelemetry = true;
  recordRequestStart(req, { route: '/api/server/metrics' });
  recordResponse(req, res, { ok: true }, { route: '/api/server/metrics', status: 200, responseBytes: 123, internalTelemetry: true });
}

let snapshot = getServerMetricsSnapshot();
assert.equal(snapshot.summary.requests, 0, 'telemetria interna não deve contar como request externo');
assert.equal(snapshot.summary.responses, 0, 'telemetria interna não deve contar como response externo');
assert.equal(snapshot.distributions.status.length, 0, 'status da telemetria não deve aparecer');
assert.equal(snapshot.distributions.cache.length, 0, 'cache unknown da telemetria não deve aparecer');

for (const status of [200, 200, 304, 500]) {
  const req = mockReq('/api/asset?ticker=PETR4');
  const res = mockRes(status);
  recordRequestStart(req, { route: '/api/asset' });
  recordResponse(req, res, { ok: status < 400, cacheStatus: status === 200 ? 'hit' : undefined }, { route: '/api/asset', status, responseBytes: status === 304 ? 0 : 2048, cacheStatus: status === 200 ? 'hit' : undefined });
}

snapshot = getServerMetricsSnapshot();
assert.equal(snapshot.summary.requests, 4, 'requests reais devem ser contados');
assert.equal(snapshot.summary.responses, 4, 'responses reais devem ser contadas');
assert.equal(snapshot.summary.bodylessResponses, 1, '304 deve entrar como resposta sem corpo');
assert.equal(snapshot.summary.telemetrySelfPollingIsolated, true);
assert.equal(snapshot.summary.cacheUnknownFiltered, true);
assert.ok(snapshot.summary.errorBudgetUsedPercent >= 0, 'deve calcular orçamento SLO');
const route = snapshot.routeDetails.find(r => r.route === '/api/asset');
assert.ok(route, 'deve existir detalhe por rota');
assert.equal(route.requests, 4);
assert.equal(route.responses, 4);
assert.ok(route.p95LatencyMs !== undefined, 'deve expor p95 por rota');
assert.equal(route.statusCounts['200'], 2);
assert.equal(route.statusCounts['304'], 1);
assert.equal(route.statusCounts['500'], 1);
assert.ok(snapshot.readiness.some(x => x.name === 'SLO de disponibilidade'), 'readiness deve incluir SLO');
console.log('Route/SLO maturity audit OK.');
