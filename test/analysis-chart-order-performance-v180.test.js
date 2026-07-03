import assert from 'node:assert/strict';
import { _test } from '../lib/analysis/analysis-page-response.js';
import { buildInvestidor10CanonicalCharts } from '../lib/market/investidor10-chart-extractor.js';

const charts = _test.buildAssetCharts({
  ticker: 'PETR4',
  type: 'ACAO',
  assetChartBundle: {
    priceHistory: [
      { label: 'Mar/2024', close: 32 },
      { label: 'Jan/2024', close: 30 },
      { label: 'Fev/2024', close: 31 }
    ],
    revenueProfit: [
      { label: '2024', netRevenue: 130, grossProfit: 80, ebitda: 72, ebit: 64, netProfit: 40 },
      { label: '2022', netRevenue: 100, grossProfit: 55, ebitda: 48, ebit: 41, netProfit: 20 },
      { label: '2023', netRevenue: 120, grossProfit: 70, ebitda: 62, ebit: 50, netProfit: 32 }
    ],
    equityEvolution: [
      { label: '4T 2024', netWorth: 260, totalAssets: 620, totalLiabilities: 360 },
      { label: '2T 2024', netWorth: 230, totalAssets: 560, totalLiabilities: 330 },
      { label: '3T 2024', netWorth: 245, totalAssets: 590, totalLiabilities: 345 }
    ]
  }
});

const price = charts.find(chart => chart.id === 'price_history');
assert.deepEqual(price.series[0].points.map(point => point.label), ['Jan/2024', 'Fev/2024', 'Mar/2024'], 'cotação deve sair em ordem cronológica, sem gráfico invertido no APK');

const revenue = charts.find(chart => chart.id === 'revenue_profit');
assert.ok(revenue, 'receitas e lucros deve existir com séries reais');
assert.deepEqual(revenue.series[0].points.map(point => point.label), ['2022', '2023', '2024'], 'receitas/lucros deve preservar ordem visual da fonte, do período antigo para o recente');

const equity = charts.find(chart => chart.id === 'equity_evolution');
assert.ok(equity, 'evolução patrimonial deve existir com séries reais');
assert.deepEqual(equity.series[0].points.map(point => point.label), ['2T 2024', '3T 2024', '4T 2024'], 'trimestres devem ser reordenados antes da renderização para evitar barras invertidas');

const canonical = buildInvestidor10CanonicalCharts({
  ticker: 'PETR4',
  type: 'ACAO',
  apiExtras: {
    chartsFinanceiros: {
      receitasLucros: [
        { label: '2024', netRevenue: 130, netProfit: 40 },
        { label: '2022', netRevenue: 100, netProfit: 20 },
        { label: '2023', netRevenue: 120, netProfit: 32 }
      ]
    },
    rawJson: {}
  }
});
assert.ok(canonical.financial?.revenueProfit?.length, 'extrator Investidor10 deve entregar receitas/lucros no bloco financeiro');
assert.deepEqual(canonical.financial.revenueProfit.map(point => point.label), ['2022', '2023', '2024'], 'extrator Investidor10 deve normalizar a ordem antes de entregar ao contrato único');

console.log('Analysis chart order/performance v180 test OK.');
