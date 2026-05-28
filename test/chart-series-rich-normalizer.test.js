import assert from 'node:assert/strict';
import { buildNormalizedChartSeries } from '../lib/quality/chart-series.js';
import { buildChartReadinessReport } from '../lib/quality/chart-readiness.js';

const payload = {
  highcharts: {
    xAxis: { categories: ['Jan/2024', 'Fev/2024', 'Mar/2024'] },
    series: [
      { name: 'Receita', data: ['R$ 1,2 mi', 'R$ 1,5 mi', 'R$ 1,7 mi'] },
      { name: 'Lucro', data: [[Date.UTC(2024, 0, 1), 10], [Date.UTC(2024, 1, 1), 12], [Date.UTC(2024, 2, 1), 13]] },
    ],
  },
  chartjs: {
    labels: ['2022', '2023', '2024'],
    datasets: [{ label: 'Dividendos', data: ['0,80', '1,10', '1,35'] }],
  },
  objectRows: [
    { date: '2024-01-01', value: 'R$ 10,00' },
    { date: '2024-02-01', value: 'R$ 11,00' },
    { date: '2024-03-01', value: 'R$ 12,00' },
  ],
};

const normalized = buildNormalizedChartSeries(payload, { maxSeries: 10 });
assert.equal(normalized.count >= 4, true);
assert.equal(normalized.series.some(s => s.sourceFormat === 'highcharts-series'), true);
assert.equal(normalized.series.some(s => s.sourceFormat === 'chartjs-dataset'), true);
assert.equal(normalized.series.some(s => s.key.includes('objectRows')), true);
assert.equal(normalized.series.every(s => s.points.length >= 2), true);

const readiness = buildChartReadinessReport(payload);
assert.equal(readiness.ready, true);
assert.equal(readiness.usableSeries >= 3, true);
assert.equal(readiness.sourceFormats.includes('highcharts-series'), true);
assert.equal(readiness.sourceFormats.includes('chartjs-dataset'), true);

console.log('chart-series rich normalizer tests OK');
