import assert from 'node:assert/strict';
import { buildAppConsumerPayload } from '../lib/quality/app-consumer-payload.js';
import { buildAppRenderContract } from '../lib/quality/app-render-contract.js';
import { buildAppDataContract } from '../lib/quality/app-data-contract.js';

const payload = {
  ticker: 'HGLG11',
  type: 'FII',
  status: 'OK',
  partial: false,
  cacheStatus: 'LIVE_HTML',
  results: {
    nome: 'CSHG Logística',
    dividendos: { historico: [{ dataCom: '2026-05-01', valor: 'R$ 1,10' }, { dataCom: '2026-04-01', valor: 'R$ 1,05' }] },
  },
  normalized: {
    precoAtual: { display: 'R$ 160,00', value: 160, unit: 'BRL', source: 'test', confidence: 0.95 },
    dividendYield: { display: '8,5%', value: 8.5, unit: '%', source: 'test', confidence: 0.91 },
    pvp: { display: '0,95', value: 0.95, unit: 'ratio', source: 'test', confidence: 0.9 },
    valorPatrimonialCota: { display: 'R$ 168,00', value: 168, unit: 'BRL', source: 'test', confidence: 0.88 },
    ultimoRendimento: { display: 'R$ 1,10', value: 1.1, unit: 'BRL', source: 'test', confidence: 0.9 },
  },
  chartSeries: { count: 1, totalSeriesDetected: 1, series: [{ key: 'dividendos.historico.valor', name: 'Rendimentos', pointCount: 4, points: [{ y: 1 }, { y: 1.05 }, { y: 1.1 }, { y: 1.12 }] }] },
  panelReadiness: { panels: [
    { key: 'quote', ready: true, completenessPercent: 100 },
    { key: 'fundamentals', ready: true, completenessPercent: 80 },
    { key: 'dividends', ready: true, completenessPercent: 80 },
    { key: 'charts', ready: true, completenessPercent: 100 },
    { key: 'sourceTrace', ready: true, completenessPercent: 100 },
  ] },
  consumerDiagnostics: { captureScore: 90, sourceAttempts: { blockedAttempts: 0 }, sourcesUsed: ['Investidor10'], primarySource: 'Investidor10' },
  sourceReport: { primarySource: 'Investidor10', sourcesUsed: ['Investidor10'] },
  metrics: { generatedAt: '2026-05-28T00:00:00.000Z', source: 'Investidor10' },
};

payload.appPayload = buildAppConsumerPayload(payload);
payload.appRenderContract = buildAppRenderContract(payload);
const contract = buildAppDataContract(payload);

assert.equal(contract.version, '21.12.7-app-data-contract-validator');
assert.equal(contract.preferredRoot, 'appPayload');
assert.equal(contract.coverage.criticalMetrics.percent, 100);
assert.equal(contract.coverage.criticalMetrics.missing.length, 0);
assert.equal(contract.coverage.cardCoverage.readyCards >= 3, true);
assert.equal(contract.coverage.chartCoverage.seriesCount, 1);
assert.equal(contract.fieldMap.some(f => f.key === 'precoAtual' && f.aliases.includes('price')), true);
assert.equal(contract.renderSafe, true);
assert.equal(contract.canReplacePreviousSnapshot, true);
assert.equal(contract.freshness.badge, 'live');
assert.equal(contract.uiGuards.neverShowBlankDashboard, true);

const weak = {
  ticker: 'XXXX3', type: 'ACAO', status: 'PARTIAL', partial: true, cacheStatus: 'RESULT_CACHE_STALE_IF_ERROR',
  results: {}, normalized: {}, chartSeries: { series: [] }, panelReadiness: { panels: [] },
  consumerDiagnostics: { captureScore: 20, sourceAttempts: { blockedAttempts: 1 } },
  metrics: { generatedAt: '2026-05-28T00:00:00.000Z' },
};
weak.appPayload = buildAppConsumerPayload(weak);
weak.appRenderContract = buildAppRenderContract(weak);
const weakContract = buildAppDataContract(weak);
assert.equal(weakContract.renderSafe, false);
assert.equal(weakContract.canReplacePreviousSnapshot, false);
assert.equal(weakContract.coverage.criticalMetrics.missing.includes('precoAtual'), true);
assert.equal(weakContract.freshness.isStale, true);
assert.equal(weakContract.uiGuards.showPartialBanner, true);
assert.ok(weakContract.issues.some(i => i.code === 'MISSING_PRICE'));

console.log('app-data-contract-v21-12-7 ok');
