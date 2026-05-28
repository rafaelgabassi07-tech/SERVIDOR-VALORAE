import assert from 'node:assert/strict';
import { buildAppMobileSnapshot } from '../lib/quality/app-mobile-snapshot.js';
import { buildAppConsumerPayload } from '../lib/quality/app-consumer-payload.js';
import { buildAppRenderContract } from '../lib/quality/app-render-contract.js';
import { buildAppDataContract } from '../lib/quality/app-data-contract.js';
import { buildAppSyncEnvelope } from '../lib/quality/app-sync-envelope.js';

const payload = {
  ticker: 'GARE11',
  type: 'FII',
  status: 'OK',
  results: { nome: 'GARE11 Fundo', dividendos: { historico: [{ dataCom: '2026-05-01', valor: '0,09' }] } },
  normalized: {
    precoAtual: { value: 9.87, display: 'R$ 9,87', unit: 'BRL', source: 'test', confidence: 0.95 },
    dividendYield: { value: 12.3, display: '12,30%', unit: '%', source: 'test', confidence: 0.93 },
    pvp: { value: 0.91, display: '0,91', unit: 'ratio', source: 'test', confidence: 0.9 },
    valorPatrimonialCota: 10.5,
  },
  chartSeries: {
    series: [{ key: 'preco', name: 'Preço', pointCount: 120, points: Array.from({ length: 120 }, (_, i) => ({ date: `2026-01-${String((i % 28) + 1).padStart(2, '0')}`, value: 9 + i / 100 })) }]
  },
  panelReadiness: { panels: [{ key: 'quote', ready: true, completenessPercent: 100 }, { key: 'charts', ready: true, completenessPercent: 80 }] },
  sourceReport: { primarySource: 'Investidor10', sourcesUsed: ['Investidor10'] },
  metrics: { generatedAt: '2026-05-28T12:00:00.000Z' },
};

payload.appPayload = buildAppConsumerPayload(payload);
payload.appRenderContract = buildAppRenderContract(payload);
payload.appDataContract = buildAppDataContract(payload);
payload.appSyncEnvelope = buildAppSyncEnvelope(payload);
payload.appMobileSnapshot = buildAppMobileSnapshot(payload);

assert.equal(payload.appMobileSnapshot.version, '21.12.9-app-mobile-snapshot');
assert.equal(payload.appMobileSnapshot.quote.ticker, 'GARE11');
assert.equal(payload.appMobileSnapshot.quote.price, 9.87);
assert.equal(payload.appMobileSnapshot.metrics.precoAtual.display, 'R$ 9,87');
assert.equal(payload.appMobileSnapshot.metrics.valorPatrimonialCota.value, 10.5);
assert.equal(payload.appMobileSnapshot.charts.length, 1);
assert.ok(payload.appMobileSnapshot.charts[0].sampledPointCount <= 80);
assert.equal(payload.appMobileSnapshot.sync.payloadHash, payload.appSyncEnvelope.identity.payloadHash);
assert.ok(payload.appMobileSnapshot.snapshotHash.length >= 16);
assert.equal(payload.appMobileSnapshot.appInstructions.preferredForFirstPaint, true);

console.log('app-mobile-snapshot-v21-12-9 ok');
