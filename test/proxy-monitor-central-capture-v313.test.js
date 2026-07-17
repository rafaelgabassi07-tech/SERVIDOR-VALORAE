import assert from 'node:assert/strict';
import { dispatchRoute } from '../routes/_router.js';
import {
  attachProxyMetricsInterceptor,
  getServerMetricsSnapshot,
  resetServerMetricsForTests,
} from '../lib/observability/server-metrics.js';

function mockResponse() {
  const headers = new Map();
  return {
    statusCode: 200,
    writableEnded: false,
    body: '',
    chunks: [],
    setHeader(name, value) { headers.set(String(name).toLowerCase(), String(value)); },
    getHeader(name) { return headers.get(String(name).toLowerCase()); },
    removeHeader(name) { headers.delete(String(name).toLowerCase()); },
    status(code) { this.statusCode = Number(code); return this; },
    send(value = '') { this.body += Buffer.isBuffer(value) ? value.toString('utf8') : String(value); this.writableEnded = true; return this; },
    write(value = '') { this.chunks.push(value); this.body += Buffer.isBuffer(value) ? value.toString('utf8') : String(value); return true; },
    end(value = '') { this.body += Buffer.isBuffer(value) ? value.toString('utf8') : String(value); this.writableEnded = true; return this; },
    headers,
  };
}

resetServerMetricsForTests();

// JSON/erro emitido pelo roteador deve ser capturado uma única vez por sendJson.
const jsonReq = {
  method: 'GET',
  url: '/api/v1/monitor-capture-missing-route?ticker=PETR4&view=app&range=1y&token=segredo',
  headers: { 'x-request-id': 'capture-json-v313' },
};
const jsonRes = mockResponse();
await dispatchRoute(jsonReq, jsonRes);
assert.equal(jsonRes.statusCode, 404);
let snapshot = getServerMetricsSnapshot();
assert.equal(snapshot.summary.requests, 1);
assert.equal(snapshot.summary.responses, 1);
assert.equal(snapshot.summary.captureGap, 0);
assert.equal(snapshot.summary.captureCompletenessPercent, 100);
assert.equal(snapshot.summary.centralInterceptorInstalled, true);
assert.equal(snapshot.proxyOutputMonitor.outputFeed[0].route, '/api/v1/monitor-capture-missing-route');
assert.equal(snapshot.proxyOutputMonitor.outputFeed[0].interceptor, 'sendJson');
assert.equal(snapshot.proxyOutputMonitor.outputFeed[0].requestId, 'capture-json-v313');
assert.ok(snapshot.proxyOutputMonitor.outputFeed[0].bytesOut > 0);
assert.equal(snapshot.proxyOutputMonitor.outputFeed[0].ticker, 'PETR4');
assert.equal(snapshot.proxyOutputMonitor.outputFeed[0].view, 'app');
assert.deepEqual(snapshot.proxyOutputMonitor.outputFeed[0].safeQuery, { ticker: 'PETR4', view: 'app', range: '1y' });
assert.ok(snapshot.proxyOutputMonitor.outputFeed[0].queryKeys.includes('token'));
assert.equal(snapshot.proxyOutputMonitor.outputFeed[0].safeQuery.token, undefined, 'valor secreto não pode aparecer no monitor');

