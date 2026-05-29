import assert from 'node:assert/strict';
import fs from 'node:fs';
import { resetServerMetricsForTests, recordRequestStart, recordResponse, getServerMetricsSnapshot } from '../lib/observability/server-metrics.js';

const html = fs.readFileSync('public/server.html', 'utf8');
const index = fs.readFileSync('public/index.html', 'utf8');

for (const needle of [
  'VALORAE Proxy Output Server',
  'Espelho de saída do proxy',
  'Fluxo de saída em tempo real',
  'Feed de tudo que saiu do proxy',
  'Rotas distribuindo informações',
  'Payload selecionado',
  'proxyOutputMonitor',
  'appMobileSnapshot',
  'appPayload',
  'chartSeries',
  'localStorage',
  '/api/server/metrics',
  '/api/asset',
]) assert.ok(html.includes(needle), `server.html precisa conter ${needle}`);
assert.equal(html, index, 'index.html deve espelhar server.html');
assert.ok(html.length < 85000, 'dashboard deve continuar leve para Vercel/mobile');

resetServerMetricsForTests();
const req = {
  url: '/api/asset?ticker=GARE11&view=compact',
  method: 'GET',
  headers: { 'user-agent': 'Android VALORAE Test' },
  socket: { remoteAddress: '127.0.0.1' },
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
  ticker: 'GARE11',
  appPayload: { ticker: 'GARE11', metrics: { canonical: { price: { value: 10 }, dy: { value: 9.5 } } }, charts: { series: [{ key: 'price', points: [{ x: 1, y: 10 }] }] } },
  appMobileSnapshot: { metrics: { price: 10 }, charts: [{ key: 'price', points: [{ x: 1, y: 10 }] }], dividends: { items: [{ value: 0.1 }] }, sync: { renderSafe: true }, snapshotHash: 'abc' },
  normalized: { pvp: { value: 1.02 } },
}, { status: 200, responseBytes: 2048, route: '/api/asset' });
const snap = getServerMetricsSnapshot();
assert.equal(snap.summary.requests, 1);
assert.equal(snap.payloadIntelligence.observedPayloads, 1);
assert.ok(snap.payloadIntelligence.totalMetricsObserved >= 3);
assert.ok(snap.payloadIntelligence.totalChartSeriesObserved >= 1);
assert.ok(snap.recentEvents[0].payloadRoots.includes('appPayload'));
assert.equal(snap.recentEvents[0].payloadSignals.ticker, 'GARE11');
assert.equal(snap.recentEvents[0].payloadKind, 'app_delivery');
assert.equal(snap.proxyOutputMonitor.outputFeed[0].payloadKind, 'app_delivery');
assert.equal(snap.proxyOutputMonitor.totals.outboundResponses, 1);
assert.ok(String(snap.recentEvents[0].payloadPreview).includes('GARE11'));

console.log('proxy-server-visual-v21-12-14 ok');
