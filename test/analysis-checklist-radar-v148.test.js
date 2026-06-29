import assert from 'node:assert/strict';
import { buildAnalysisPageResponse } from '../lib/analysis/analysis-page-response.js';
import { _test as assetTest } from '../lib/sources/asset-details.js';

const stockPayload = {
  ticker: 'GRND3',
  assetClass: 'ACAO',
  roe: '14,5%',
  dividendYield: '7,2%',
  liquidezMediaDiaria: 'R$ 60.000.000,00',
  dividaBrutaPatrimonio: '0,42',
  cagrReceitas5Anos: '11,2%',
  cagrLucros5Anos: '10,4%',
  checklistBuyHold: [
    { label: 'Empresa com mais de 5 anos de Bolsa', value: 'Atende' },
    { label: 'Empresa nunca deu prejuízo (ano fiscal)', value: 'Atende' }
  ],
  dividends: [
    { comDate: '10/04/2025', paymentDate: '12/05/2025', valuePerShare: '0,20' },
    { comDate: '15/08/2025', paymentDate: '30/08/2025', valuePerShare: '0,18' },
    { comDate: '11/11/2025', paymentDate: '20/12/2025', valuePerShare: '0,22' }
  ]
};

const stockPage = buildAnalysisPageResponse(stockPayload, { ticker: 'GRND3', type: 'ACAO' });
const checklist = stockPage.sections.find(section => section.id === 'checklist');
const radar = stockPage.sections.find(section => section.id === 'dividend_radar');
assert.equal(checklist.status, 'ready');
assert.equal(checklist.items.length >= 10, true, 'ações devem entregar o checklist Buy and Hold completo');
assert.ok(checklist.items.some(item => item.label === 'Empresa com mais de 5 anos de Bolsa' && item.value === 'Atende'));
assert.equal(radar.status, 'ready');
assert.equal(radar.items.length, 25, 'radar precisa ter resumo + 12 meses Data Com + 12 meses Data Pagamento');
assert.ok(radar.items.some(item => item.group === 'Data Com' && item.label === 'Abr' && item.value === 'Ativo'));
assert.ok(radar.items.some(item => item.group === 'Data Pagamento' && item.label === 'Mai' && item.value === 'Ativo'));

const fiiPage = buildAnalysisPageResponse({
  ticker: 'MXRF11',
  assetClass: 'FII',
  dividendYield: '10,1%',
  liquidezMediaDiaria: 'R$ 2.000.000,00',
  numeroCotistas: '30.000',
  patrimonioLiquido: 'R$ 700.000.000,00'
}, { ticker: 'MXRF11', type: 'FII' });
assert.equal(fiiPage.sections.find(section => section.id === 'dividend_radar'), undefined, 'radar de dividendos inteligente é exclusivo de ações');
assert.equal(fiiPage.sections.find(section => section.id === 'fii_checklist')?.status, 'ready');
assert.equal(fiiPage.sections.find(section => section.id === 'checklist')?.status, undefined);

const i10StockText = 'CHECKLIST DO INVESTIDOR BUY AND HOLD SOBRE GRND3 Empresa com mais de 5 anos de Bolsa Empresa nunca deu prejuízo (ano fiscal) Empresa com lucro nos últimos 20 trimestres (5 anos) Empresa pagou +5% de dividendos/ano nos últimos 5 anos Empresa possui ROE acima de 10% Empresa possui dívida menor que patrimônio Empresa apresentou crescimento de receita nos últimos 5 anos Empresa apresentou crescimento de lucros nos últimos 5 anos Empresa possui liquidez diária acima de US$ 2M Empresa é bem avaliada pelos usuários do Investidor10 RADAR DE DIVIDENDOS INTELIGENTE PARA GRND3';
const i10Deep = assetTest.extractPageDeepCoverageFromHtml(i10StockText, 'https://investidor10.com.br/acoes/grnd3/', 'GRND3');
assert.ok(i10Deep.checklistBuyHold.length >= 10, 'extração Investidor10 deve capturar os critérios do checklist de ação');

console.log('Analysis checklist and dividend radar v148 test OK.');
