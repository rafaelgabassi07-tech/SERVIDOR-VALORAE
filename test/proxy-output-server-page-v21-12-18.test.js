import assert from 'node:assert/strict';
import fs from 'node:fs';
import { resetServerMetricsForTests, recordRequestStart, recordResponse, getServerMetricsSnapshot } from '../lib/observability/server-metrics.js';

const html = fs.readFileSync('public/server.html', 'utf8');
assert.equal(html, fs.readFileSync('public/index.html', 'utf8'), 'index deve espelhar a página-servidor do proxy');
for (const needle of [
  'VALORAE Proxy Output Server',
  'Espelho de saída do proxy',
  'Feed de tudo que saiu do proxy',
  'Payload selecionado',
  'proxyOutputMonitor',
  'outputFeed',
  'routeOutputs',
  'Gerar saída teste',
  'proxy-output-probe',
]) assert.ok(html.includes(needle), `server.html precisa conter ${needle}`);

resetServerMetricsForTests();
const req = {
  url: '/api/asset?ticker=MXRF11&view=compact&app=VALORAE%20Investidor&channel=mobile',
  method: 'GET',
  headers: {
    host: 'servidor-valorae.vercel.app',
    'x-forwarded-host': 'servidor-valorae.vercel.app',
    'x-vercel-id': 'gru1::out123',
    'x-valorae-app': 'VALORAE Investidor',
    'x-valorae-channel': 'mobile',
    'user-agent': 'okhttp/4.12 VALORAE Android',
  },
  socket: { remoteAddress: '10.0.0.30' },
};
const headers = new Map();
const res = {
  statusCode: 200,
  getHeader(name) { return headers.get(String(name).toLowerCase()); },
  setHeader(name, value) { headers.set(String(name).toLowerCase(), value); },
};
recordRequestStart(req, { route: '/api/asset' });
recordResponse(req, res, {
  status: 'OK',
  ticker: 'MXRF11',
  appPayload: { ticker: 'MXRF11', metrics: { canonical: { price: { value: 10.2 }, dy: { value: 11.1 } } }, charts: { series: [{ key: 'price', points: [{ x: '2026-01', y: 10.1 }, { x: '2026-02', y: 10.2 }] }] } },
  appMobileSnapshot: { ticker: 'MXRF11', metrics: { price: 10.2, dy: 11.1 }, charts: [{ key: 'price', points: [{ x: '2026-01', y: 10.1 }, { x: '2026-02', y: 10.2 }] }], dividends: { items: [{ value: 0.1 }] }, sync: { renderSafe: true, action: 'replace_snapshot' }, snapshotHash: 'mxrf' },
  appDataContract: { renderSafe: true, canReplacePreviousSnapshot: true },
  appResponseIntegrity: { renderSafe: true, cacheSafe: true },
  normalized: { pvp: { value: 1.01 } },
}, { status: 200, responseBytes: 5120, route: '/api/asset' });

const snap = getServerMetricsSnapshot();
assert.equal(snap.version, '21.12.18-proxy-output-server-page');
assert.equal(snap.proxyOutputMonitor.totals.outboundResponses, 1);
assert.equal(snap.proxyOutputMonitor.totals.payloadResponses, 1);
assert.equal(snap.proxyOutputMonitor.totals.transformedForApps, 1);
assert.equal(snap.proxyOutputMonitor.totals.mobileSnapshots, 1);
assert.equal(snap.proxyOutputMonitor.outputFeed[0].route, '/api/asset');
assert.equal(snap.proxyOutputMonitor.outputFeed[0].appName, 'VALORAE Investidor');
assert.equal(snap.proxyOutputMonitor.outputFeed[0].payloadSignals.ticker, 'MXRF11');
assert.ok(snap.proxyOutputMonitor.outputFeed[0].payloadRoots.includes('appPayload'));
assert.ok(snap.proxyOutputMonitor.rootCoverage.some(x => x.name === 'appPayload'));
assert.ok(snap.proxyOutputMonitor.routeOutputs[0].metricsDelivered >= 3);
assert.equal(snap.proxyOutputMonitor.liveStatus.vercelRegion, 'gru1');

console.log('proxy-output-server-page-v21-12-18 ok');
