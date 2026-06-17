import assert from 'node:assert/strict';
import { _test as analysisTest } from '../lib/analysis/analysis-page-response.js';
import { _test as assetTest } from '../lib/sources/asset-details.js';

const statusInvestFiiHtml = `
  HGLG11 FII - Acompanhe o DY, valor patrimonial, histórico de dividendos, indicadores fundamentalistas e muito mais.
  Último rendimento R$ 1,1000 Rendimento 0,7064 % Cotação base R$ 155,71 Data Base 29/05/2026 Data Pagamento 15/06/2026
  Ano passado R$ 5,5000 Ano atual R$ 5,5000 Provisionado R$ 0,3300 Comparação + Provisionado 6,10%
  PORTFÓLIO DO HGLG11 <table><tr><td>Ativos - (R$)</td><td>R$ 7.000.000.000</td></tr></table>
  <script>window.__NUXT_DATA__={}</script><script>Highcharts.chart('x',{series:[]})</script>
`;
const deep = assetTest.extractPageDeepCoverageFromHtml(statusInvestFiiHtml, 'https://statusinvest.com.br/fundos-imobiliarios/hglg11', 'HGLG11');
assert.ok(deep.sourceFacts.some(row => row.label === 'Rendimento provisionado' && row.value === 'R$ 0,3300'));
assert.ok(deep.sourceFacts.some(row => row.label === 'Comparação + provisionado' && row.value === '6,10%'));
assert.ok(deep.sourceDriftReports.length >= 1);
assert.equal(deep.sourceDriftReports[0].provider, 'statusinvest_fii');
assert.ok(deep.sourceDriftReports[0].expectedSelectors >= 5);

const page = analysisTest.buildAnalysisPageResponse({
  ticker: 'HGLG11',
  assetClass: 'FII',
  sourceFacts: deep.sourceFacts,
  sourceExtractionTechnologies: deep.sourceExtractionTechnologies,
  sourceDriftReports: deep.sourceDriftReports,
  results: { sections: { fundo: { sourceFacts: deep.sourceFacts } } }
}, { ticker: 'HGLG11', type: 'FII' });
assert.equal(page.contractVersion, '26.analysis.v2');
assert.ok(page.consumerContract);
assert.ok(page.consumerContract.intendedConsumers.includes('portfolio_asset_modal'));
assert.ok(page.consumerContract.intendedConsumers.includes('ranking_asset_modal'));
assert.ok(page.consumerContract.uiPolicy.hideTechnicalDiagnosticsOnMainScreen);
assert.ok(page.consumerContract.sectionPriorities.some(item => item.id === 'summary'));
assert.ok(page.diagnostics.sourceDriftReports.some(report => report.provider === 'statusinvest_fii'));

console.log('Analysis source watch + modal contract v56 test OK.');
