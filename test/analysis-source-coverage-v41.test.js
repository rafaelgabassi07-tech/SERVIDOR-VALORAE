import assert from 'node:assert/strict';
import { buildAnalysisPageResponse } from '../lib/analysis/analysis-page-response.js';

const stock = buildAnalysisPageResponse({
  ticker: 'GRND3',
  type: 'ACAO',
  min52Weeks: 3.49,
  max52Weeks: 4.94,
  dailyLiquidity: 12126082,
  tagAlong: '100%',
  openOptions: 79,
  revenue_geography: { labels: ['Brasil', 'Exterior'], datasets: [{ data: [67.5, 32.5] }] },
  revenue_segment: { '2025': { Calçados: '82,4%', Outros: '17,6%' } },
  chartsFinanceiros: {
    receitasLucros: {
      labels: ['2023', '2024', '2025'],
      datasets: [
        { label: 'Receita Líquida', data: [2400000000, 2600000000, 2800000000] },
        { label: 'Lucro Líquido', data: [520000000, 600000000, 720000000] }
      ]
    },
    evolucaoPatrimonio: {
      labels: ['2023', '2024', '2025'],
      datasets: [
        { label: 'Ativo Total', data: [3700000000, 3900000000, 4100000000] },
        { label: 'Patrimônio Líquido', data: [2960000000, 3050000000, 3170000000] }
      ]
    }
  },
  posicaoAcionaria: [
    { acionista: 'Controladores', percentualTotal: '64%' },
    { acionista: 'Free Float', percentualTotal: '36%' }
  ]
}, { ticker: 'GRND3' });

const market = stock.sections.find(section => section.id === 'market_context');
assert.equal(market.status, 'ready');
assert.ok(market.items.some(item => item.label === 'Mín. 52 semanas'));
assert.ok(market.items.some(item => item.label === 'Liquidez média diária'));

const statements = stock.sections.find(section => section.id === 'financial_statements');
assert.equal(statements.status, 'ready');
assert.ok(statements.charts.some(chart => chart.id === 'income_statement_statement' && chart.series.some(serie => serie.points.length >= 3)), 'DRE labels/datasets deve gerar gráfico multi-ano');
assert.ok(statements.charts.some(chart => chart.id === 'balance_sheet_statement' && chart.series.some(serie => serie.points.length >= 3)), 'Balanço labels/datasets deve gerar gráfico multi-ano');

const revenue = stock.sections.find(section => section.id === 'revenue_breakdown');
assert.equal(revenue.status, 'ready');
assert.ok(revenue.charts.some(chart => chart.id === 'revenue_by_region'));
assert.ok(revenue.charts.some(chart => chart.id === 'revenue_by_business'));

const ownership = stock.sections.find(section => section.id === 'ownership');
assert.equal(ownership.status, 'ready');
assert.ok(ownership.charts.some(chart => chart.id === 'ownership_distribution'));

assert.ok(stock.diagnostics.sourceCoverage.some(item => item.id === 'ownership' && item.status === 'implemented'));
assert.ok(stock.diagnostics.sourceCoverage.some(item => item.id === 'revenue_breakdown' && item.status === 'implemented'));

const fii = buildAnalysisPageResponse({
  ticker: 'GGRC11',
  type: 'FII',
  checklist_buy_hold: [
    { criterio: 'FII com mais de 5 anos listado em Bolsa', aprovado: true },
    { criterio: 'Liquidez média diária acima de R$ 700 mil', aprovado: true }
  ],
  min52Weeks: 8.74,
  max52Weeks: 10.31,
  dailyLiquidity: 5000000
}, { ticker: 'GGRC11' });
const checklist = fii.sections.find(section => section.id === 'fii_checklist');
assert.equal(checklist.status, 'ready');
assert.ok(checklist.items.some(item => item.value === 'Atende'));
assert.ok(!fii.sections.some(section => section.id === 'ownership'), 'posição acionária não deve aparecer para FII');
assert.ok(fii.diagnostics.sourceCoverage.some(item => item.id === 'fii_checklist' && item.status === 'implemented'));

const currentOnly = buildAnalysisPageResponse({
  ticker: 'GRND3',
  type: 'ACAO',
  chartsFinanceiros: {
    evolucaoPatrimonio: { labels: ['2025'], datasets: [{ label: 'Ativo Total', data: [4100000000] }] }
  }
}, { ticker: 'GRND3' });
const currentStatements = currentOnly.sections.find(section => section.id === 'financial_statements');
assert.ok(!currentStatements.charts.some(chart => chart.id === 'balance_sheet_statement'), 'um único ano ainda não pode virar gráfico de balanço por período');

console.log('Analysis source coverage v41 test OK.');
