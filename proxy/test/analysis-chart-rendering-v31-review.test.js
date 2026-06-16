import assert from 'node:assert/strict';
import fs from 'node:fs';
import { readOptionalApkFile, assertOptionalMatch, assertOptionalDoesNotMatch } from './_optional-apk.js';
import { buildAnalysisPageResponse } from '../lib/analysis/analysis-page-response.js';

const response = buildAnalysisPageResponse({
  ticker: 'PETR4',
  assetClass: 'ACAO',
  assetChartBundle: {
    priceHistory: [{ date: '2025-01-01', close: 30 }, { date: '2026-01-01', close: 39 }],
    dividendMonthly: [{ label: 'Jan/26', amount: 0.42 }, { label: 'Fev/26', amount: 0.51 }],
    dividendYieldHistory: [{ year: '2024', yieldPercent: 7.1 }, { year: '2025', yieldPercent: 8.2 }],
    revenueProfit: [{ year: '2023', netRevenue: 510000000000, netProfit: 124000000000 }, { year: '2024', netRevenue: 490000000000, netProfit: 98000000000 }],
    equityEvolution: [{ year: '2023', netWorth: 389000000000 }, { year: '2024', netWorth: 410000000000 }],
    payoutHistory: [{ year: '2023', value: 42 }, { year: '2024', value: 46 }]
  },
  statements: {
    incomeStatement: [
      { year: '2023', netRevenue: 500000000, netProfit: 110000000 },
      { year: '2024', netRevenue: 620000000, netProfit: 120000000 }
    ],
    cashFlowStatement: [
      { year: '2023', operatingCashFlow: 130000000, investingCashFlow: -50000000 },
      { year: '2024', operatingCashFlow: 150000000, investingCashFlow: -60000000 }
    ]
  }
}, { ticker: 'PETR4' });

const assetCharts = response.sections.find(section => section.id === 'asset_charts')?.charts || [];
const statementCharts = response.sections.find(section => section.id === 'financial_statements')?.charts || [];
const barExpected = new Set(['dividend_history', 'dividend_yield_history', 'revenue_profit', 'equity_evolution', 'payout_history', 'income_statement_statement', 'cash_flow_statement']);
for (const chart of [...assetCharts, ...statementCharts]) {
  if (barExpected.has(chart.id)) {
    assert.ok(['bar', 'grouped_bar'].includes(chart.chartType), `${chart.id} deve usar barras quando o dado é periódico/discreto`);
  }
}
const price = assetCharts.find(chart => chart.id === 'price_history');
assert.equal(price?.chartType, 'line', 'cotação histórica continua em linha por ser evolução contínua');

const fiiResponse = buildAnalysisPageResponse({
  ticker: 'HGLG11',
  assetClass: 'FII',
  assetChartBundle: {
    fiiAssetDistribution: { Atual: [{ name: 'Galpões', percentual: 65 }, { name: 'CRI', percentual: 25 }, { name: 'Caixa', percentual: 10 }] }
  }
}, { ticker: 'HGLG11' });
const distribution = fiiResponse.sections.find(section => section.id === 'asset_charts')?.charts.find(chart => chart.id === 'fii_asset_distribution');
assert.equal(distribution?.chartType, 'donut_composition', 'distribuição de ativos deve ser composição/donut, não barra');

const screen = readOptionalApkFile('../apk/app/src/main/java/com/example/ui/AnalysisScreen.kt');
assertOptionalMatch(screen, /isCompositionAnalysisChart/);
assertOptionalMatch(screen, /drawArc/);
assertOptionalMatch(screen, /isHorizontalBarAnalysisChart/);
assertOptionalMatch(screen, /drawRoundRect/);
assertOptionalDoesNotMatch(screen, /isBarLike/);

console.log('Analysis chart rendering review test OK.');
