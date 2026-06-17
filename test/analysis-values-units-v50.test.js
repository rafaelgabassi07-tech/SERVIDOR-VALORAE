import assert from 'node:assert/strict';
import { _test } from '../lib/analysis/analysis-page-response.js';

const payload = {
  ticker: 'TEST3',
  assetClass: 'ACAO',
  results: {
    financialChartsCanonical: {
      incomeStatement: [
        { year: '2023', netRevenue: 'R$ 1,20 bilhão', netProfit: '250 milhões' },
        { year: '2024', netRevenue: 'R$ 1,45 bi', netProfit: 'R$ 310 mi' }
      ],
      balanceSheet: [
        { year: '2023', totalAssets: '3,4 bilhões', totalLiabilities: '1,1 bilhão', netWorth: '2,3 bilhões' },
        { year: '2024', totalAssets: 'R$ 3,85 bi', totalLiabilities: 'R$ 1,25 bi', netWorth: 'R$ 2,60 bi' }
      ]
    }
  }
};

const items = _test.buildFinancialStatementItems(payload);
assert(items.some(item => item.label === 'DRE • Receita líquida • 2024' && item.value === 'R$ 1,45 bi'));
assert(items.some(item => item.label === 'DRE • Lucro líquido • 2023' && item.value === 'R$ 250,00 mi'));
assert(items.some(item => item.label === 'Balanço • Ativos • 2023' && item.value === 'R$ 3,40 bi'));
assert(items.some(item => item.label === 'Balanço • Patrimônio líquido • 2024' && item.value === 'R$ 2,60 bi'));

const charts = _test.buildFinancialStatementCharts(payload);
const dre = charts.find(chart => chart.id === 'income_statement_statement');
const balance = charts.find(chart => chart.id === 'balance_sheet_statement');
assert(dre, 'DRE chart should be generated from two real periods');
assert(balance, 'Balance sheet chart should be generated from two real periods');
assert.deepEqual(dre.series.find(s => s.id === 'netRevenue').points.map(p => p.value), [1_200_000_000, 1_450_000_000]);
assert.deepEqual(balance.series.find(s => s.id === 'totalAssets').points.map(p => p.value), [3_400_000_000, 3_850_000_000]);

console.log('Analysis units and statements v50 test OK.');
