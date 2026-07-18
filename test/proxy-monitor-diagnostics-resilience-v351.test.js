import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import fs from 'node:fs';
import {
  attachProxyMetricsInterceptor,
  getServerMetricsSnapshot,
  resetServerMetricsForTests,
} from '../lib/observability/server-metrics.js';

function response() {
  const headers = new Map([['content-type', 'application/json; charset=utf-8']]);
  return {
    statusCode: 200,
    writableEnded: false,
    setHeader(name, value) { headers.set(String(name).toLowerCase(), String(value)); },
    getHeader(name) { return headers.get(String(name).toLowerCase()); },
    write() { return true; },
    end() { this.writableEnded = true; return this; },
  };
}

function capture({ route, latencyMs = 50, sourceStatus = 'ok', cacheStatus = 'miss', payload = { ok: true }, status = 200 }) {
  const req = { method: 'GET', url: route, headers: {} };
  const res = response();
  res.statusCode = status;
  res.setHeader('X-Valorae-Source-Status', sourceStatus);
  res.setHeader('X-Valorae-Cache', cacheStatus);
  attachProxyMetricsInterceptor(req, res);
  req.__valoraeMetrics.startedAt = performance.now() - latencyMs;
  const body = JSON.stringify(payload);
  res.end(body);
  return getServerMetricsSnapshot();
}

// Um pico isolado deve ser exibido, mas não deve virar alerta p95 operacional nem degradar o score de dados.
resetServerMetricsForTests();
let snapshot = capture({ route: '/api/v1/slow-single', latencyMs: 9756 });
assert.equal(snapshot.summary.measuredLatencySamples, 1);
assert.equal(snapshot.summary.latencyConfidence, 'low');
assert.equal(snapshot.summary.latencyAlertEligible, false);
assert.equal(snapshot.summary.dataQualityScore, 100, 'latência não pode reduzir qualidade dos dados');
assert.ok(snapshot.insights.some(item => item.title === 'Pico de latência com baixa confiança'));
assert.ok(!snapshot.insights.some(item => item.title === 'Latência p95 elevada'));
assert.ok(snapshot.operations.runbook.some(item => item.action === 'Coletar mais amostras de latência'));

// Parciais precisam ser classificadas por gravidade e pontuadas proporcionalmente.
resetServerMetricsForTests();
capture({
  route: '/api/v1/recovered-partial',
  sourceStatus: 'partial_timeout_fallback',
  cacheStatus: 'stale-hit',
  payload: { partial: true, appResponseIntegrity: { renderSafe: true, cacheSafe: true } },
});
snapshot = capture({
  route: '/api/v1/critical-partial',
  sourceStatus: 'partial',
  cacheStatus: 'miss',
  payload: { partial: true, appResponseIntegrity: { renderSafe: false, cacheSafe: false } },
});
assert.equal(snapshot.summary.partialResponses, 2);
assert.equal(snapshot.summary.partialRecovered, 1);
assert.equal(snapshot.summary.partialCritical, 1);
assert.equal(snapshot.summary.partialDegraded, 0);
assert.equal(snapshot.proxyOutputMonitor.outputFeed.find(e => e.route === '/api/v1/recovered-partial').partial.classification, 'recovered');
assert.equal(snapshot.proxyOutputMonitor.outputFeed.find(e => e.route === '/api/v1/critical-partial').partial.classification, 'critical');
assert.ok(snapshot.summary.dataQualityScore > 40 && snapshot.summary.dataQualityScore < 100);
assert.ok(snapshot.insights.some(item => item.title === 'Respostas parciais críticas'));

// heapUsed/heapTotal pode ser alto mesmo com uso irrelevante do limite real; o alerta deve usar o limite do V8 e persistência temporal.
resetServerMetricsForTests();
snapshot = getServerMetricsSnapshot();
assert.ok(snapshot.summary.heapSizeLimitMb > snapshot.summary.heapTotalMb);
assert.equal(snapshot.summary.heapUsagePercent, snapshot.summary.heapLimitUsagePercent);
assert.equal(snapshot.summary.memoryPressureAlert, false);
assert.ok(!snapshot.operations.runbook.some(item => item.action === 'Investigar pressão sustentada de memória'));

// A análise histórica deve ser reconstruída apenas com eventos persistidos, mesmo após reset da instância.
resetServerMetricsForTests();
const persistedEvents = [
  {
    eventKey: 'persisted:1', at: '2026-07-18T12:00:00.000Z', route: '/api/v1/heavy', method: 'GET', status: 200,
    latencyMs: 3100, bytesOut: 300000, cacheStatus: 'miss', sourceStatus: 'ok', payloadKind: 'asset',
  },
  {
    eventKey: 'persisted:2', at: '2026-07-18T12:01:00.000Z', route: '/api/v1/heavy', method: 'GET', status: 200,
    latencyMs: 4200, bytesOut: 360000, cacheStatus: 'stale-hit', sourceStatus: 'partial_timeout_fallback', payloadKind: 'asset',
    partial: { detected: true, classification: 'recovered', severity: 'info', usable: true, recovered: true, reason: 'timeout_recovered_by_fallback' },
  },
];
snapshot = getServerMetricsSnapshot({
  persistedEvents,
  persistedTotal: 2,
  persistence: { operational: true, active: true, readLimit: 500 },
});
assert.equal(snapshot.summary.responses, 0, 'resumo da instância deve continuar separado');
assert.equal(snapshot.monitorAnalytics.active, true);
assert.equal(snapshot.monitorAnalytics.summary.responses, 2);
assert.equal(snapshot.monitorAnalytics.summary.partialRecovered, 1);
assert.equal(snapshot.monitorAnalytics.routeDetails[0].route, '/api/v1/heavy');
assert.equal(snapshot.monitorAnalytics.routeDetails[0].payloadP95BytesOut, 360000);
assert.equal(snapshot.monitorAnalytics.timeSeries.length, 2);
assert.equal(snapshot.serverless.persistent, true);
assert.match(snapshot.serverless.note, /reconstroem latência, qualidade, parciais, payloads/i);

const frontend = fs.readFileSync(new URL('../public/monitor-valorae.js', import.meta.url), 'utf8');
assert.match(frontend, /monitorAnalytics/);
assert.match(frontend, /Heap \/ limite V8/);
assert.match(frontend, /parcial.*classification/s);
assert.match(frontend, /janela persistida/);

console.log('proxy-monitor-diagnostics-resilience-v351 ok');
