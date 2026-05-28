import assert from 'node:assert/strict';
import { buildConsumerDiagnostics } from '../lib/quality/consumer-diagnostics.js';
import { buildSourceReliabilityMatrix } from '../lib/quality/data-quality.js';

const payload = {
  status: 'PARTIAL',
  partial: true,
  type: 'FII',
  results: {
    precoAtual: 'R$ 100,00',
    dividendos: { historico: [{ dataCom: '2026-01-01', valor: '1,10' }] },
    sections: { historicoIndicadores: [{ periodo: '2026', pvp: '0,95' }] },
  },
  normalized: {
    precoAtual: { value: 100, display: 'R$ 100,00', unit: 'BRL', source: 'teste', confidence: 0.95 },
    dividendYield: { value: 10.5, display: '10,5%', unit: '%', source: 'teste', confidence: 0.91 },
    _meta: { count: 2 },
  },
  chartSeries: { series: [{ key: 'pvp', name: 'P/VP', sourceFormat: 'object-array', points: [{ x: '2026', y: 0.95 }] }] },
  chartReadiness: { ready: true, topSeries: [{ key: 'pvp' }] },
  panelReadiness: { panels: { quote: { ready: true, completenessPercent: 100 }, charts: { ready: true, completenessPercent: 90 }, fundamentals: { ready: false, completenessPercent: 40, missingPaths: ['normalized.pvp.value'] } } },
  sourceReport: { primarySource: 'Investidor10HTML', sourcesUsed: ['Investidor10HTML','YahooChart'] },
  metrics: {
    source: 'Investidor10HTML+YahooChart',
    generatedAt: '2026-05-28T00:00:00.000Z',
    sourcesTried: [
      { name: 'Investidor10', provider: 'DirectFetch', ok: false, status: 403, blocked: true, htmlLength: 0, retryable: true },
      { name: 'YahooChart', provider: 'fetch', ok: true, status: 200, htmlLength: 512 },
    ],
  },
};

const report = buildConsumerDiagnostics(payload, { providers: { YahooChart: { status: 'healthy', sampleSize: 1 } } });
assert.equal(report.version, '21.12.4-consumer-source-diagnostics');
assert.equal(report.primarySource, 'Investidor10HTML');
assert.equal(report.sourceAttempts.totalAttempts, 2);
assert.equal(report.sourceAttempts.blockedAttempts, 1);
assert.equal(report.dataMap.normalizedFieldCount, 2);
assert.equal(report.dataMap.chartSeriesCount, 1);
assert.ok(report.priorityPaths.find(x => x.panel === 'charts').availablePaths.includes('chartSeries.series'));
assert.equal(report.appContract.neverBlankDashboard, true);
assert.ok(report.captureScore > 0 && report.captureScore <= 100);

const reliability = buildSourceReliabilityMatrix({ providers: { BancoCentral: { status: 'healthy', sampleSize: 3, score: 97 }, Investidor10: { status: 'degraded', failures: 2, sampleSize: 4 } } });
assert.equal(reliability.find(x => x.name === 'BCB').status, 'healthy');
assert.equal(reliability.find(x => x.name === 'Investidor10').status, 'degraded');

console.log('consumer-diagnostics-v21-12-4 ok');
