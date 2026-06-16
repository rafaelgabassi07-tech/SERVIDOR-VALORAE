import assert from 'node:assert/strict';
import { buildAnalysisPageResponse } from '../lib/analysis/analysis-page-response.js';

function monthPoints(offset = 0) {
  return [
    { label: '01/26', value: 0 + offset, display: `${(0 + offset).toFixed(2)}%` },
    { label: '02/26', value: 1.2 + offset, display: `${(1.2 + offset).toFixed(2)}%` },
    { label: '03/26', value: 2.4 + offset, display: `${(2.4 + offset).toFixed(2)}%` },
    { label: '04/26', value: 3.2 + offset, display: `${(3.2 + offset).toFixed(2)}%` },
    { label: '05/26', value: 4.1 + offset, display: `${(4.1 + offset).toFixed(2)}%` },
    { label: '06/26', value: 5.5 + offset, display: `${(5.5 + offset).toFixed(2)}%` },
    { label: '07/26', value: 6.1 + offset, display: `${(6.1 + offset).toFixed(2)}%` },
    { label: '08/26', value: 7.0 + offset, display: `${(7.0 + offset).toFixed(2)}%` }
  ];
}

const expectedCodes = ['IBOV', 'IFIX', 'CDI', 'IPCA', 'SMLL', 'IDIV'];
const response = buildAnalysisPageResponse({
  ticker: 'PETR4',
  assetClass: 'ACAO',
  assetChartBundle: {
    indexComparison: expectedCodes.map((code, index) => ({
      name: code,
      source: `${code} real source`,
      realOnly: true,
      simulated: false,
      series: [
        { id: 'asset', label: 'PETR4', points: monthPoints(0) },
        { id: code.toLowerCase(), label: code, points: monthPoints(index + 1) }
      ]
    }))
  }
}, { ticker: 'PETR4' });

const comparisons = response.sections.find(section => section.id === 'comparisons');
assert.equal(comparisons.status, 'ready');
const combined = comparisons.charts.find(chart => chart.id === 'asset_vs_indices');
assert.ok(combined, 'gráfico combinado de índices precisa existir quando há múltiplas séries reais');
assert.deepEqual(combined.series.map(serie => serie.label), ['PETR4', ...expectedCodes]);
assert.equal(combined.series.length, 7, 'APK precisa receber ativo + todos os seis índices reais permitidos');
assert.ok(comparisons.items.filter(item => item.group === 'Ativo x índice').length >= expectedCodes.length, 'resumo deve manter todos os índices reais');

console.log('Analysis clean mobile v46 comparison coverage test OK.');
