import assert from 'node:assert/strict';
import { buildAnalysisPageResponse } from '../lib/analysis/analysis-page-response.js';

const payload = {
  ticker: 'GRND3',
  symbol: 'GRND3',
  assetClass: 'ACAO',
  price: 9.29,
  currentPrice: 9.29,
  quote: { price: 9.29, currentPrice: 9.29, updatedAt: '2026-06-17T21:22:00.000Z' },
  dividendYield: 7.1,
  pvp: 1.25,
  pl: 11.4,
  assetChartBundle: {
    priceHistory: [
      { label: 'D-2', close: 9.10 },
      { label: 'D-1', close: 9.20 }
    ],
    revenueProfit: [
      { label: '2024', revenue: 500, profit: 80 },
      { label: '2025', revenue: 560, profit: 92 }
    ]
  }
};

const page = buildAnalysisPageResponse(payload, { ticker: 'GRND3', surface: 'ranking_asset_modal' });
const surfaces = page.consumerContract.surfaces;
const analysisSurface = surfaces.find(surface => surface.id === 'analysis_page');
const rankingSurface = surfaces.find(surface => surface.id === 'ranking_asset_modal');
assert.ok(analysisSurface.readySectionIds.length >= rankingSurface.readySectionIds.length, 'analysis page keeps equal or greater section coverage');
assert.ok(rankingSurface.readySectionIds.includes('asset_charts'));
assert.ok(rankingSurface.readySectionIds.includes('summary'));
assert.ok(rankingSurface.readySectionIds.includes('fundamental_indicators'));
assert.ok(!rankingSurface.readySectionIds.includes('source_comparatives'), 'ranking modal must be curated, not full analysis');
assert.equal(page.consumerContract.version, '26.analysis.surface.v4');
assert.deepEqual(page.consumerContract.uiPolicy.modalCuratedSectionIds, [
  'realtime_quote_chart',
  'summary',
  'fundamental_indicators',
  'peer_fundamental_comparator',
  'company_profile',
  'dividends_history',
  'dividend_radar',
  'checklist',
  'fii_checklist',
  'revenue_profit_chart',
  'historical_indicators',
  'revenue_breakdown',
  'dividends_summary'
]);

const charts = page.sections.find(section => section.id === 'asset_charts')?.charts || [];
const quoteChart = charts.find(chart => chart.id === 'price_history');
assert.ok(quoteChart, 'price_history chart must exist');
assert.equal(quoteChart.title, 'Cotação em tempo real');
assert.ok(quoteChart.series[0].points.some(point => point.label === 'Agora' && point.value === 9.29));
assert.ok(charts.some(chart => chart.id === 'revenue_profit'), 'Receitas e Lucros chart must remain available for modal filtering');

console.log('Analysis curated modal realtime v61 test OK.');
