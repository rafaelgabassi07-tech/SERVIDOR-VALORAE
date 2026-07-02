import assert from 'node:assert/strict';
import { buildInvestidor10CanonicalCharts } from '../lib/market/investidor10-chart-extractor.js';
import { _test } from '../lib/analysis/analysis-page-response.js';

const hglgNarrativeHtml = `
  <h1>HGLG11</h1>
  INFORMAÇÕES SOBRE HGLG11
  Razão Social PÁTRIA LOG - FUNDO DE INVESTIMENTO IMOBILIÁRIO
  CNPJ 11.728.688/0001-47 PÚBLICO-ALVO Geral MANDATO Renda SEGMENTO Logístico / Indústria / Galpões TIPO DE FUNDO Fundo de Tijolo TIPO DE GESTÃO Ativa TAXA DE ADMINISTRAÇÃO 0,60% a.a
  Sobre a PÁTRIA LOG
  O Pátria Log (HGLG11) é um fundo imobiliário com foco exclusivo em ativos logísticos e industriais. Criado em 2010, o fundo é atualmente gerido pela Pátria Investimentos e administrado pelo Banco Genial.
  Estratégia e composição
  O HGLG11 atua com foco em galpões logísticos e industriais, gerido pela Pátria Investimentos. O portfólio é composto por mais de 30 ativos distribuídos em 7 estados.
  Diversificação e exposição
  O portfólio inclui imóveis localizados principalmente no estado de São Paulo, além de ativos em Minas Gerais, Rio de Janeiro, Santa Catarina, Pernambuco e Goiás.
  Estrutura do fundo e taxas
  Como todo fundo, o HGLG11 distribui no mínimo 95% do resultado apurado em caixa aos cotistas, geralmente de forma mensal. A taxa de administração gira em torno de 0,6% ao ano sobre o valor de mercado.
  Informações Adicionais
  O fundo HGLG11 possui atualmente um total de 45.601.745 cotas que estão divididas entre 573.386 cotistas.
  Lista de Imóveis São Paulo 25 Minas Gerais 7 Rio de Janeiro 4 Pernambuco 2 Bahia 1 Goiás 1 Santa Catarina 1
`;

const fii = buildInvestidor10CanonicalCharts({ ticker: 'HGLG11', type: 'FII', html: hglgNarrativeHtml });
assert.ok(fii.presentation.summary.includes('fundo imobiliário com foco exclusivo em ativos logísticos'), 'FII deve preservar narrativa Sobre vinda do Investidor10');
assert.ok(fii.presentation.paragraphs.some(p => /galpões logísticos/i.test(p)), 'FII deve preservar Estratégia e composição');
assert.ok(fii.presentation.sections.some(section => section.title === 'Estratégia e composição'), 'Contrato curado deve enviar seções narrativas amigáveis');
assert.ok(!JSON.stringify(fii.presentation).toLowerCase().includes('rawhtml'), 'Apresentação pública não pode vazar HTML bruto');

const charts = _test.buildAssetCharts({
  ticker: 'PETR4',
  type: 'ACAO',
  assetChartBundle: {
    revenueProfit: [
      { label: '2021', netRevenue: 100, grossProfit: 60, ebitda: 50, ebit: 42, netProfit: 20 },
      { label: '2022', netRevenue: 120, grossProfit: 70, ebitda: 55, ebit: 46, netProfit: 25 },
      { label: '2023', netRevenue: 140, grossProfit: 78, ebit: 52, netProfit: 29 }
    ]
  }
});
const revenue = charts.find(chart => chart.id === 'revenue_profit');
assert.ok(revenue, 'quando uma série extra está incompleta, deve cair para gráfico seguro em vez de montar barras desalinhadas');
assert.ok(revenue.series.every(serie => serie.points.map(p => p.label).join('|') === revenue.series[0].points.map(p => p.label).join('|')), 'séries exibidas no APK precisam permanecer alinhadas por período');

console.log('Investidor10 source gap v178 test OK.');
