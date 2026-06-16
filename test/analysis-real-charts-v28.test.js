import assert from 'node:assert/strict';
import fs from 'node:fs';
import { readOptionalApkFile, assertOptionalMatch, assertOptionalDoesNotMatch } from './_optional-apk.js';
import { buildAnalysisPageResponse } from '../lib/analysis/analysis-page-response.js';

function chartIds(response) {
  return new Set(response.sections.find(section => section.id === 'asset_charts')?.charts.map(chart => chart.id) || []);
}

const stockResponse = buildAnalysisPageResponse({
  ticker: 'PETR4',
  assetClass: 'ACAO',
  name: 'PETROBRAS PN',
  currentPrice: 38.9,
  indicators: { pl: 4.6, pvp: 1.1, dividendYield: 8.2 },
  assetChartBundle: {
    priceHistory: [{ date: '2025-01-01', close: 30 }, { date: '2026-01-01', close: 39 }],
    dividendMonthly: [{ label: 'Jan/26', amount: 0.42 }, { label: 'Fev/26', amount: 0.51 }],
    dividendYieldHistory: [{ year: '2024', yieldPercent: 7.1 }, { year: '2025', yieldPercent: 8.2 }],
    revenueProfit: [{ year: '2023', netRevenue: 510000000000, netProfit: 124000000000 }, { year: '2024', netRevenue: 490000000000, netProfit: 98000000000 }],
    profitVsQuote: [{ year: '2023', value: 30, secondaryValue: 124000000000 }, { year: '2024', value: 39, secondaryValue: 98000000000 }],
    equityEvolution: [{ year: '2023', netWorth: 389000000000 }, { year: '2024', netWorth: 410000000000 }],
    payoutHistory: [{ year: '2023', value: 42 }, { year: '2024', value: 46 }],
    indexComparison: [{ name: 'IBOV', series: [{ label: 'PETR4', points: [{ label: 'Jan', value: 0 }, { label: 'Fev', value: 2.9 }] }, { label: 'IBOV', points: [{ label: 'Jan', value: 2.1 }, { label: 'Fev', value: 3.8 }] }] }]
  }
}, { ticker: 'PETR4' });

const stockCharts = chartIds(stockResponse);
for (const required of ['price_history', 'dividend_history', 'dividend_yield_history', 'revenue_profit', 'profit_vs_quote', 'equity_evolution', 'payout_history']) {
  assert.ok(stockCharts.has(required), `Ação deve expor gráfico estruturado ${required}`);
}
const stockAssetCharts = stockResponse.sections.find(section => section.id === 'asset_charts');
assert.equal(stockAssetCharts.status, 'ready');
assert.ok(stockAssetCharts.charts.every(chart => chart.series.every(serie => serie.points.every(point => Number.isFinite(point.value)))));
assert.ok(!stockResponse.missingSignals.some(signal => signal.id === 'asset_charts'));
assert.ok(stockResponse.sections.find(section => section.id === 'comparisons')?.charts.some(chart => chart.title.includes('IBOV')));

const fiiResponse = buildAnalysisPageResponse({
  ticker: 'HGLG11',
  assetClass: 'FII',
  name: 'CSHG LOGÍSTICA FII',
  currentPrice: 160,
  indicators: { pvp: 1.05, dividendYield: 8.4 },
  assetChartBundle: {
    dividendMonthly: [{ label: 'Jan/26', amount: 1.1 }, { label: 'Fev/26', amount: 1.2 }],
    dividendYieldHistory: [{ year: '2024', value: 7.9 }, { year: '2025', value: 8.3 }],
    fiiPatrimonialInfo: [{ label: '2024', value: 145.2 }, { label: '2025', value: 152.1 }],
    fiiAssetDistribution: { Atual: [{ name: 'Galpões', percentual: 65 }, { name: 'CRI', percentual: 25 }, { name: 'Caixa', percentual: 10 }] },
    indexComparison: [{ name: 'IFIX', series: [{ label: 'HGLG11', points: [{ label: 'Jan', value: 0 }, { label: 'Fev', value: 1.8 }] }, { label: 'IFIX', points: [{ label: 'Jan', value: 1.2 }, { label: 'Fev', value: 2.4 }] }] }]
  }
}, { ticker: 'HGLG11' });

const fiiCharts = chartIds(fiiResponse);
for (const required of ['fii_monthly_distribution', 'dividend_yield_history', 'fii_patrimonial_value', 'fii_asset_distribution']) {
  assert.ok(fiiCharts.has(required), `FII deve expor gráfico estruturado ${required}`);
}
assert.ok(fiiResponse.sections.find(section => section.id === 'comparisons')?.charts.some(chart => chart.title.includes('IFIX')));
assert.ok(!fiiResponse.missingSignals.some(signal => signal.id === 'asset_charts'));


const noFakeComparison = buildAnalysisPageResponse({
  ticker: 'PETR4',
  assetClass: 'ACAO',
  currentPrice: 39,
  assetChartBundle: {
    priceHistory: [{ date: '2025-01-01', close: 30 }, { date: '2026-01-01', close: 39 }]
  }
}, { ticker: 'PETR4' });
assert.ok(!(noFakeComparison.sections.find(section => section.id === 'comparisons')?.charts || []).some(chart => /PETR4|BBAS3|HGLG11/.test(chart.title)), 'Comparadores não devem usar o próprio ticker como índice falso');

const badProfitQuote = buildAnalysisPageResponse({
  ticker: 'PETR4',
  assetClass: 'ACAO',
  assetChartBundle: {
    profitVsQuote: [{ year: '2024', value: 98000000000, secondaryValue: 0 }]
  }
}, { ticker: 'PETR4' });
assert.ok(!chartIds(badProfitQuote).has('profit_vs_quote'), 'Lucro x Cotação não deve renderizar série zerada ou sem cotação real alinhada');

const validProfitQuote = buildAnalysisPageResponse({
  ticker: 'PETR4',
  assetClass: 'ACAO',
  assetChartBundle: {
    profitVsQuote: [{ year: '2023', value: 30, secondaryValue: 124000000000 }, { year: '2024', value: 39, secondaryValue: 98000000000 }]
  }
}, { ticker: 'PETR4' });
assert.ok(chartIds(validProfitQuote).has('profit_vs_quote'), 'Lucro x Cotação deve renderizar quando houver cotação e lucro reais em ao menos 2 períodos');


const badRevenueProfit = buildAnalysisPageResponse({
  ticker: 'PETR4',
  assetClass: 'ACAO',
  assetChartBundle: {
    revenueProfit: [
      { year: '2023', netRevenue: 510000000000 },
      { year: '2024', netRevenue: 490000000000, netProfit: 98000000000 }
    ]
  }
}, { ticker: 'PETR4' });
assert.ok(!(badRevenueProfit.sections.find(section => section.id === 'asset_charts')?.charts || []).some(chart => chart.id === 'revenue_profit'), 'Receitas e Lucros não deve montar multi_line quando receita/lucro não têm 2 períodos em comum');

const screen = readOptionalApkFile('../apk/app/src/main/java/com/example/ui/AnalysisScreen.kt');
assertOptionalMatch(screen, /Canvas/);
assertOptionalMatch(screen, /RichAnalysisChart/);
assertOptionalMatch(screen, /AnalysisCanvasChart/);
assertOptionalDoesNotMatch(screen, /MiniBarChart/);
assertOptionalDoesNotMatch(screen, /iframe|WebView|HTML/i);

console.log('Checkpoint 28 real analysis charts test OK.');