// Resposta direta/streaming que não usa sendJson também precisa entrar no feed.
const streamReq = { method: 'GET', url: '/api/v1/direct-stream-v313', headers: {} };
const streamRes = mockResponse();
streamRes.setHeader('Content-Type', 'application/json; charset=utf-8');
attachProxyMetricsInterceptor(streamReq, streamRes);
streamRes.write('{"status":"');
streamRes.end('OK","stream":true}');
snapshot = getServerMetricsSnapshot();
const streamed = snapshot.proxyOutputMonitor.outputFeed.find(event => event.route === '/api/v1/direct-stream-v313');
assert.ok(streamed, 'resposta streaming não apareceu no feed');
assert.equal(streamed.interceptor, 'res.write+end');
assert.ok(streamed.bytesOut > 0);
assert.ok(streamed.payloadRoots.includes('stream'));
assert.match(String(streamed.payloadPreview), /\"stream\":true/);

// Entrada em processamento precisa aparecer sem expor valores de query arbitrários.
const activeReq = {
  method: 'POST',
  url: '/api/v1/active-capture-v349?ticker=VALE3&mode=compact&apiKey=nao-expor',
  headers: {
    'content-length': '128',
    'content-type': 'application/json',
    'x-correlation-id': 'active-v349',
    'user-agent': 'okhttp/4.12 Android',
  },
};
const activeRes = mockResponse();
attachProxyMetricsInterceptor(activeReq, activeRes);
snapshot = getServerMetricsSnapshot();
const active = snapshot.activeRequests.find(request => request.route === '/api/v1/active-capture-v349');
assert.ok(active, 'requisição em voo não apareceu no snapshot');
assert.equal(active.bytesIn, 128);
assert.equal(active.requestContentType, 'application/json');
assert.equal(active.requestId, 'active-v349');
assert.equal(active.ticker, 'VALE3');
assert.equal(active.safeQuery.mode, 'compact');
assert.ok(active.queryKeys.includes('apiKey'));
assert.equal(active.safeQuery.apiKey, undefined);
activeRes.end('{"ok":true}');
snapshot = getServerMetricsSnapshot();
const posted = snapshot.proxyOutputMonitor.outputFeed.find(event => event.route === '/api/v1/active-capture-v349');
assert.ok(posted, 'resposta POST não apareceu no feed');
assert.equal(posted.bytesIn, 128);
assert.equal(posted.requestContentType, 'application/json');
assert.equal(posted.requestId, 'active-v349');
assert.equal(snapshot.activeRequests.some(request => request.route === '/api/v1/active-capture-v349'), false);

// HEAD precisa ser contabilizado, mas sem bytes de corpo enviados.
const headReq = { method: 'HEAD', url: '/api/v1/head-capture-v313', headers: {} };
const headRes = mockResponse();
await dispatchRoute(headReq, headRes);
snapshot = getServerMetricsSnapshot();
const head = snapshot.proxyOutputMonitor.outputFeed.find(event => event.route === '/api/v1/head-capture-v313');
assert.ok(head, 'HEAD não apareceu no feed');
assert.equal(head.method, 'HEAD');
assert.equal(head.bytesOut, 0);
assert.equal(snapshot.summary.headResponses, 1);
assert.ok(snapshot.summary.bodylessResponses >= 1);

// Preflight CORS também atravessa o interceptador central.
const optionsReq = { method: 'OPTIONS', url: '/api/v1/options-capture-v313', headers: { origin: 'https://app.valorae.test' } };
const optionsRes = mockResponse();
await dispatchRoute(optionsReq, optionsRes);
snapshot = getServerMetricsSnapshot();
const optionsEvent = snapshot.proxyOutputMonitor.outputFeed.find(event => event.route === '/api/v1/options-capture-v313');
assert.ok(optionsEvent, 'OPTIONS não apareceu no feed');
assert.equal(optionsEvent.method, 'OPTIONS');
assert.equal(optionsEvent.interceptor, 'res.end');
assert.equal(snapshot.summary.optionsPreflight, 1);

// Polling administrativo continua isolado para não gerar recursão no próprio painel.
const beforeExternal = snapshot.summary.requests;
const internalReq = { method: 'GET', url: '/api/server/metrics', headers: {} };
const internalRes = mockResponse();
attachProxyMetricsInterceptor(internalReq, internalRes);
internalRes.end('{"ok":true}');
snapshot = getServerMetricsSnapshot();
assert.equal(snapshot.summary.requests, beforeExternal);
assert.equal(snapshot.summary.internalTelemetryRequests, 1);
assert.equal(snapshot.summary.captureGap, 0);
assert.equal(snapshot.proxyOutputMonitor.totals.captureHealth, 'complete');
assert.equal(snapshot.proxyOutputMonitor.totals.centralInterceptorInstalled, true);
assert.ok(snapshot.distributions.interceptors.some(item => item.name === 'sendJson'));
assert.ok(snapshot.distributions.interceptors.some(item => item.name === 'res.write+end'));

// Rotas operacionais chamadas por um consumidor real também precisam aparecer.
const readyReq = { method: 'GET', url: '/api/v1/ready', headers: { 'x-valorae-app': 'VALORAE APK' } };
const readyRes = mockResponse();
await dispatchRoute(readyReq, readyRes);
snapshot = getServerMetricsSnapshot();
const readyEvent = snapshot.proxyOutputMonitor.outputFeed.find(event => event.route === '/api/v1/ready');
assert.ok(readyEvent, 'chamada externa a /ready não apareceu no feed');
assert.equal(readyEvent.appName, 'VALORAE APK');
assert.equal(readyEvent.payloadPreview, undefined, 'diagnóstico operacional não deve replicar payload sensível');

// A mesma rota usada por um probe identificado continua isolada dos totais externos.
const beforeProbe = snapshot.summary.requests;
const probeReq = { method: 'GET', url: '/api/v1/ready', headers: { 'x-valorae-telemetry': 'probe' } };
const probeRes = mockResponse();
await dispatchRoute(probeReq, probeRes);
snapshot = getServerMetricsSnapshot();
assert.equal(snapshot.summary.requests, beforeProbe);
assert.equal(snapshot.summary.internalTelemetryRequests, 2);

console.log('proxy-monitor-central-capture-v313 ok');
