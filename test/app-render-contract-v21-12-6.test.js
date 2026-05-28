import assert from 'node:assert/strict';
import { buildAppConsumerPayload } from '../lib/quality/app-consumer-payload.js';
import { buildAppRenderContract } from '../lib/quality/app-render-contract.js';

const payload = {
  ticker: 'HGLG11',
  type: 'FII',
  status: 'PARTIAL',
  partial: true,
  cacheStatus: 'RESULT_CACHE_STALE_IF_ERROR',
  results: {
    nome: 'CSHG Logística',
    dividendos: { historico: [{ dataCom: '2026-05-01', valor: 'R$ 1,10' }] },
  },
  normalized: {
    precoAtual: { display: 'R$ 160,00', value: 160, unit: 'BRL', source: 'test', confidence: 0.9 },
    dividendYield: { display: '8,5%', value: 8.5, unit: '%', source: 'test', confidence: 0.9 },
    pvp: { display: '0,95', value: 0.95, unit: 'ratio', source: 'test', confidence: 0.9 },
    ultimoRendimento: { display: 'R$ 1,10', value: 1.1, unit: 'BRL', source: 'test', confidence: 0.9 },
  },
  chartSeries: {
    count: 2,
    totalSeriesDetected: 2,
    series: [
      { key: 'dividendos.historico.valor', name: 'Rendimentos', pointCount: 3, points: [{ y: 1 }, { y: 1.1 }, { y: 1.2 }] },
      { key: 'ohlc', name: 'Preço OHLC', sourceFormat: 'ohlc-array', pointCount: 2, points: [{ y: 10, ohlc: { open: 9, high: 11, low: 8, close: 10 } }] },
    ],
  },
  panelReadiness: { panels: [
    { key: 'quote', ready: true, completenessPercent: 100 },
    { key: 'fundamentals', ready: true, completenessPercent: 80 },
    { key: 'dividends', ready: true, completenessPercent: 80 },
    { key: 'charts', ready: true, completenessPercent: 100 },
  ] },
  metrics: { generatedAt: '2026-05-28T00:00:00.000Z' },
};

payload.appPayload = buildAppConsumerPayload(payload);
const contract = buildAppRenderContract(payload);

assert.equal(contract.version, '21.12.6-app-render-contract');
assert.equal(contract.primaryDataPath, 'appPayload');
assert.equal(contract.renderState, 'partial');
assert.equal(contract.cards.find(c => c.key === 'quote').state, 'partial');
assert.equal(contract.cards.find(c => c.key === 'charts').primaryPath, 'appPayload.charts.series');
assert.equal(contract.metricGroups.quote.fields[0].path, 'appPayload.metrics.canonical.precoAtual');
assert.equal(contract.metricGroups.dividends.count >= 2, true);
assert.equal(contract.chartTemplates[0].kind, 'bar');
assert.equal(contract.chartTemplates[1].kind, 'candlestick');
assert.equal(contract.offlinePolicy.keepPreviousDataOnPartial, true);
assert.equal(contract.offlinePolicy.canUseStaleCache, true);
assert.ok(Array.isArray(contract.consistency.issues));

const empty = buildAppRenderContract({ ticker: 'XXXX3', type: 'ACAO', appPayload: buildAppConsumerPayload({ ticker: 'XXXX3', type: 'ACAO', normalized: {}, results: {}, chartSeries: { series: [] }, panelReadiness: { panels: [] } }) });
assert.equal(empty.renderState, 'empty');
assert.equal(empty.cards.find(c => c.key === 'charts').state, 'empty');
assert.equal(empty.chartTemplates.length, 0);

console.log('app-render-contract-v21-12-6 ok');
