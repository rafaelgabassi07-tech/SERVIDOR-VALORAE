import assert from 'node:assert/strict';
import { _test } from '../lib/analysis/analysis-page-response.js';

const payload = {
  ticker: 'TEST3',
  assetClass: 'ACAO',
  assetChartBundle: {
    priceHistory: [
      { label: '2024', close: 10 },
      { label: '2025', close: 12 }
    ],
    revenueByBusiness: [
      { label: 'Energia', value: 65 },
      { label: 'Serviços', value: 35 }
    ]
  },
  comparisons: {
    indices: [
      {
        code: 'IBOV',
        label: 'IBOV',
        source: 'curva acumulada reconstruída por rentabilidade mensal',
        reconstructedFromMonthlyReturns: true,
        series: [
          { label: '2024', value: 0 },
          { label: '2025', value: 10 }
        ]
      }
    ]
  }
};

const page = _test.buildAnalysisPageResponse(payload, { ticker: 'TEST3' });
const charts = page.sections.flatMap(section => section.charts || []);
assert.ok(charts.length > 0, 'deve haver gráficos reais para validar o contrato');
for (const chart of charts) {
  assert.ok(['time', 'category'].includes(chart.axisKind), `${chart.id} deve declarar axisKind`);
  assert.ok(['exact', 'derived', 'official', 'source'].includes(chart.sourceFidelity), `${chart.id} não pode chegar reconstruído`);
  assert.equal(typeof chart.preserveSourceOrder, 'boolean', `${chart.id} deve declarar preserveSourceOrder booleano`);
  assert.ok(chart.sourceVisualModel, `${chart.id} deve declarar sourceVisualModel`);
}
const categoryCharts = charts.filter(chart => chart.axisKind === 'category');
assert.ok(categoryCharts.every(chart => chart.preserveSourceOrder === true), 'gráficos categóricos devem preservar ordem da fonte');
assert.ok(!charts.some(chart => chart.sourceFidelity === 'reconstructed'), 'gráficos reconstruídos não devem aparecer no contrato');
