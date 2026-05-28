import assert from 'node:assert/strict';
import { applyPayloadView, resolvePayloadView, VALORAE_VIEW_ALIASES_VERSION } from '../lib/quality/views.js';

const bigPoints = Array.from({ length: 200 }, (_, i) => ({ x: `2024-${String((i % 12) + 1).padStart(2, '0')}`, y: i + 10 }));
const payload = {
  version: '21.12.0',
  status: 'OK',
  ticker: 'GARE11',
  type: 'FII',
  results: {
    nome: 'Guardian Real Estate',
    precoAtual: 'R$ 10,00',
    sections: { rawTable: bigPoints },
    informacoesFundo: { segmento: 'Logística', mandato: 'Renda', numeroCotistas: '100000', administrador: 'x'.repeat(1000) },
    dividendos: { dividendYield: '10%', dyMedio5a: '9%', ultimoRendimento: 'R$ 0,10', historico: bigPoints },
  },
  normalized: { precoAtual: { value: 10, display: 'R$ 10,00' }, dividendYield: { value: 10, display: '10%' } },
  metrics: { generatedAt: '2026-05-28T00:00:00Z', totalTimeMs: 123, runtime: { cache: bigPoints } },
  coverage: { score: 90 },
  chartSeries: { count: 1, series: [{ key: 'price', points: bigPoints, pointCount: 200 }] },
  chartReadiness: { ready: true },
  panelReadiness: { panels: {} },
  consumerDiagnostics: { dataMap: {}, attempts: bigPoints },
  appPayload: {
    version: '21.12.5',
    ticker: 'GARE11',
    type: 'FII',
    status: 'OK',
    quote: { price: 10, priceDisplay: 'R$ 10,00' },
    metrics: { canonical: { precoAtual: { value: 10, display: 'R$ 10,00' } } },
    charts: { count: 1, bestPointCount: 200, series: [{ key: 'price', label: 'Preço', type: 'line', pointCount: 200, points: bigPoints }] },
    source: { primary: 'fixture' },
    blankShield: { canRenderDashboard: true },
  },
  appRenderContract: { cards: bigPoints },
  appDataContract: { score: 95, renderSafe: true, canReplacePreviousSnapshot: true, fieldMap: bigPoints },
  appSyncEnvelope: { identity: { payloadHash: 'abc' }, decision: { action: 'replace_snapshot', renderSafe: true }, firstPaint: { ready: true } },
  appMobileSnapshot: { snapshotHash: 'snap', charts: [{ key: 'price', points: bigPoints.slice(-80), sampledPointCount: 80 }], sync: { payloadHash: 'abc' } },
  appResponseIntegrity: { version: '21.12.10', ok: true, score: 98, renderSafe: true, cacheSafe: true, issues: [{ code: 'INFO' }, { code: 'WARN' }, { code: 'THIRD' }, { code: 'FOURTH' }, { code: 'FIFTH' }, { code: 'SIXTH' }] },
  quality: { huge: bigPoints },
  fieldConfidence: { huge: bigPoints },
  dataQualityMatrix: { huge: bigPoints },
  sourceReliability: { huge: bigPoints },
  debug: { html: 'x'.repeat(1000) },
};

assert.equal(VALORAE_VIEW_ALIASES_VERSION, '21.12.11-mobile-safe-payload-views');
assert.equal(resolvePayloadView('mobile').resolved, 'compact');
assert.equal(resolvePayloadView('snapshot').resolved, 'compact');
assert.equal(resolvePayloadView('watchlist').resolved, 'compact');

const compact = applyPayloadView(payload, 'mobile', { includeQuality: true });
assert.equal(compact.view, 'compact');
assert.equal(compact.requestedView, 'mobile');
assert.ok(compact.payloadViewProfile.reductionPercent > 30);
assert.equal(compact.chartSeries, undefined);
assert.equal(compact.chartReadiness, undefined);
assert.equal(compact.panelReadiness, undefined);
assert.equal(compact.consumerDiagnostics, undefined);
assert.equal(compact.appRenderContract, undefined);
assert.equal(compact.appDataContract, undefined);
assert.ok(compact.appMobileSnapshot);
assert.ok(compact.appSyncEnvelope.decision);
assert.ok(compact.appResponseIntegrity.topIssues.length <= 5);
assert.ok(compact.appPayload.charts.seriesPreview[0].points.length <= 12);
assert.equal(compact.results.sections, undefined);
assert.equal(compact.debug, undefined);
assert.equal(compact.fieldConfidence, undefined);
assert.equal(compact.dataQualityMatrix, undefined);
assert.equal(compact.sourceReliability, undefined);
assert.equal(compact.payloadViewProfile.appPreferredFirstPaintRoot, 'appMobileSnapshot');

const watchlist = applyPayloadView(payload, 'watchlist', { includeQuality: false });
assert.equal(watchlist.view, 'compact');
assert.equal(watchlist.appRenderContract, undefined);
assert.equal(watchlist.quality, undefined);
assert.equal(watchlist.fieldConfidence, undefined);
assert.equal(watchlist.debug, undefined);
assert.ok(watchlist.payloadViewProfile.afterBytesApprox < watchlist.payloadViewProfile.beforeBytesApprox);

console.log('app-mobile-view-contract-v21-12-11 ok');
