import assert from 'node:assert/strict';
import { buildInvestidor10CanonicalCharts } from '../lib/market/investidor10-chart-extractor.js';
import { _test } from '../lib/analysis/analysis-page-response.js';

const stockHtml = `
  <h1>PETR4</h1>
  SOBRE A EMPRESA PETROLEO BRASILEIRO S.A. PETROBRAS
  SOBRE A EMPRESA
  A Petróleo Brasileiro S.A. ou Petrobras é uma empresa petrolífera brasileira que atua no setor e subsetor de petroleo gás e biocombustiveis.
  Uma das maiores empresas do mundo de petróleo, gás natural e derivados, a Petrobras é responsável pela exploração, produção, refino e comercialização de petróleo e derivados.
  Informações Adicionais
  A empresa Petrobras, está listada na B3 com um valor de mercado de R$ 517,31 Bilhões, tendo um patrimônio de R$ 445,19 Bilhões.
  Nos últimos 12 meses a empresa teve um faturamento de R$ 498,09 Bilhões, que gerou um lucro no valor de R$ 108,04 Bilhões.
  Quanto aos seus principais indicadores
  DADOS SOBRE A EMPRESA Nome da Empresa PETROLEO BRASILEIRO S.A. PETROBRAS CNPJ 33.000.167/0001-01 Ano de fundação 1953 Número de funcionários 61.550
`;
const stock = buildInvestidor10CanonicalCharts({ ticker: 'PETR4', type: 'ACAO', html: stockHtml });
assert.match(stock.presentation.summary, /Petrobras.*empresa petrolífera.*Uma das maiores empresas/i, 'apresentação deve preservar mais de uma frase real do Investidor10');
assert.ok(stock.presentation.paragraphs.some(paragraph => /valor de mercado/i.test(paragraph)), 'Informações Adicionais precisa entrar nos parágrafos da apresentação');

const fiiHtml = `
  <h1>HGLG11</h1>
  INFORMAÇÕES SOBRE HGLG11
  Razão Social CSHG LOGÍSTICA - FUNDO DE INVESTIMENTO IMOBILIÁRIO
  CNPJ 11.728.688/0001-47 PÚBLICO-ALVO Geral MANDATO Renda SEGMENTO Logístico / Indústria / Galpões TIPO DE FUNDO Fundo de Tijolo TIPO DE GESTÃO Ativa TAXA DE ADMINISTRAÇÃO 0,60% a.a
  Distribuições nos últimos 12 meses
  YIELD 1 MÊS 0,74% R$ 1,10 YIELD 3 MESES 2,21% R$ 3,30 YIELD 6 MESES 4,41% R$ 6,60 YIELD 12 MESES 8,82% R$ 13,20
  DIVIDEND YIELD HGLG11
  DY atual: 8,82% DY médio em 5 anos: 8,60%
  HGLG11 pagou o total de R$ 13,20 nos últimos 12 meses. HGLG11 costuma pagar dividendos mensais. Nos últimos 12 meses, distribuiu um total de R$ 13,20 por cota, com uma média mensal de R$ 1,10.
  Informações sobre valor patrimonial
  VALOR PATRIMONIAL POR COTA R$ 166,00 VALOR DA COTA R$ 149,65 NÚMERO DE COTAS 45,60 Milhões P/VP 0,90 VALOR PATRIMONIAL R$ 7,57 Bilhões
`;
const fii = buildInvestidor10CanonicalCharts({ ticker: 'HGLG11', type: 'FII', html: fiiHtml });
assert.equal(fii.fii.info['DY atual'], '8,82%', 'DY atual do bloco Investidor10 deve ser preservado');
assert.equal(fii.fii.info['Valor patrimonial por cota'], 'R$ 166,00', 'valor patrimonial por cota deve ser extraído do bloco patrimonial');
assert.equal(fii.fii.patrimonialSummary['P/VP'], '0,90', 'P/VP patrimonial deve chegar em resumo próprio');
assert.equal(fii.fii.distribution12m.length, 4, 'distribuições 1/3/6/12 meses devem continuar preservadas');

const charts = _test.buildAssetCharts({
  ticker: 'PETR4',
  type: 'ACAO',
  assetChartBundle: {
    revenueProfit: [
      { label: '2021', netRevenue: 100, grossProfit: 60, ebitda: 50, ebit: 42, netProfit: 20 },
      { label: '2022', netRevenue: 120, grossProfit: 70, ebitda: 55, ebit: 46, netProfit: 25 },
      { label: '2023', netRevenue: 140, grossProfit: 78, ebitda: 61, ebit: 52, netProfit: 29 }
    ],
    equityEvolution: [
      { label: '2021', netWorth: 200, totalAssets: 500, totalLiabilities: 300, netDebt: 80, cash: 35 },
      { label: '2022', netWorth: 230, totalAssets: 560, totalLiabilities: 330, netDebt: 90, cash: 38 },
      { label: '2023', netWorth: 260, totalAssets: 620, totalLiabilities: 360, netDebt: 95, cash: 42 }
    ]
  }
});
const revenue = charts.find(chart => chart.id === 'revenue_profit');
assert.equal(revenue.series.length, 5, 'receitas/lucros deve preservar 5 séries alinhadas');
assert.ok(revenue.series.every(serie => serie.points.map(point => point.label).join('|') === '2021|2022|2023'), 'todas as séries do gráfico precisam usar os mesmos períodos');
const equity = charts.find(chart => chart.id === 'equity_evolution');
assert.equal(equity.series.length, 5, 'balanço deve aceitar PL, ativos, passivos, dívida líquida e disponibilidade');
assert.ok(equity.series.every(serie => serie.points.length === 3), 'séries patrimoniais precisam chegar alinhadas para o APK');

console.log('Investidor10 source chart second pass v177 test OK.');

import { buildMobileScraperAssetContract } from '../lib/compat/mobile-scraper-contract.js';
const mobileContract = buildMobileScraperAssetContract({
  ticker: 'PETR4',
  type: 'ACAO',
  rawJson: { html: '<script>debug</script>' },
  sourceDiagnostics: { apiStatus: ['debug'] },
  results: {
    assetChartsCanonical: {
      ticker: 'PETR4',
      type: 'ACAO',
      presentation: { title: 'Apresentação da empresa PETR4', summary: 'Petrobras atua no setor de petróleo e gás.', paragraphs: ['Petrobras atua no setor de petróleo e gás.'] },
      financial: { revenueProfit: [{ label: '2023', netRevenue: 100, netProfit: 20 }] }
    }
  }
});
const serializedMobile = JSON.stringify(mobileContract).toLowerCase();
assert.ok(!serializedMobile.includes('rawjson'), 'contrato mobile público não deve vazar rawJson');
assert.ok(!serializedMobile.includes('sourcediagnostics'), 'contrato mobile público não deve vazar diagnostics de fonte');
assert.ok(!serializedMobile.includes('legacyfield'), 'contrato mobile público não deve vazar campo técnico legacyField');
assert.ok(!serializedMobile.includes('debug'), 'contrato mobile público não deve vazar debug');
