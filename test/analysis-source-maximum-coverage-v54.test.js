import assert from 'node:assert/strict';
import { _test as analysisTest } from '../lib/analysis/analysis-page-response.js';
import { _test as assetTest } from '../lib/sources/asset-details.js';

const stockPayload = {
  ticker: 'BBAS3',
  assetClass: 'ACAO',
  sourceFacts: [
    { label: 'Tag Along', value: '100%', group: 'Governança', source: 'StatusInvestHTML.mercadoGovernanca' },
    { label: 'Mercado de opções', value: 'Sim', group: 'Mercado', source: 'StatusInvestHTML.mercadoGovernanca' }
  ],
  corporateEvents: [
    { label: 'Anúncio de subscrição', value: '10/06/2026', group: 'Eventos corporativos', source: 'StatusInvestHTML.eventos' },
    { label: 'Fator do split/grupamento', value: '1:2', group: 'Eventos corporativos', source: 'StatusInvestHTML.eventos' }
  ],
  checklistBuyHold: [
    { label: 'Empresa gera lucro recorrente', value: 'Atende', source: 'Investidor10HTML.checklist' }
  ]
};

const stockPage = analysisTest.buildAnalysisPageResponse(stockPayload, { ticker: 'BBAS3', type: 'ACAO' });
const governance = stockPage.sections.find(section => section.id === 'governance_events');
const checklist = stockPage.sections.find(section => section.id === 'checklist');
assert.equal(governance.status, 'ready');
assert.ok(governance.items.some(item => item.label === 'Tag Along' && item.value === '100%'));
assert.ok(governance.items.some(item => item.label === 'Anúncio de subscrição'));
assert.equal(checklist.status, 'ready');
assert.ok(checklist.items.some(item => item.label === 'Empresa gera lucro recorrente'));
assert.ok(stockPage.diagnostics.sourceCoverage.some(row => row.id === 'governance_events' && row.status === 'implemented'));
assert.ok(stockPage.diagnostics.sourceCoverage.some(row => row.id === 'checklist' && row.status === 'implemented'));

const statusInvestStockHtml = 'Volatilidade histórica 28,32% Tipo Ordinária Tag Along 100% Liq. méd. diária R$ 497.605.322 PART. IBOV 2,31% MERCADO DE OPÇÕES Sim DESDOBRAMENTO/GRUPAMENTO Data do anúncio 10/06/2026 Data COM 20/06/2026 Fator 1:2 SUBSCRIÇÃO Anúncio 02/05/2026 DATA COM 03/05/2026 Negociação 04/05/2026 Fim de subscrição 05/05/2026 Valor base R$ 10,00 Percentual 5,00% Ativo emitido BBAS3';
const stockDeep = assetTest.extractPageDeepCoverageFromHtml(statusInvestStockHtml, 'https://statusinvest.com.br/acoes/bbas3', 'BBAS3');
assert.ok(stockDeep.sourceFacts.some(row => row.label === 'Tag Along'));
assert.ok(stockDeep.corporateEvents.some(row => row.label === 'Fator do split/grupamento'));
assert.ok(stockDeep.sourceExtractionTechnologies.some(row => row.id === 'statusinvest_html'));

const investidor10ChecklistHtml = '<h2>Checklist do investidor buy and hold BBAS3</h2> Empresa com lucro nos últimos anos Dividend Yield acima da média do setor Liquidez diária adequada <h2>Histórico de Dividendos</h2>';
const i10Deep = assetTest.extractPageDeepCoverageFromHtml(investidor10ChecklistHtml, 'https://investidor10.com.br/acoes/bbas3/', 'BBAS3');
assert.ok(i10Deep.checklistBuyHold.length >= 1);
assert.ok(i10Deep.sourceExtractionTechnologies.some(row => row.id === 'investidor10_html'));

const fiiPayload = {
  ticker: 'HGLG11',
  assetClass: 'FII',
  statusInvestFiiAccounting: {
    cri: 'R$ 123.000.000,00',
    lci: 'R$ 45.000.000,00',
    lig: 'R$ 6.000.000,00',
    valoresReceber: 'R$ 7.000.000,00',
    rendimentosDistribuir: 'R$ 8.000.000,00',
    taxaPerformancePagar: 'R$ 9.000,00',
    obrigacoesAquisicaoImoveis: 'R$ 10.000.000,00'
  }
};
const fiiPage = analysisTest.buildAnalysisPageResponse(fiiPayload, { ticker: 'HGLG11', type: 'FII' });
const accounting = fiiPage.sections.find(section => section.id === 'fii_accounting');
assert.equal(accounting.status, 'ready');
assert.ok(accounting.items.some(item => item.label === 'CRI'));
assert.ok(accounting.items.some(item => item.label === 'LCI'));
assert.ok(accounting.items.some(item => item.label === 'LIG'));
assert.ok(accounting.items.some(item => item.label === 'Valores a receber'));
assert.ok(accounting.items.some(item => item.label === 'Rendimentos a distribuir'));
assert.ok(accounting.items.some(item => item.label === 'Taxa de performance a pagar'));

const statusInvestFiiHtml = 'Certificados de Recebíveis Imobiliários (CRI) - (R$) R$ 123.000.000,00 Letras de Crédito Imobiliário (LCI) - (R$) R$ 45.000.000,00 Letras Imobiliárias Garantidas (LIG) - (R$) R$ 6.000.000,00 Valores a Receber - (R$) R$ 7.000.000,00 Rendimentos a Distribuir - (R$) R$ 8.000.000,00 Taxa Performance a Pagar - (R$) R$ 9.000,00 Obrigações por Aquisição de Imóveis - (R$) R$ 10.000.000,00';
const extractedAccounting = assetTest.extractStatusInvestFiiAccountingFromHtml(statusInvestFiiHtml);
assert.equal(extractedAccounting.cri, 'R$ 123.000.000,00');
assert.equal(extractedAccounting.lci, 'R$ 45.000.000,00');
assert.equal(extractedAccounting.lig, 'R$ 6.000.000,00');
assert.equal(extractedAccounting.rendimentosDistribuir, 'R$ 8.000.000,00');

console.log('Analysis source maximum coverage v54 test OK.');
