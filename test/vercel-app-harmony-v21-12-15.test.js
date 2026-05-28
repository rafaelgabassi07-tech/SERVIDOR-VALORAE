import assert from 'node:assert/strict';
import fs from 'node:fs';
import { resetServerMetricsForTests, recordRequestStart, recordResponse, getServerMetricsSnapshot } from '../lib/observability/server-metrics.js';

const html = fs.readFileSync('public/server.html', 'utf8');
assert.ok(html.includes('VALORAE Proxy Output Server'), 'dashboard deve mostrar página-servidor do proxy');
assert.ok(html.includes('Pipeline do proxy'), 'dashboard deve mostrar pipeline de distribuição');
assert.ok(html.includes('Apps e canais'), 'dashboard deve listar apps consumidores');
assert.ok(html.includes('proxyOutputMonitor'), 'dashboard deve consumir proxyOutputMonitor');
assert.equal(html, fs.readFileSync('public/index.html', 'utf8'), 'index.html deve espelhar server.html');
assert.ok(html.length < 72000, 'dashboard deve continuar leve para Vercel Free/mobile');

resetServerMetricsForTests();
const req = {
  url: '/api/asset?ticker=VISC11&view=compact&app=watchlist',
  method: 'GET',
  headers: {
    'user-agent': 'okhttp/4.12 VALORAE Android',
    'x-valorae-app': 'VALORAE Investidor',
    'x-valorae-app-version': '1.0.0',
    'x-valorae-channel': 'watchlist',
  },
  socket: { remoteAddress: '10.0.0.10' },
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
  ticker: 'VISC11',
  appPayload: {
    ticker: 'VISC11',
    metrics: { canonical: { price: { value: 98.5 }, dy: { value: 9.2 }, p_vp: { value: 0.92 } } },
    charts: { series: [{ key: 'price', points: [{ x: '2026-01', y: 95 }, { x: '2026-02', y: 98.5 }] }] },
  },
  appMobileSnapshot: {
    ticker: 'VISC11',
    metrics: { price: 98.5, dy: 9.2 },
    charts: [{ key: 'price', points: [{ x: '2026-01', y: 95 }, { x: '2026-02', y: 98.5 }] }],
    dividends: { items: [{ value: 0.85 }] },
    sync: { renderSafe: true, action: 'replace_snapshot' },
    snapshotHash: 'hash-mobile',
  },
  appDataContract: { renderSafe: true, canReplacePreviousSnapshot: true },
  appResponseIntegrity: { renderSafe: true, cacheSafe: true },
  appSyncEnvelope: { action: 'replace_snapshot', identity: { payloadHash: 'hash-full' } },
  normalized: { vacanciaFisica: { value: 4.1 } },
}, { status: 200, responseBytes: 4096, route: '/api/asset' });

const snap = getServerMetricsSnapshot();
assert.equal(snap.summary.requests, 1);
assert.equal(snap.distributions.apps[0].name, 'VALORAE Investidor');
assert.equal(snap.distributions.channels[0].name, 'watchlist');
assert.equal(snap.deliveryHarmony.payloadsDelivered, 1);
assert.equal(snap.deliveryHarmony.renderSafePayloads, 1);
assert.equal(snap.deliveryHarmony.cacheSafePayloads, 1);
assert.equal(snap.deliveryHarmony.mobileSnapshotsDelivered, 1);
assert.ok(snap.deliveryHarmony.score >= 80, 'score de harmonia deve ser alto para payload render/cache safe');
assert.equal(snap.deliveryHarmony.apps[0].name, 'VALORAE Investidor');
assert.equal(snap.deliveryHarmony.apps[0].channel, 'watchlist');
assert.equal(snap.routeDetails[0].topApp, 'VALORAE Investidor');
assert.equal(snap.routeDetails[0].topChannel, 'watchlist');
assert.equal(snap.routeDetails[0].deliveredPayloads, 1);
assert.equal(snap.routeDetails[0].renderSafeRatePercent, 100);
assert.equal(snap.recentEvents[0].deliveryDecision, 'replace_snapshot');
assert.equal(snap.recentEvents[0].appName, 'VALORAE Investidor');
assert.equal(snap.recentEvents[0].payloadSignals.hasAppMobileSnapshot, true);
assert.equal(snap.recentEvents[0].payloadSignals.hasAppPayload, true);
assert.equal(snap.proxyOutputMonitor.totals.payloadResponses, 1);
assert.equal(snap.proxyOutputMonitor.outputFeed[0].appName, 'VALORAE Investidor');

console.log('vercel-app-harmony-v21-12-15 ok');
