import assert from 'node:assert/strict';
import fs from 'node:fs';
import { resetServerMetricsForTests, recordRequestStart, recordResponse, getServerMetricsSnapshot, _test } from '../lib/observability/server-metrics.js';

function res(statusCode = 200) {
  const headers = new Map();
  return {
    statusCode,
    getHeader(name) { return headers.get(String(name).toLowerCase()); },
    setHeader(name, value) { headers.set(String(name).toLowerCase(), value); },
  };
}

const html = fs.readFileSync('public/server.html', 'utf8');
assert.equal(html, fs.readFileSync('public/index.html', 'utf8'), 'index deve espelhar server.html');
assert.ok(html.includes('background:linear-gradient(135deg,#0f3d2e,#23c983 56%,#a7f36f)'), 'logo visual do painel deve estar verde/cinza profissional');
assert.ok(html.includes('x-valorae-telemetry'), 'polling interno deve continuar separado do tráfego real');

resetServerMetricsForTests();

const internalReq = {
  url: '/api/server/metrics',
  method: 'GET',
  headers: { host: 'servidor-valorae.vercel.app', 'x-valorae-telemetry': 'dashboard', 'x-vercel-id': 'gru1::internal' },
};
assert.equal(_test.shouldIgnoreMetrics(internalReq, { route: '/api/server/metrics' }), true, 'rotas internas continuam isoladas');

const dashboardLikeDataReq = {
  url: '/api/asset?ticker=VISC11&view=compact',
  method: 'GET',
  headers: {
    host: 'servidor-valorae.vercel.app',
    'x-forwarded-host': 'servidor-valorae.vercel.app',
    'x-vercel-id': 'gru1::external001',
    'x-valorae-telemetry': 'dashboard',
    'x-valorae-app': 'VALORAE Investidor APK',
    'x-valorae-channel': 'portfolio-mobile',
    'user-agent': 'okhttp/4.12 ValoraeAndroid',
  },
  socket: { remoteAddress: '10.0.0.40' },
};
assert.equal(_test.shouldIgnoreMetrics(dashboardLikeDataReq, { route: '/api/asset' }), false, 'rotas de dados não podem sumir por header dashboard/test/probe');
recordRequestStart(dashboardLikeDataReq, { route: '/api/asset' });
recordResponse(dashboardLikeDataReq, res(200), {
  status: 'OK',
  ticker: 'VISC11',
  appPayload: {
    ticker: 'VISC11',
    metrics: { canonical: { price: { value: 101.23 }, dy: { value: 9.8 }, p_vp: { value: 0.92 } } },
    charts: { series: [{ key: 'price', points: [{ x: '2026-01-01', y: 100 }, { x: '2026-01-02', y: 101.23 }] }] },
    dividends: { items: [{ date: '2026-01-10', value: 0.85 }] },
  },
  appMobileSnapshot: {
    ticker: 'VISC11',
    metrics: { price: 101.23, dy: 9.8 },
    charts: [{ key: 'price', points: [{ x: '2026-01-01', y: 100 }, { x: '2026-01-02', y: 101.23 }] }],
    dividends: { items: [{ date: '2026-01-10', value: 0.85 }] },
    sync: { renderSafe: true, action: 'replace_snapshot' },
    snapshotHash: 'visc11-blue',
  },
  appDataContract: { renderSafe: true, canReplacePreviousSnapshot: true },
  appResponseIntegrity: { renderSafe: true, cacheSafe: true },
  chartSeries: { series: [{ key: 'price', points: [{ x: '2026-01-01', y: 100 }, { x: '2026-01-02', y: 101.23 }] }] },
  normalized: { price: { value: 101.23 }, dy: { value: 9.8 } },
}, { status: 200, responseBytes: 8192, route: '/api/asset', cacheStatus: 'memory-hit', sourceStatus: 'ok' });

const externalReq = {
  url: '/api/portfolio/analyze?view=standard&app=VALORAE%20Web&channel=desktop',
  method: 'POST',
  headers: {
    host: 'servidor-valorae.vercel.app',
    'content-length': '340',
    'x-forwarded-host': 'servidor-valorae.vercel.app',
    'x-vercel-id': 'gru1::external002',
    'user-agent': 'Mozilla/5.0 Chrome VALORAE Web',
  },
  socket: { remoteAddress: '10.0.0.41' },
};
recordRequestStart(externalReq, { route: '/api/portfolio/analyze' });
recordResponse(externalReq, res(200), {
  status: 'OK',
  appPayload: { metrics: { canonical: { totalValue: { value: 120000 }, dy: { value: 10.1 } } }, charts: { series: [{ key: 'allocation', points: [{ x: 'FIIs', y: 60 }] }] } },
  normalized: { totalValue: { value: 120000 } },
  results: { dividends: [{ value: 1000 }] },
}, { status: 200, responseBytes: 4096, route: '/api/portfolio/analyze', cacheStatus: 'memory-miss', sourceStatus: 'ok' });

const snap = getServerMetricsSnapshot();
assert.match(snap.version, /^21\.12\.(20|26|27|28|29|30|32|35|36|37|38|39|40|41|42|43|44|45|46|47|48|49)-/);
assert.equal(snap.summary.requests, 2, 'somente as duas rotas de dados devem contar como tráfego real');
assert.equal(snap.summary.responses, 2);
assert.equal(snap.proxyOutputMonitor.totals.outboundResponses, 2);
assert.equal(snap.proxyOutputMonitor.outputFeed.length, 2);
assert.ok(snap.proxyOutputMonitor.outputFeed.some(e => e.route === '/api/asset' && e.appName === 'VALORAE Investidor APK' && e.appChannel === 'portfolio-mobile'));
assert.ok(snap.proxyOutputMonitor.outputFeed.some(e => e.route === '/api/portfolio/analyze' && e.appName === 'VALORAE Web'));
const asset = snap.proxyOutputMonitor.outputFeed.find(e => e.route === '/api/asset');
assert.ok(asset.payloadRoots.includes('appPayload'));
assert.ok(asset.payloadRoots.includes('appMobileSnapshot'));
assert.ok(asset.payloadRoots.includes('chartSeries'));
assert.ok(asset.payloadSignals.metrics >= 4, 'métricas precisam aparecer no item do feed');
assert.ok(asset.payloadSignals.charts >= 1, 'gráficos precisam aparecer no item do feed');
assert.ok(asset.payloadSignals.dividends >= 1, 'dividendos precisam aparecer no item do feed');
assert.ok(asset.payloadPreview.includes('VISC11'), 'preview do payload entregue precisa estar presente');
assert.equal(snap.proxyOutputMonitor.scope.capturePolicy.includes('Rotas de dados nunca são ignoradas'), true);
assert.ok(snap.proxyOutputMonitor.routeOutputs.some(r => r.route === '/api/asset' && r.deliveredPayloads === 1));
assert.ok(snap.distributions.apps.some(x => x.name === 'VALORAE Investidor APK'));
assert.equal(snap.summary.internalTelemetryRequests, 0, 'não registramos polling interno neste teste');

console.log('proxy-output-real-capture-v21-12-20 ok');
