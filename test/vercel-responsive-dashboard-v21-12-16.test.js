import assert from 'node:assert/strict';
import fs from 'node:fs';
import { resetServerMetricsForTests, recordRequestStart, recordResponse, getServerMetricsSnapshot } from '../lib/observability/server-metrics.js';

const html = fs.readFileSync('public/server.html', 'utf8');
assert.equal(html, fs.readFileSync('public/index.html', 'utf8'), 'index deve espelhar server visual');
for (const needle of [
  'Vercel host',
  'Região / ambiente',
  'API origem',
  'apiBase',
  'proxyOutputMonitor',
  '@media(max-width:760px)',
  '@media(max-width:430px)',
  'grid-template-columns:repeat(2,1fr)',
]) assert.ok(html.includes(needle), `dashboard precisa conter ${needle}`);
assert.ok(html.length < 72000, 'dashboard responsivo deve continuar leve para Vercel/mobile');

resetServerMetricsForTests();
const req = {
  url: '/api/asset?ticker=HGLG11&view=mobile&app=android&channel=watchlist',
  method: 'GET',
  headers: {
    host: 'servidor-valorae.vercel.app',
    'x-forwarded-host': 'servidor-valorae.vercel.app',
    'x-forwarded-proto': 'https',
    'x-vercel-id': 'gru1::abc123',
    'x-vercel-ip-country': 'BR',
    'user-agent': 'okhttp/4.12 VALORAE Android',
    'x-valorae-app': 'VALORAE Investidor',
    'x-valorae-channel': 'watchlist',
  },
  socket: { remoteAddress: '10.0.0.20' },
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
  ticker: 'HGLG11',
  appPayload: { ticker: 'HGLG11', metrics: { canonical: { price: { value: 160 }, dy: { value: 8.1 } } }, charts: { series: [{ key: 'price', points: [{ x: '2026-01', y: 158 }, { x: '2026-02', y: 160 }] }] } },
  appMobileSnapshot: { ticker: 'HGLG11', metrics: { price: 160, dy: 8.1 }, charts: [{ key: 'price', points: [{ x: '2026-01', y: 158 }, { x: '2026-02', y: 160 }] }], sync: { renderSafe: true, action: 'replace_snapshot' }, snapshotHash: 'hglg' },
  appDataContract: { renderSafe: true, canReplacePreviousSnapshot: true },
  appResponseIntegrity: { renderSafe: true, cacheSafe: true },
}, { status: 200, responseBytes: 3072, route: '/api/asset' });

const snap = getServerMetricsSnapshot();
assert.equal(snap.vercelRuntime.observed.lastHost, 'servidor-valorae.vercel.app');
assert.equal(snap.vercelRuntime.observed.lastRegion, 'gru1');
assert.equal(snap.distributions.vercelHosts[0].name, 'servidor-valorae.vercel.app');
assert.equal(snap.distributions.vercelRegions[0].name, 'gru1');
assert.equal(snap.distributions.vercelCountries[0].name, 'BR');
assert.equal(snap.recentEvents[0].platform.host, 'servidor-valorae.vercel.app');
assert.equal(snap.recentEvents[0].platform.region, 'gru1');
assert.equal(snap.routeDetails[0].topVercelRegion, 'gru1');
assert.equal(snap.routeDetails[0].topHost, 'servidor-valorae.vercel.app');
assert.ok(snap.deliveryHarmony.pipeline.some(x => x.stage === 'vercel_runtime'), 'pipeline deve incluir runtime Vercel');
assert.equal(snap.proxyOutputMonitor.liveStatus.vercelRegion, 'gru1');
assert.equal(snap.proxyOutputMonitor.outputFeed[0].platform.host, 'servidor-valorae.vercel.app');

console.log('vercel-responsive-dashboard-v21-12-16 ok');
