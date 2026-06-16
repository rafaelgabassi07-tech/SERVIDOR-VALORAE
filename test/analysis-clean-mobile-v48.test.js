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

const expectedCodes = ['IBOV', 'IFIX', 'CDI', 'IPCA', 'SMLL', 'IDIV', 'IVVB11'];
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
  },
  assetChartsCanonical: {
    info: {
      'Valor de mercado': 'R$ 530,61 Bilhões R$ 530.610.134.000',
      'Valor de firma': 'R$ 854,70 Bilhões R$ 854.701.134.000',
      'Patrimônio Líquido': 'R$ 445,19 Bilhões R$ 445.189.000.000'
    }
  }
}, { ticker: 'PETR4' });

const comparisons = response.sections.find(section => section.id === 'comparisons');
assert.equal(comparisons.status, 'ready');
const combined = comparisons.charts.find(chart => chart.id === 'asset_vs_indices');
assert.ok(combined, 'gráfico combinado de índices precisa existir quando há múltiplas séries reais');
assert.deepEqual(combined.series.map(serie => serie.label), ['PETR4', ...expectedCodes]);
assert.equal(combined.series.length, 8, 'APK precisa receber ativo + todos os sete benchmarks reais permitidos');
assert.ok(comparisons.items.filter(item => item.group === 'Ativo x índice').length >= expectedCodes.length, 'resumo deve manter todos os benchmarks reais');

const profile = response.sections.find(section => section.id === 'company_profile');
const firmValue = profile.items.find(item => item.id === 'profile_enterpriseValue');
assert.ok(firmValue, 'Valor da firma deve chegar na área Sobre a empresa quando a fonte informa o campo');
assert.equal(firmValue.label, 'Valor da firma');
assert.equal(firmValue.value, 'R$ 854,70 Bilhões', 'Valor da firma deve usar valor real compacto da fonte e não card vazio');
assert.ok(!profile.items.some(item => item.label === 'Valor da firma' && !String(item.value || '').trim()), 'não pode existir card Valor da firma vazio');

console.log('Analysis clean mobile v48 comparison/profile test OK.');
