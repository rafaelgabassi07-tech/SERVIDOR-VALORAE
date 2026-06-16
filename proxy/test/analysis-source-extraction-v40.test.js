import assert from 'node:assert/strict';
import { buildAnalysisPageResponse } from '../lib/analysis/analysis-page-response.js';

const payload = {
  ticker: 'GRND3',
  type: 'ACAO',
  precoAtual: 3.86,
  results: {
    assetChartsCanonical: {
      revenueGeography: {
        labels: ['Brasil', 'Exterior'],
        datasets: [{ data: [67.5, 32.5] }]
      },
      revenueSegment: {
        '2025': { Calçados: '82,4%', Outros: '17,6%' },
        '2024': { Calçados: '80,1%', Outros: '19,9%' }
      },
      financial: {
        incomeStatement: [
          { label: 'Receita Líquida', valores: { '2025': { value: 2800000000 }, '2024': { value: 2600000000 }, '2023': { value: 2400000000 } } },
          { label: 'Lucro Líquido', valores: { '2025': { value: 720000000 }, '2024': { value: 600000000 }, '2023': { value: 520000000 } } }
        ],
        balanceSheet: [
          { label: 'Ativo Total', valores: { '2025': { value: 4100000000 }, '2024': { value: 3900000000 }, '2023': { value: 3700000000 } } },
          { label: 'Patrimônio Líquido', valores: { '2025': { value: 3170000000 }, '2024': { value: 3050000000 }, '2023': { value: 2960000000 } } }
        ],
        cashFlowStatement: [
          { label: 'Fluxo operacional', valores: { '2025': { value: 620000000 }, '2024': { value: 580000000 }, '2023': { value: 510000000 } } }
        ]
      }
    }
  }
};

const response = buildAnalysisPageResponse(payload, { ticker: 'GRND3' });
const revenue = response.sections.find(section => section.id === 'revenue_breakdown');
assert.equal(revenue.status, 'ready');
assert.ok(revenue.charts.some(chart => chart.id === 'revenue_by_region'), 'deve montar gráfico de regiões com labels/datasets do Investidor10');
assert.ok(revenue.charts.some(chart => chart.id === 'revenue_by_business'), 'deve montar gráfico de negócios com bucket anual do Investidor10');
assert.ok(!String(revenue.message || '').toLowerCase().includes('proxy'), 'mensagem da seção não pode expor Proxy ao usuário final');

const statements = response.sections.find(section => section.id === 'financial_statements');
assert.equal(statements.status, 'ready');
assert.ok(statements.items.some(item => item.label.includes('DRE') && item.label.includes('2024')), 'DRE deve aceitar anos anteriores vindos de tabela anual');
assert.ok(statements.items.some(item => item.label.includes('Balanço') && item.label.includes('2023')), 'Balanço deve aceitar anos anteriores vindos de tabela anual');
assert.ok(statements.charts.some(chart => chart.id === 'income_statement_statement' && chart.series.some(series => series.points.length >= 3)), 'DRE deve gerar gráfico multi-período quando há histórico real');
assert.ok(statements.charts.some(chart => chart.id === 'balance_sheet_statement' && chart.series.some(series => series.points.length >= 3)), 'Balanço deve gerar gráfico multi-período quando há histórico real');
assert.ok(statements.charts.some(chart => chart.id === 'cash_flow_statement' && chart.series.some(series => series.points.length >= 3)), 'Fluxo de caixa deve gerar gráfico multi-período quando há histórico real');

const currentOnly = buildAnalysisPageResponse({
  ticker: 'GRND3',
  type: 'ACAO',
  financialChartsCanonical: {
    balanceSheet: [{ label: 'Ativo Total', value: 4100000000, year: '2025' }]
  }
}, { ticker: 'GRND3' });
const currentStatements = currentOnly.sections.find(section => section.id === 'financial_statements');
assert.ok(!currentStatements.charts.some(chart => chart.id === 'balance_sheet_statement'), 'Balanço de um único ano não deve virar gráfico histórico');

console.log('Analysis source extraction v40 test OK.');
