import assert from 'node:assert/strict';
import { buildAppConsumerPayload } from '../lib/quality/app-consumer-payload.js';

const payload = {
  ticker: 'HGLG11',
  type: 'FII',
  status: 'PARTIAL',
  partial: true,
  cacheStatus: 'LIVE_HTML',
  warnings: ['fonte parcial'],
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
  chartSeries: { count: 1, totalSeriesDetected: 1, series: [{ key: 'dividendos.historico.valor', name: 'valor', pointCount: 3, points: [{ y: 1 }, { y: 1.1 }, { y: 1.2 }] }] },
  panelReadiness: { panels: [{ key: 'quote', ready: true, completenessPercent: 100 }, { key: 'charts', ready: true, completenessPercent: 100 }] },
  consumerDiagnostics: { captureScore: 78, primarySource: 'Investidor10', appContract: { partialDataBanner: true }, sourcesUsed: ['Investidor10'] },
  sourceReport: { primarySource: 'Investidor10', sourcesUsed: ['Investidor10'] },
  metrics: { generatedAt: '2026-05-28T00:00:00.000Z', source: 'Investidor10' },
};

const app = buildAppConsumerPayload(payload);
assert.equal(app.version, '21.12.5-app-consumer-blank-shield');
assert.equal(app.quote.price, 160);
assert.equal(app.metrics.aliases.price, 'precoAtual');
assert.equal(app.metrics.aliases.dy, 'dividendYield');
assert.equal(app.blankShield.canRenderDashboard, true);
assert.equal(app.blankShield.canRenderCharts, true);
assert.equal(app.dividends.historyCount, 1);
assert.equal(app.appHints.preferMetricPath, 'appPayload.metrics.canonical');

const empty = buildAppConsumerPayload({ ticker: 'XXXX3', type: 'ACAO', status: 'PARTIAL', results: {}, normalized: {}, panelReadiness: { panels: [] }, chartSeries: { series: [] } });
assert.equal(empty.blankShield.canRenderDashboard, false);
assert.ok(empty.blankShield.recommendedEmptyState);
assert.ok(empty.blankShield.missingCritical.includes('precoAtual'));

console.log('app-consumer-payload-v21-12-5 ok');
