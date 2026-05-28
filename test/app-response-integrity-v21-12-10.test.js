import assert from 'node:assert/strict';
import { buildAppConsumerPayload } from '../lib/quality/app-consumer-payload.js';
import { buildAppRenderContract } from '../lib/quality/app-render-contract.js';
import { buildAppDataContract } from '../lib/quality/app-data-contract.js';
import { buildAppSyncEnvelope } from '../lib/quality/app-sync-envelope.js';
import { buildAppMobileSnapshot } from '../lib/quality/app-mobile-snapshot.js';
import { buildAppResponseIntegrity } from '../lib/quality/app-response-integrity.js';

const payload = {
  ticker: 'GARE11',
  type: 'FII',
  status: 'OK',
  partial: false,
  cacheStatus: 'LIVE_HTML',
  results: { nome: 'GARE11 Fundo', dividendos: { historico: [{ dataCom: '2026-05-01', valor: '0,09' }] } },
  normalized: {
    precoAtual: { value: 9.87, display: 'R$ 9,87', unit: 'BRL', source: 'test', confidence: 0.95 },
    dividendYield: { value: 12.3, display: '12,30%', unit: '%', source: 'test', confidence: 0.93 },
    pvp: { value: 0.91, display: '0,91', unit: 'ratio', source: 'test', confidence: 0.9 },
    valorPatrimonialCota: { value: 10.5, display: 'R$ 10,50', unit: 'BRL', source: 'test', confidence: 0.86 },
    ultimoRendimento: 0.09,
  },
  chartSeries: {
    count: 1,
    series: [{ key: 'preco', name: 'Preço', pointCount: 120, points: Array.from({ length: 120 }, (_, i) => ({ x: i, y: 9 + i / 100 })) }]
  },
  panelReadiness: { panels: [{ key: 'quote', ready: true, completenessPercent: 100 }, { key: 'charts', ready: true, completenessPercent: 80 }, { key: 'fundamentals', ready: true, completenessPercent: 75 }] },
  sourceReport: { primarySource: 'Investidor10', sourcesUsed: ['Investidor10'] },
  consumerDiagnostics: { captureScore: 90, sourcesUsed: ['Investidor10'] },
  metrics: { generatedAt: '2026-05-28T12:00:00.000Z' },
};

payload.appPayload = buildAppConsumerPayload(payload);
payload.appRenderContract = buildAppRenderContract(payload);
payload.appDataContract = buildAppDataContract(payload);
payload.appSyncEnvelope = buildAppSyncEnvelope(payload);
payload.appMobileSnapshot = buildAppMobileSnapshot(payload);
payload.appResponseIntegrity = buildAppResponseIntegrity(payload);

assert.equal(payload.appResponseIntegrity.version, '21.12.10-app-response-integrity');
assert.equal(payload.appResponseIntegrity.sections.rootCoverage.ready, 5);
assert.equal(payload.appResponseIntegrity.sections.metrics.canonicalCount >= 4, true);
assert.equal(payload.appResponseIntegrity.sections.charts.mobileChartCount, 1);
assert.equal(payload.appResponseIntegrity.sections.sync.hashParity.mobileReferencesSyncHash, true);
assert.equal(payload.appResponseIntegrity.cacheSafe, true);
assert.ok(payload.appResponseIntegrity.score >= 75);
assert.equal(payload.appResponseIntegrity.issueCounts.errors, 0);

const broken = buildAppResponseIntegrity({
  ticker: 'FAIL11',
  type: 'FII',
  status: 'PARTIAL',
  appPayload: { metrics: { canonical: {}, aliases: { price: 'precoAtual' } }, charts: { count: 1, series: [] } },
  chartSeries: { count: 1, series: [{ key: 'preco', points: [{ x: 1, y: 1 }], pointCount: 1 }] },
  appSyncEnvelope: { decision: { action: 'replace_snapshot', canReplacePreviousSnapshot: false }, identity: { payloadHash: 'abc' } },
  appMobileSnapshot: { sync: { payloadHash: 'def' } },
});

assert.equal(broken.ok, false);
assert.equal(broken.cacheSafe, false);
assert.ok(broken.issues.some(i => i.code === 'MISSING_APP_ROOT'));
assert.ok(broken.issues.some(i => i.code === 'NO_CONSUMABLE_METRICS'));
assert.ok(broken.issues.some(i => i.code === 'SNAPSHOT_HASH_REFERENCE_MISMATCH'));
assert.ok(broken.issues.some(i => i.code === 'REPLACE_ACTION_WITHOUT_PERMISSION'));

console.log('app-response-integrity-v21-12-10 ok');
