import assert from 'node:assert/strict';
import { _test as analysisTest } from '../lib/analysis/analysis-page-response.js';
import { _test as assetTest } from '../lib/sources/asset-details.js';

const statusInvestStockHtml = `
  # BBAS3 - BANCO BRASIL
  Valor atual R$ 19,40 arrow_upward 0,05%
  Min. 52 semanas R$ 18,11 Min. mês R$ 19,00
  Máx. 52 semanas R$ 27,52 Máx. mês R$ 20,08
  Dividend Yield 2,84 % Últimos 12 meses R$ 0,5507
  Valorização (12m) arrow_downward -9,81% Mês atual arrow_downward -3,39%
  Volatilidade histórica 28,32% Tipo Ordinária Tag Along 100% Liq. méd. diária R$ 497.605.322 PART. IBOV 2,31% MERCADO DE OPÇÕES Sim
  aluguel de ações do BBAS3 DATA BASE - 27/03/2024 TOMADOR (média) 0,19 % MIN. 0,01% MAX. 1,09% DOADOR (média) 0,19 % MIN. 0,01% MAX. 1,09%
`;
const stockDeep = assetTest.extractPageDeepCoverageFromHtml(statusInvestStockHtml, 'https://statusinvest.com.br/acoes/bbas3', 'BBAS3');
assert.ok(stockDeep.sourceFacts.some(row => row.label === 'Min. mês' && row.value === 'R$ 19,00'));
assert.ok(stockDeep.sourceFacts.some(row => row.label === 'Valorização (12m)' && row.value === '-9,81%'));
assert.ok(stockDeep.sourceFacts.some(row => row.label === 'Tomador média' && row.value === '0,19 %'));
assert.equal(stockDeep.indicators.minMonth, 'R$ 19,00');
assert.equal(stockDeep.indicators.monthVariation, '-3,39%');

const stockPage = analysisTest.buildAnalysisPageResponse({ ticker: 'BBAS3', assetClass: 'ACAO', ...stockDeep }, { ticker: 'BBAS3', type: 'ACAO' });
const market = stockPage.sections.find(section => section.id === 'market_context');
const governance = stockPage.sections.find(section => section.id === 'governance_events');
assert.equal(market.status, 'ready');
assert.ok(market.items.some(item => item.label === 'Variação no mês' || item.label === 'Mês atual'));
assert.ok(market.items.some(item => item.label === 'Tomador média'));
assert.equal(governance.status, 'ready');

const investidor10FiiHtml = `
  ## INFORMAÇÕES SOBRE HGLG11
  Razão Social CSHG LOGÍSTICA - FUNDO DE INVESTIMENTO IMOBILIÁRIO
  CNPJ 11.728.688/0001-47
  PÚBLICO-ALVO Geral
  MANDATO Renda
  SEGMENTO Logístico / Indústria / Galpões
  TIPO DE FUNDO Fundo de Tijolo
  PRAZO DE DURAÇÃO Indeterminado
  TIPO DE GESTÃO Ativa
  TAXA DE ADMINISTRAÇÃO 0,60% a.a
  VACÂNCIA 3,90%
  NUMERO DE COTISTAS 573.381
  COTAS EMITIDAS 45.601.734
  VAL. PATRIMONIAL P/ COTA R$ 166,00
  VALOR PATRIMONIAL R$ 7,57 Bilhões
  ÚLTIMO RENDIMENTO R$ 1,10
  ## HISTÓRICO DE INDICADORES FUNDAMENTALISTAS
  ## Informações Adicionais
  O fundo HGLG11, de CNPJ 11.728.688/0001-47, possui atualmente um total de 45.601.745 cotas que estão divididas entre 573.386 cotistas.
`;
const i10Fii = assetTest.extractInvestidor10FiiInfoFactsFromHtml(investidor10FiiHtml);
assert.equal(i10Fii.info.tipoFundo, 'Fundo de Tijolo');
assert.equal(i10Fii.info.numeroCotistas, '573.381');
assert.ok(i10Fii.rows.some(row => row.label === 'CNPJ'));

const fiiPage = analysisTest.buildAnalysisPageResponse({ ticker: 'HGLG11', assetClass: 'FII', results: { sections: { fundo: { informacoesFundo: i10Fii.info, sourceFacts: i10Fii.rows } } } }, { ticker: 'HGLG11', type: 'FII' });
const details = fiiPage.sections.find(section => section.id === 'fii_details');
assert.equal(details.status, 'ready');
assert.ok(details.items.some(item => item.label === 'Tipo de fundo' && item.value === 'Fundo de Tijolo'));
assert.ok(details.items.some(item => item.label === 'Cotistas'));

const statusInvestFiiHtml = `
  Último rendimento R$ 1,1000 Rendimento 0,7064 % Cotação base R$ 155,71 Data Base 29/05/2026 Data Pagamento 15/06/2026 Próximo Rendimento R$ -
  Ano passado R$ 5,5000 Ano atual R$ 5,5000
  <script>window.__NUXT_DATA__={}</script><table><tr><td>Resultado</td></tr></table><script type="application/ld+json">{}</script><script>Highcharts.chart('x',{series:[]})</script>
`;
const fiiDividend = assetTest.extractStatusInvestFiiDividendSnapshotFromHtml(statusInvestFiiHtml);
assert.ok(fiiDividend.some(row => row.label === 'Último rendimento' && row.value === 'R$ 1,1000'));
assert.ok(fiiDividend.some(row => row.label === 'Data de pagamento do último rendimento'));
const technology = assetTest.extractPageDeepCoverageFromHtml(statusInvestFiiHtml, 'https://statusinvest.com.br/fundos-imobiliarios/hglg11', 'HGLG11').sourceExtractionTechnologies;
assert.ok(technology.some(row => row.id === 'html_tables'));
assert.ok(technology.some(row => row.id === 'nuxt_payload'));
assert.ok(technology.some(row => row.id === 'json_ld'));
assert.ok(technology.some(row => row.id === 'chart_library_state'));

console.log('Analysis source HTML deep v55 test OK.');
