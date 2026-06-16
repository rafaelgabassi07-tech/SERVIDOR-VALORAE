import assert from 'node:assert/strict';
import { readOptionalApkFile, assertOptionalMatch, assertOptionalDoesNotMatch } from './_optional-apk.js';
import { buildAnalysisPageResponse } from '../lib/analysis/analysis-page-response.js';

function section(response, id) {
  return response.sections.find(item => item.id === id);
}

function allCharts(response) {
  return response.sections.flatMap(item => item.charts || []);
}

const response = buildAnalysisPageResponse({
  ticker: 'PETR4',
  assetClass: 'ACAO',
  assetChartBundle: {
    priceHistory: [{ label: 'Jan/26', close: 30 }, { label: 'Fev/26', close: 35 }],
    dividendMonthly: [{ label: 'Jan/26', amount: 0.4 }, { label: 'Fev/26', amount: 0.5 }],
    revenueProfit: [{ year: '2023', netRevenue: 10, netProfit: 2 }, { year: '2024', netRevenue: 12, netProfit: 3 }],
    profitVsQuote: [{ year: '2023', value: 30, secondaryValue: 2 }, { year: '2024', value: 35, secondaryValue: 3 }],
    indexComparison: [
      {
        name: 'IBOV',
        source: 'B3/Yahoo Finance índice direto',
        series: [
          { label: 'PETR4', points: [{ label: 'Jan/26', value: 0 }, { label: 'Fev/26', value: 2 }, { label: 'Mar/26', value: 3 }] },
          { label: 'IBOV', points: [{ label: 'Jan/26', value: 0 }, { label: 'Fev/26', value: 1 }] }
        ]
      }
    ]
  },
  peerComparisons: [
    {
      peer: 'BBAS3',
      source: 'StatusInvest/Investidor10 pares reais',
      assetPoints: [{ label: 'Jan/26', value: 0 }, { label: 'Fev/26', value: 2 }, { label: 'Mar/26', value: 3 }],
      peerPoints: [{ label: 'Jan/26', value: 0 }, { label: 'Fev/26', value: 1 }]
    }
  ]
}, { ticker: 'PETR4' });

const charts = allCharts(response);
assert.ok(charts.length, 'a resposta de análise precisa expor gráficos para auditoria de fidelidade');
for (const chart of charts) {
  assert.ok(chart.source && chart.source !== 'VALORAE Proxy', `${chart.id} precisa manter fonte explícita, não genérica`);
  assert.ok(Array.isArray(chart.series) && chart.series.length > 0, `${chart.id} precisa ter séries estruturadas`);
  for (const serie of chart.series) {
    assert.ok(Array.isArray(serie.points) && serie.points.length > 0, `${chart.id}/${serie.label} precisa ter pontos`);
    for (const point of serie.points) {
      assert.ok(point.label, `${chart.id}/${serie.label} não pode ter ponto sem período/label`);
      assert.equal(typeof point.value, 'number', `${chart.id}/${serie.label}/${point.label} precisa ter valor numérico`);
      assert.ok(Number.isFinite(point.value), `${chart.id}/${serie.label}/${point.label} precisa ter número finito`);
    }
  }
}

const profitVsQuote = section(response, 'asset_charts').charts.find(chart => chart.id === 'profit_vs_quote');
assert.equal(profitVsQuote.chartType, 'multi_line', 'Lucro x Cotação tem duas séries e precisa ser multi_line para o APK preservar ambas');

const indexComparison = section(response, 'comparisons').charts.find(chart => chart.id === 'asset_vs_ibov');
assert.ok(indexComparison, 'comparador PETR4 x IBOV deve existir com séries reais');
assert.deepEqual(indexComparison.series.map(serie => serie.points.map(point => point.label)), [
  ['Jan/26', 'Fev/26'],
  ['Jan/26', 'Fev/26']
], 'comparadores precisam alinhar períodos reais comuns antes de desenhar as linhas');

const peerComparison = section(response, 'comparisons').charts.find(chart => chart.id === 'asset_vs_bbas3');
assert.ok(peerComparison, 'comparador PETR4 x BBAS3 deve existir com séries reais');
assert.deepEqual(peerComparison.series.map(serie => serie.points.map(point => point.label)), [
  ['Jan/26', 'Fev/26'],
  ['Jan/26', 'Fev/26']
], 'pares semelhantes precisam alinhar períodos reais comuns antes de desenhar as linhas');

const badComparison = buildAnalysisPageResponse({
  ticker: 'PETR4',
  assetClass: 'ACAO',
  assetChartBundle: {
    indexComparison: [{
      name: 'IBOV',
      source: 'B3/Yahoo Finance índice direto',
      series: [
        { label: 'PETR4', points: [{ label: 'Jan/26', value: 0 }, { label: 'Fev/26', value: 2 }] },
        { label: 'IBOV', points: [{ label: 'Mar/26', value: 0 }, { label: 'Abr/26', value: 1 }] }
      ]
    }]
  }
}, { ticker: 'PETR4' });
assert.ok(!(section(badComparison, 'comparisons')?.charts || []).some(chart => chart.id === 'asset_vs_ibov'), 'comparador sem períodos comuns não deve ser desenhado');

const fii = buildAnalysisPageResponse({
  ticker: 'HGLG11',
  assetClass: 'FII',
  assetChartBundle: {
    fiiAssetDistribution: { Atual: [{ name: 'Galpões', percentual: 65 }, { name: 'Caixa', percentual: 35 }, { name: 'Inválido', percentual: 140 }, { name: 'Zero', percentual: 0 }] }
  },
  results: {
    distribuicaoAtivosFundo: [{ label: 'Galpões', percentual: 65 }, { label: 'Caixa', percentual: 35 }, { label: 'Inválido', percentual: 140 }]
  }
}, { ticker: 'HGLG11' });
const distributionCharts = allCharts(fii).filter(chart => chart.id.includes('asset_distribution'));
assert.ok(distributionCharts.length, 'FII precisa expor distribuição quando houver percentuais reais');
for (const chart of distributionCharts) {
  assert.equal(chart.chartType, 'donut_composition', `${chart.id} deve ser composição/donut`);
  assert.ok(chart.series.every(serie => serie.points.every(point => point.value > 0 && point.value <= 100)), `${chart.id} deve rejeitar percentuais inválidos`);
}

const screen = readOptionalApkFile('../apk/app/src/main/java/com/example/ui/AnalysisScreen.kt');
assertOptionalMatch(screen, /drawLine/);
assertOptionalMatch(screen, /drawArc/);
assertOptionalDoesNotMatch(screen, /drawRoundRect/);
assertOptionalDoesNotMatch(screen, /isBarLike/);

console.log('Analysis chart source fidelity v34 review test OK.');
