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
const jsonReq = { method: 'GET', url: '/api/v1/monitor-capture-missing-route', headers: { 'x-request-id': 'capture-json-v313' } };
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

console.log('proxy-monitor-central-capture-v313 ok');
