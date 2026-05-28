import { EventEmitter } from 'node:events';
import assert from 'node:assert/strict';
import { sendJson } from '../lib/performance/http.js';
import { attachProxyMetricsInterceptor, getServerMetricsSnapshot, resetServerMetricsForTests } from '../lib/observability/server-metrics.js';

function req(url, headers = {}, method = 'GET') {
  return { url, method, headers, socket: { remoteAddress: '127.0.0.1' }, query: {} };
}

class Res extends EventEmitter {
  constructor() {
    super();
    this.statusCode = 200;
    this.headers = new Map();
    this.writableEnded = false;
    this.body = '';
  }
  setHeader(k, v) { this.headers.set(String(k).toLowerCase(), String(v)); }
  getHeader(k) { return this.headers.get(String(k).toLowerCase()); }
  removeHeader(k) { this.headers.delete(String(k).toLowerCase()); }
  status(code) { this.statusCode = code; return this; }
  send(body = '') { this.body = String(body || ''); this.writableEnded = true; this.emit('close'); return this; }
  end(chunk = '') { this.body += String(chunk || ''); this.writableEnded = true; this.emit('close'); return this; }
}

function getDist(name) {
  return new Map((getServerMetricsSnapshot().distributions?.[name] || []).map(x => [String(x.name), x.value]));
}

resetServerMetricsForTests();
for (let i = 0; i < 6; i += 1) {
  const r = req('/api/server/metrics?ts=' + i, { 'user-agent': 'Dashboard' });
  r.__valoraeInternalTelemetry = true;
  const res = new Res();
  sendJson(r, res, getServerMetricsSnapshot(), { status: 200, profile: 'server-metrics', volatileEtag: true });
}
let snap = getServerMetricsSnapshot();
assert.equal(snap.summary.requests, 0, 'telemetria interna não deve somar requests');
assert.equal(snap.summary.responses, 0, 'telemetria interna não deve somar responses');
assert.equal(getDist('status').size, 0, 'telemetria interna não deve entrar em status');
assert.equal(getDist('cache').size, 0, 'telemetria interna não deve entrar em cache');
assert.equal(getDist('source').size, 0, 'telemetria interna não deve entrar em source');

resetServerMetricsForTests();
let r1 = req('/api/health', { 'user-agent': 'Smoke' });
let res1 = new Res();
sendJson(r1, res1, { ok: true, requestId: 'a' }, { status: 200, profile: 'health' });
const etag = res1.getHeader('etag');
assert.ok(etag, 'primeira resposta deve gerar ETag');
let r2 = req('/api/health', { 'if-none-match': etag, 'user-agent': 'Smoke' });
let res2 = new Res();
sendJson(r2, res2, { ok: true, requestId: 'b' }, { status: 200, profile: 'health' });
snap = getServerMetricsSnapshot();
assert.equal(snap.summary.requests, 2, 'duas chamadas reais devem somar requests');
assert.equal(snap.summary.responses, 2, 'duas chamadas reais devem somar responses');
assert.equal(getDist('status').get('200'), 1, 'primeira chamada deve ser 200');
assert.equal(getDist('status').get('304'), 1, 'ETag deve ser medido como 304, não como 200');
assert.equal(res2.statusCode, 304, 'resposta real deve ser 304');

resetServerMetricsForTests();
const r3 = req('/api/asset?ticker=PETR4', { 'user-agent': 'APK' });
const res3 = new Res();
attachProxyMetricsInterceptor(r3, res3, { route: '/api/asset' });
res3.emit('close');
snap = getServerMetricsSnapshot();
assert.equal(snap.summary.requests, 1, 'solicitação abortada deve iniciar métrica');
assert.equal(snap.summary.responses, 1, 'solicitação abortada deve finalizar métrica');
assert.equal(snap.summary.inFlight, 0, 'solicitação abortada não pode ficar em voo');
assert.equal(snap.summary.clientClosed, 1, 'fechamento de cliente deve ser registrado');
assert.equal(getDist('status').get('499'), 1, 'fechamento antes da resposta deve aparecer como 499');

console.log('Metrics integrity audit OK: telemetria isolada, ETag 304 e abortos 499 verificados.');
