import assert from 'node:assert/strict';
import { buildAnalysisPageResponse } from '../lib/analysis/analysis-page-response.js';

const stockResponse = buildAnalysisPageResponse({
  ticker: 'PETR4',
  assetClass: 'ACAO',
  currentPrice: 39.42,
  statements: {
    incomeStatement: [
      { year: '2023', netRevenue: 500000000, grossProfit: 220000000, ebit: 180000000, ebitda: 210000000, netProfit: 110000000 },
      { year: '2024', netRevenue: 620000000, grossProfit: 250000000, ebit: 190000000, ebitda: 230000000, netProfit: 120000000 }
    ],
    balanceSheet: [
      { year: '2023', totalAssets: 900000000, totalLiabilities: 400000000, netWorth: 500000000, grossDebt: 100000000, netDebt: 70000000, cash: 30000000 },
      { year: '2024', totalAssets: 1000000000, totalLiabilities: 450000000, netWorth: 550000000, grossDebt: 120000000, netDebt: 80000000, cash: 40000000 }
    ],
    cashFlowStatement: [
      { year: '2023', operatingCashFlow: 130000000, investingCashFlow: -50000000, financingCashFlow: -30000000 },
      { year: '2024', operatingCashFlow: 150000000, investingCashFlow: -60000000, financingCashFlow: -40000000 }
    ]
  }
}, { ticker: 'PETR4' });

const financialStatements = stockResponse.sections.find(section => section.id === 'financial_statements');
assert.ok(financialStatements, 'financial_statements precisa existir no AnalysisPageResponse');
assert.equal(financialStatements.status, 'ready');
assert.ok(financialStatements.items.some(item => item.label.includes('DRE • Receita líquida • 2024')));
assert.ok(financialStatements.items.some(item => item.label.includes('DRE • Lucro líquido • 2024')));
assert.ok(financialStatements.items.some(item => item.label.includes('Balanço • Ativos • 2024')));
assert.ok(financialStatements.items.some(item => item.label.includes('Balanço • Dívida líquida • 2024')));
assert.ok(financialStatements.items.some(item => item.label.includes('Fluxo de Caixa • Fluxo operacional • 2024')));
assert.ok(financialStatements.items.some(item => item.label.includes('Fluxo de Caixa • Fluxo de investimento • 2024')));
assert.ok(financialStatements.items.some(item => item.label.includes('Fluxo de Caixa • Fluxo de financiamento • 2024')));
assert.ok(financialStatements.charts.some(chart => chart.id === 'income_statement_statement'));
assert.ok(financialStatements.charts.some(chart => chart.id === 'balance_sheet_statement'));
assert.ok(financialStatements.charts.some(chart => chart.id === 'cash_flow_statement'));
assert.ok(financialStatements.charts.every(chart => chart.series.every(serie => serie.points.length >= 2)), 'gráficos financeiros só devem sair com séries reais de pelo menos dois períodos');
assert.ok(!stockResponse.missingSignals.some(signal => signal.id === 'financial_statements'), 'financial_statements não deve aparecer como pendente quando há demonstrativos reais');

const nestedResponse = buildAnalysisPageResponse({
  ticker: 'BBAS3',
  assetClass: 'ACAO',
  results: {
    sections: {
      demonstrativos: {
        dre: {
          receitaLiquida: { '2022': 1000000, '2023': 1200000 },
          lucroLiquido: { '2022': 200000, '2023': 300000 }
        },
        balancoPatrimonial: {
          '2023': { ativos: 5000000, passivos: 2500000, patrimonioLiquido: 2500000 }
        },
        fluxoCaixa: [
          { period: '2022', fluxoOperacional: 210000, fluxoInvestimento: -80000, fluxoFinanciamento: -60000 },
          { period: '2023', fluxoOperacional: 280000, fluxoInvestimento: -90000, fluxoFinanciamento: -70000 }
        ]
      }
    }
  }
}, { ticker: 'BBAS3' });
const nestedStatements = nestedResponse.sections.find(section => section.id === 'financial_statements');
assert.equal(nestedStatements.status, 'ready');
assert.ok(nestedStatements.items.some(item => item.label.includes('DRE • Receita líquida • 2023')));
assert.ok(nestedStatements.items.some(item => item.label.includes('Balanço • Patrimônio líquido • 2023')));
assert.ok(nestedStatements.items.some(item => item.label.includes('Fluxo de Caixa • Fluxo operacional • 2023')));

const emptyResponse = buildAnalysisPageResponse({ ticker: 'VAZIO3', assetClass: 'ACAO' }, { ticker: 'VAZIO3' });
const emptyStatements = emptyResponse.sections.find(section => section.id === 'financial_statements');
assert.equal(emptyStatements.status, 'empty');
assert.ok(emptyResponse.missingSignals.some(signal => signal.id === 'financial_statements'), 'sem demonstrativos reais, seção deve ser sinalizada como indisponível');
