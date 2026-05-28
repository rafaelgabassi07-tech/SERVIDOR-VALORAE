import { EventEmitter } from 'node:events';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { attachProxyMetricsInterceptor, getServerMetricsSnapshot, resetServerMetricsForTests } from '../lib/observability/server-metrics.js';

function req(url = '/api/asset?ticker=PETR4', method = 'GET', headers = {}) {
  return { url, method, headers: { 'user-agent': 'audit-complete-polish/1.0', ...headers }, socket: { remoteAddress: '127.0.0.1' }, query: {} };
}

class Res extends EventEmitter {
  constructor(statusCode = 200) {
    super();
    this.statusCode = statusCode;
    this.headers = new Map();
    this.writableEnded = false;
    this.body = '';
  }
  setHeader(k, v) { this.headers.set(String(k).toLowerCase(), String(v)); }
  getHeader(k) { return this.headers.get(String(k).toLowerCase()); }
  removeHeader(k) { this.headers.delete(String(k).toLowerCase()); }
  status(code) { this.statusCode = code; return this; }
  send(body = '') { this.body += String(body || ''); this.writableEnded = true; this.emit('close'); return this; }
  end(chunk = '') { this.body += String(chunk || ''); this.writableEnded = true; this.emit('close'); return this; }
}

resetServerMetricsForTests();
const headReq = req('/api/asset?ticker=PETR4', 'HEAD');
const headRes = new Res(200);
attachProxyMetricsInterceptor(headReq, headRes, { route: '/api/asset' });
headRes.end('body-that-must-not-count');
let snap = getServerMetricsSnapshot();
assert.equal(snap.summary.responses, 1, 'HEAD deve finalizar métrica');
assert.equal(snap.summary.bytesOut, 0, 'HEAD não deve contabilizar bytes de corpo');
assert.equal(snap.summary.bodylessResponses, 1, 'HEAD deve ser bodyless');

resetServerMetricsForTests();
const notModifiedReq = req('/api/asset?ticker=PETR4');
const notModifiedRes = new Res(304);
attachProxyMetricsInterceptor(notModifiedReq, notModifiedRes, { route: '/api/asset' });
notModifiedRes.end('ignored-body');
snap = getServerMetricsSnapshot();
assert.equal(snap.summary.bytesOut, 0, '304 não deve contabilizar bytes de corpo');
assert.equal(snap.distributions.status.find(x => x.name === '304')?.value, 1, '304 deve aparecer no status real');

resetServerMetricsForTests();
for (let i = 0; i < 3; i += 1) {
  const r = req('/api/server/metrics?ts=' + i, 'GET', { 'x-valorae-telemetry': 'dashboard' });
  r.__valoraeInternalTelemetry = true;
  const res = new Res(200);
  attachProxyMetricsInterceptor(r, res, { route: '/api/server/metrics' });
  res.end('{"ok":true}');
}
snap = getServerMetricsSnapshot();
assert.equal(snap.summary.requests, 0, 'telemetria do dashboard deve continuar isolada');
assert.equal(snap.summary.responses, 0, 'respostas do dashboard não devem inflar métricas reais');
assert.equal(snap.summary.dataQualityScore, 100, 'sem tráfego real não deve degradar qualidade');
assert.equal(snap.summary.contractScore, 100, 'sem tráfego real não deve degradar contrato');
assert.equal(snap.summary.loadScore, 100, 'sem tráfego real não deve degradar carga');
assert.ok(Array.isArray(snap.anomalies), 'snapshot deve expor anomalias didáticas');

const html = readFileSync('public/server.html', 'utf8');
assert.ok(html.includes('id="page-quality"'), 'dashboard deve incluir página de qualidade');
assert.ok(html.includes('X-Valorae-Telemetry'), 'dashboard deve sinalizar polling interno');
assert.ok(html.includes('id="anomalyChart"'), 'dashboard deve incluir gráfico de anomalias');

const sw = readFileSync('public/service-worker.js', 'utf8');
assert.ok(/v21-(10-(7|8|9|10)|11-[0-9]|12-[0-9])/.test(sw), 'service worker deve trocar cache para a nova versão');
assert.ok(sw.includes("url.pathname.startsWith('/api')"), 'service worker deve ignorar APIs em tempo real');

console.log('Complete polish audit OK.');
