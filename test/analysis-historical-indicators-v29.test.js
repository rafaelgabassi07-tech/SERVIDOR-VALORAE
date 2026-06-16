import assert from 'node:assert/strict';
import { buildAnalysisPageResponse } from '../lib/analysis/analysis-page-response.js';

const stockResponse = buildAnalysisPageResponse({
  ticker: 'BBAS3',
  assetClass: 'ACAO',
  currentPrice: 28.4,
  historicoIndicadores: {
    colunas: ['2025', '2024', '2023'],
    linhas: [
      { indicador: 'P/L', valores: { '2025': '4,20', '2024': '4,90', '2023': '5,30' } },
      { indicador: 'P/VP', valores: { '2025': '0,92', '2024': '0,86', '2023': '0,79' } },
      { indicador: 'Dividend Yield', valores: { '2025': '9,10%', '2024': '8,20%', '2023': '7,40%' } },
      { indicador: 'ROE', valores: { '2025': '21,40%', '2024': '19,70%', '2023': '18,10%' } },
      { indicador: 'ROIC', valores: { '2025': '15,10%', '2024': '14,30%', '2023': '13,00%' } },
      { indicador: 'Margem Líquida', valores: { '2025': '18,10%', '2024': '17,20%', '2023': '16,90%' } },
      { indicador: 'Dívida Líquida / Patrimônio', valores: { '2025': '0,52', '2024': '0,57', '2023': '0,61' } },
      { indicador: 'Liquidez Corrente', valores: { '2025': '1,40', '2024': '1,35', '2023': '1,29' } },
      { indicador: 'CAGR Receitas 5 anos', valores: { '2025': '7,20%', '2024': '6,90%', '2023': '6,20%' } },
      { indicador: 'CAGR Lucros 5 anos', valores: { '2025': '8,50%', '2024': '8,10%', '2023': '7,00%' } }
    ]
  }
}, { ticker: 'BBAS3' });

const stockHist = stockResponse.sections.find(section => section.id === 'historical_indicators');
assert.equal(stockHist.status, 'ready');
assert.ok(stockHist.items.length >= 24, 'Ações devem expor tabela histórica ampla');
for (const required of ['P/L', 'P/VP', 'Dividend Yield', 'ROE', 'ROIC', 'Margem Líquida', 'Dívida Líquida / Patrimônio', 'Liquidez Corrente', 'Crescimento de Receita', 'Crescimento de Lucro']) {
  assert.ok(stockHist.items.some(item => item.label.includes(required)), `Histórico de Ação deve incluir ${required}`);
}
assert.ok(stockHist.charts.length >= 4, 'Histórico de Ação deve gerar gráficos quando houver série confiável');
assert.ok(!stockResponse.missingSignals.some(signal => signal.id === 'historical_indicators'));

const fiiResponse = buildAnalysisPageResponse({
  ticker: 'HGLG11',
  assetClass: 'FII',
  currentPrice: 160,
  results: {
    historicoIndicadores: {
      colunas: ['2025', '2024', '2023'],
      linhas: [
        { indicador: 'P/VP', valores: { '2025': '1,03', '2024': '0,98', '2023': '0,94' } },
        { indicador: 'Dividend Yield', valores: { '2025': '8,20%', '2024': '8,00%', '2023': '7,70%' } },
        { indicador: 'Vacância Física', valores: { '2025': '2,50%', '2024': '3,10%', '2023': '4,00%' } },
        { indicador: 'Valor Patrimonial por Cota', valores: { '2025': 'R$ 155,20', '2024': 'R$ 150,10', '2023': 'R$ 144,00' } },
        { indicador: 'Rendimento por Cota', valores: { '2025': 'R$ 1,20', '2024': 'R$ 1,15', '2023': 'R$ 1,05' } },
        { indicador: 'Número de Cotistas', valores: { '2025': '420.000', '2024': '390.000', '2023': '350.000' } },
        { indicador: 'Liquidez Média Diária', valores: { '2025': 'R$ 8.500.000', '2024': 'R$ 7.900.000', '2023': 'R$ 7.100.000' } }
      ]
    }
  }
}, { ticker: 'HGLG11' });

const fiiHist = fiiResponse.sections.find(section => section.id === 'historical_indicators');
assert.equal(fiiHist.status, 'ready');
for (const required of ['P/VP', 'Dividend Yield', 'Vacância', 'Valor Patrimonial por Cota', 'Rendimento por Cota', 'Número de Cotistas', 'Liquidez']) {
  assert.ok(fiiHist.items.some(item => item.label.includes(required)), `Histórico de FII deve incluir ${required}`);
}
assert.ok(fiiHist.charts.length >= 3, 'FII deve gerar gráficos históricos quando houver ao menos 2 pontos reais');
assert.ok(!fiiResponse.missingSignals.some(signal => signal.id === 'historical_indicators'));

const noHistory = buildAnalysisPageResponse({ ticker: 'PETR4', assetClass: 'ACAO', currentPrice: 39 }, { ticker: 'PETR4' });
const emptyHist = noHistory.sections.find(section => section.id === 'historical_indicators');
assert.equal(emptyHist.status, 'empty');
assert.ok(noHistory.missingSignals.some(signal => signal.id === 'historical_indicators'), 'Sem histórico real, a seção deve ser sinalizada como indisponível');

console.log('Checkpoint 29 historical indicators test OK.');
