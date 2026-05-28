import assert from 'node:assert/strict';
import { buildPanelReadiness } from '../lib/quality/panel-readiness.js';

const payload = {
  status: 'PARTIAL',
  partial: true,
  ticker: 'HGLG11',
  type: 'FII',
  results: {
    dividendYield: '8,4%',
    pvp: '0,96',
    patrimonioLiquido: 'R$ 4.2 bi',
    ultimoRendimento: 'R$ 1,10',
    dividendos: { historico: [{ data: '01/2024', valor: '1,00' }, { data: '02/2024', valor: '1,10' }] },
  },
  normalized: {
    dividendYield: { value: 8.4, confidence: 0.9 },
    pvp: { value: 0.96, confidence: 0.9 },
  },
  chartReadiness: { ready: true, score: 88 },
  chartSeries: { series: [{ key: 'dividendos', pointCount: 2, points: [{ y: 1 }, { y: 1.1 }] }] },
  sourceReport: { primarySource: 'Investidor10' },
  sourceReliability: [],
  metrics: { sourcesTried: [{ provider: 'Investidor10' }] },
  cacheStatus: 'LIVE_HTML',
  warnings: ['Retorno parcial simulado'],
};

const report = buildPanelReadiness(payload);
assert.equal(report.version, '21.12.3-panel-data-readiness');
assert.equal(report.consumerContract.preferredChartPath, 'chartSeries.series');
assert.equal(report.consumerContract.canRenderCharts, true);
assert.equal(report.consumerContract.shouldShowPartialBanner, true);
assert.ok(report.readyPanels >= 4);
assert.ok(report.score >= 55);
assert.ok(report.panels.some(p => p.key === 'fundamentals' && p.ready));
assert.ok(report.panels.some(p => p.key === 'dividends' && p.ready));

const weak = buildPanelReadiness({ type: 'ACAO', results: {}, chartReadiness: { ready: false }, chartSeries: { series: [] } });
assert.equal(weak.ready, false);
assert.equal(weak.consumerContract.canRenderCharts, false);
assert.ok(weak.gaps.length >= 3);
console.log('panel-readiness-v21-12-3 ok');
