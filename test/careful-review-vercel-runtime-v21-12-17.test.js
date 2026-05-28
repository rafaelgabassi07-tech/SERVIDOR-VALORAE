import assert from 'node:assert/strict';
import fs from 'node:fs';
import { resetServerMetricsForTests, recordRequestStart, recordResponse, getServerMetricsSnapshot } from '../lib/observability/server-metrics.js';

const html = fs.readFileSync('public/server.html', 'utf8');
assert.equal(html, fs.readFileSync('public/index.html', 'utf8'), 'index deve espelhar server visual');
assert.ok(html.includes('function headers(path)'), 'dashboard deve separar headers internos de chamadas de dados');
assert.ok(html.includes('proxy-output-probe'), 'consulta de teste do painel deve aparecer como probe real');
assert.ok(html.includes('proxyOutputMonitor'), 'página deve renderizar o espelho de saída do proxy');

resetServerMetricsForTests();
const internalReq = {
  url: '/api/server/metrics',
  method: 'GET',
  headers: {
    host: 'servidor-valorae.vercel.app',
    'x-forwarded-host': 'servidor-valorae.vercel.app',
    'x-forwarded-proto': 'https',
    'x-vercel-id': 'gru1::metrics123',
    'x-vercel-ip-country': 'BR',
    'x-valorae-telemetry': 'dashboard',
    'user-agent': 'Mozilla/5.0 VALORAE Server Visual',
  },
  socket: { remoteAddress: '10.0.0.99' },
};
recordRequestStart(internalReq, { route: '/api/server/metrics' });
let snap = getServerMetricsSnapshot();
assert.equal(snap.summary.requests, 0, 'polling do painel não deve inflar tráfego externo');
assert.equal(snap.summary.internalTelemetryRequests, 1, 'polling interno deve ser contado separadamente');
assert.equal(snap.vercelRuntime.observed.lastHost, 'servidor-valorae.vercel.app');
assert.equal(snap.vercelRuntime.observed.lastRegion, 'gru1');
assert.equal(snap.vercelRuntime.observed.lastCountry, 'BR');
assert.equal(snap.vercelRuntime.observed.source, 'dashboard_internal_telemetry');
assert.equal(snap.vercelRuntime.observed.requestsWithVercelHeaders, 1);
assert.equal(snap.vercelRuntime.observed.internalTelemetryRequestsWithVercelHeaders, 1);

const dataReq = {
  url: '/api/asset?ticker=PETR4&view=compact',
  method: 'GET',
  headers: {
    host: 'servidor-valorae.vercel.app',
    'x-forwarded-host': 'servidor-valorae.vercel.app',
    'x-forwarded-proto': 'https',
    'x-vercel-id': 'gru1::asset123',
    'x-vercel-ip-country': 'BR',
    'x-valorae-app': 'VALORAE Server Visual',
    'x-valorae-channel': 'proxy-output-probe',
    'user-agent': 'Mozilla/5.0 VALORAE Server Visual',
  },
  socket: { remoteAddress: '10.0.0.100' },
};
const headers = new Map();
const res = {
  statusCode: 200,
  getHeader(name) { return headers.get(String(name).toLowerCase()); },
  setHeader(name, value) { headers.set(String(name).toLowerCase(), value); },
};
recordRequestStart(dataReq, { route: '/api/asset' });
recordResponse(dataReq, res, {
  status: 'OK',
  ticker: 'PETR4',
  appPayload: { ticker: 'PETR4', metrics: { canonical: { price: { value: 38.2 }, dy: { value: 7.1 } } }, charts: { series: [{ key: 'price', points: [{ x: '2026-01', y: 37 }, { x: '2026-02', y: 38.2 }] }] } },
  appMobileSnapshot: { ticker: 'PETR4', metrics: { price: 38.2, dy: 7.1 }, charts: [{ key: 'price', points: [{ x: '2026-01', y: 37 }, { x: '2026-02', y: 38.2 }] }], sync: { renderSafe: true, action: 'replace_snapshot' }, snapshotHash: 'petro' },
  appDataContract: { renderSafe: true, canReplacePreviousSnapshot: true },
  appResponseIntegrity: { renderSafe: true, cacheSafe: true },
}, { status: 200, responseBytes: 4096, route: '/api/asset' });

snap = getServerMetricsSnapshot();
assert.equal(snap.summary.requests, 1, 'consulta de dados do painel deve alimentar telemetria real');
assert.equal(snap.distributions.apps[0].name, 'VALORAE Server Visual');
assert.equal(snap.distributions.channels[0].name, 'proxy-output-probe');
assert.equal(snap.deliveryHarmony.payloadsDelivered, 1);
assert.equal(snap.recentEvents[0].appChannel, 'proxy-output-probe');
assert.equal(snap.proxyOutputMonitor.outputFeed[0].appChannel, 'proxy-output-probe');
assert.equal(snap.recentEvents[0].payloadSignals.ticker, 'PETR4');
assert.equal(snap.vercelRuntime.observed.lastHost, 'servidor-valorae.vercel.app');
assert.equal(snap.vercelRuntime.observed.lastRegion, 'gru1');
assert.equal(snap.vercelRuntime.observed.source, 'external_traffic');

console.log('careful-review-vercel-runtime-v21-12-17 ok');
