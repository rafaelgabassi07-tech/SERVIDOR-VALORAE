import assert from 'node:assert/strict';
import fs from 'node:fs';
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
    indexComparison: [{ name: 'IBOV', points: [{ label: 'Jan', value: 2.1 }, { label: 'Fev', value: 3.8 }] }]
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
    indexComparison: [{ name: 'IFIX', points: [{ label: 'Jan', value: 1.2 }, { label: 'Fev', value: 2.4 }] }]
  }
}, { ticker: 'HGLG11' });

const fiiCharts = chartIds(fiiResponse);
for (const required of ['fii_monthly_distribution', 'dividend_yield_history', 'fii_patrimonial_value', 'fii_asset_distribution']) {
  assert.ok(fiiCharts.has(required), `FII deve expor gráfico estruturado ${required}`);
}
assert.ok(fiiResponse.sections.find(section => section.id === 'comparisons')?.charts.some(chart => chart.title.includes('IFIX')));
assert.ok(!fiiResponse.missingSignals.some(signal => signal.id === 'asset_charts'));

const screen = fs.readFileSync('../apk/app/src/main/java/com/example/ui/AnalysisScreen.kt', 'utf8');
assert.match(screen, /Canvas/);
assert.match(screen, /RichAnalysisChart/);
assert.match(screen, /AnalysisCanvasChart/);
assert.doesNotMatch(screen, /MiniBarChart/);
assert.doesNotMatch(screen, /iframe|WebView|HTML/i);

console.log('Checkpoint 28 real analysis charts test OK.');
