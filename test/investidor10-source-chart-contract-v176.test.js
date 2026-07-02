import assert from 'node:assert/strict';
import { buildInvestidor10CanonicalCharts } from '../lib/market/investidor10-chart-extractor.js';
import { _test } from '../lib/analysis/analysis-page-response.js';

const stockHtml = `
  <h1>PETR4</h1>
  COTAÇÃO PETR4 Rentabilidade Histórico de Indicadores Comparador de Ações
  SOBRE A EMPRESA A Petrobras é uma empresa brasileira que atua no setor de petróleo, gás e energia.
  Quanto aos seus principais indicadores
  DADOS SOBRE A EMPRESA Nome da Empresa PETROLEO BRASILEIRO SA Ano de fundação 1953 Número de funcionários 45000
  INFORMAÇÕES SOBRE A EMPRESA Valor de mercado R$ 500 Bilhões Valor de firma R$ 700 Bilhões Patrimônio Líquido R$ 350 Bilhões
  Regiões onde gera receita Receitas e Lucros Lucro x Cotação Evolução do Patrimônio Balanço Patrimonial
`;
const stockCanonical = buildInvestidor10CanonicalCharts({ ticker: 'PETR4', type: 'ACAO', html: stockHtml });
assert.match(stockCanonical.presentation.summary, /Petrobras.*petróleo/i, 'apresentação da empresa deve sair do bloco SOBRE A EMPRESA do Investidor10');
assert.equal(stockCanonical.company.info['Ano de fundação'], '1953', 'dados cadastrais da empresa devem ser preservados');
assert.equal(stockCanonical.available.presentation, true, 'coverage deve marcar apresentação disponível');

const fiiHtml = `
  <h1>HGLG11</h1>
  COTAÇÃO HGLG11 Rentabilidade
  INFORMAÇÕES SOBRE HGLG11 Razão Social CSHG LOGÍSTICA FII CNPJ 00.000.000/0001-00 MANDATO Renda
  TIPO DE FUNDO Fundo de Tijolo SEGMENTO Logístico TIPO DE GESTÃO Ativa TAXA DE ADMINISTRAÇÃO 0,6%
  HISTÓRICO DE INDICADORES COMPARAÇÃO DE HGLG11 COM ÍNDICES Distribuições nos últimos 12 meses
`;
const fiiCanonical = buildInvestidor10CanonicalCharts({ ticker: 'HGLG11', type: 'FII', html: fiiHtml });
assert.match(fiiCanonical.presentation.summary, /CSHG LOGÍSTICA FII.*Fundo de Tijolo.*Logístico/i, 'FII deve ganhar breve apresentação a partir dos campos reais da fonte');
assert.equal(fiiCanonical.fii.info['SEGMENTO'], 'Logístico', 'segmento do FII deve ser preservado');

const assetCharts = _test.buildAssetCharts({
  ticker: 'PETR4',
  type: 'ACAO',
  assetChartBundle: {
    revenueProfit: [
      { label: '2021', netRevenue: 100, grossProfit: 60, ebitda: 50, ebit: 40, netProfit: 20 },
      { label: '2022', netRevenue: 120, grossProfit: 70, ebitda: 55, ebit: 45, netProfit: 25 },
      { label: '2023', netRevenue: 140, grossProfit: 75, ebitda: 60, ebit: 50, netProfit: 28 }
    ],
    equityEvolution: [
      { label: '2021', netWorth: 200, totalAssets: 500, totalLiabilities: 300 },
      { label: '2022', netWorth: 230, totalAssets: 560, totalLiabilities: 330 },
      { label: '2023', netWorth: 260, totalAssets: 620, totalLiabilities: 360 }
    ]
  }
});
const revenue = assetCharts.find(chart => chart.id === 'revenue_profit');
assert.equal(revenue.chartType, 'grouped_bar', 'receitas/lucros deve ser enviado como gráfico de barras multi-série');
assert.equal(revenue.series.length, 5, 'receitas/lucros deve preservar mais de 2 séries quando a fonte trouxer EBITDA/EBIT/lucro bruto');
const equity = assetCharts.find(chart => chart.id === 'equity_evolution');
assert.equal(equity.chartType, 'grouped_bar', 'evolução patrimonial deve aceitar patrimônio/ativos/passivos no mesmo gráfico');
assert.equal(equity.series.length, 3, 'balanço/patrimônio deve preservar 3 séries alinhadas');

console.log('Investidor10 source chart contract v176 test OK.');
