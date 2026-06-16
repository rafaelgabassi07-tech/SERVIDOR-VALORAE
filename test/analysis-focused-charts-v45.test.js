import assert from 'node:assert/strict';
import { buildAnalysisPageResponse } from '../lib/analysis/analysis-page-response.js';
import { buildInvestidor10CanonicalCharts } from '../lib/market/investidor10-chart-extractor.js';

function section(response, id) {
  return response.sections.find(item => item.id === id);
}

const canonical = buildInvestidor10CanonicalCharts({
  ticker: 'PETR4',
  type: 'ACAO',
  html: '<html><body><h2>LUCRO X COTAÇÃO</h2><h2>BALANÇO PATRIMONIAL</h2></body></html>',
  apiExtras: {
    chartsFinanceiros: {
      lucroCotacao: {
        labels: ['2022', '2023', '2024'],
        datasets: [
          { label: 'Cotação', data: [22.5, 31.2, 38.9] },
          { label: 'Lucro Líquido', data: [188000000000, 124000000000, 98000000000] }
        ]
      },
      evolucaoPatrimonio: {
        labels: ['2022', '2023', '2024'],
        datasets: [
          { label: 'Ativo Total', data: [980000000000, 1002000000000, 1010000000000] },
          { label: 'Passivo Total', data: [610000000000, 604000000000, 600000000000] },
          { label: 'Patrimônio Líquido', data: [370000000000, 398000000000, 410000000000] }
        ]
      }
    }
  }
});

assert.equal(canonical.financial.profitVsQuote.length, 3, 'Lucro x Cotação precisa capturar todos os períodos reais da API/HTML');
assert.ok(canonical.financial.profitVsQuote.every(point => Number.isFinite(point.quote) && Number.isFinite(point.profit)), 'Lucro x Cotação precisa preservar cotação e lucro em cada período');
assert.equal(canonical.financial.balanceSheet.length, 3, 'Balanço por período precisa capturar os períodos reais da fonte');
assert.ok(canonical.financial.balanceSheet.every(point => Number.isFinite(point.totalAssets) && Number.isFinite(point.totalLiabilities) && Number.isFinite(point.netWorth)), 'Balanço precisa preservar ativos, passivos e PL quando a fonte envia as três séries');

const response = buildAnalysisPageResponse({
  ticker: 'PETR4',
  assetClass: 'ACAO',
  assetChartBundle: {
    profitVsQuote: canonical.financial.profitVsQuote,
    balanceSheet: canonical.financial.balanceSheet
  },
  chartsFinanceiros: {
    evolucaoPatrimonio: {
      labels: ['2022', '2023', '2024'],
      datasets: [
        { label: 'Ativo Total', data: [980000000000, 1002000000000, 1010000000000] },
        { label: 'Passivo Total', data: [610000000000, 604000000000, 600000000000] },
        { label: 'Patrimônio Líquido', data: [370000000000, 398000000000, 410000000000] }
      ]
    }
  }
}, { ticker: 'PETR4' });

const profitChart = section(response, 'asset_charts').charts.find(chart => chart.id === 'profit_vs_quote');
assert.ok(profitChart, 'Lucro x Cotação precisa chegar no contrato da Análise');
assert.equal(profitChart.chartType, 'multi_line', 'APK deve receber tipo multi_line para desenhar duas linhas');
assert.deepEqual(profitChart.series.map(serie => serie.label), ['Cotação (base 100)', 'Lucro (base 100)']);
assert.ok(profitChart.series.every(serie => serie.points.length === 3), 'Lucro x Cotação deve manter as duas séries alinhadas');
assert.ok(profitChart.series.every(serie => serie.points.every(point => point.display && point.rawValue !== undefined)), 'Lucro x Cotação deve manter display e valor real bruto sem simulação');

const statements = section(response, 'financial_statements');
const balanceChart = statements.charts.find(chart => chart.id === 'balance_sheet_statement');
assert.ok(balanceChart, 'Balanço por período precisa chegar na seção de demonstrativos');
assert.equal(balanceChart.chartType, 'grouped_bar');
assert.ok(balanceChart.series.length >= 3, 'Balanço deve preservar Ativos, Passivos e PL quando presentes');
assert.deepEqual(balanceChart.series.map(serie => serie.points.map(point => point.label)), [
  ['2022', '2023', '2024'],
  ['2022', '2023', '2024'],
  ['2022', '2023', '2024']
], 'Balanço agrupado precisa chegar alinhado por período para o APK não desenhar barras fora do período correto');

const revenue = buildAnalysisPageResponse({
  ticker: 'GRND3',
  assetClass: 'ACAO',
  revenue_geography: { labels: ['Brasil', 'Exterior'], datasets: [{ label: '2025', data: [67.5, 32.5] }] },
  revenue_segment: { labels: ['Calçados', 'Outros'], datasets: [{ label: '2025', data: [82.4, 17.6] }] }
}, { ticker: 'GRND3' });
const revenueSection = section(revenue, 'revenue_breakdown');
assert.ok(revenueSection.charts.length >= 2);
assert.ok(revenueSection.charts.every(chart => chart.chartType === 'donut_composition'), 'Negócios e regiões devem chegar como composição, não como barras obrigatórias');
assert.ok(revenueSection.charts.every(chart => chart.series.every(serie => serie.points.every(point => point.value > 0 && point.value <= 100))));

console.log('Analysis focused charts v45 test OK.');
