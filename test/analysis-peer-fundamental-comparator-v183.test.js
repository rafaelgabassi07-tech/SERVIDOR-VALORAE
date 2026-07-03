import assert from 'node:assert/strict';
import { buildAnalysisPageResponse } from '../lib/analysis/analysis-page-response.js';

const response = buildAnalysisPageResponse({
  ticker: 'KLBN11',
  assetClass: 'ACAO',
  comparativeGroups: { sector: 'Materiais Básicos', subSector: 'Madeira e Papel', segment: 'Papel e Celulose' },
  sourceComparatives: [
    { label: 'P/L', value: 30.86, display: '30,86', comparisons: { setor: { label: 'Setor', value: 7.62, display: '7,62' }, subsetor: { label: 'Subsetor', value: 15.09, display: '15,09' }, segmento: { label: 'Segmento', value: 15.81, display: '15,81' } } },
    { label: 'P/VP', value: 2.35, display: '2,35', comparisons: { setor: { label: 'Setor', value: 0.93, display: '0,93' }, subsetor: { label: 'Subsetor', value: 1.27, display: '1,27' }, segmento: { label: 'Segmento', value: 1.6, display: '1,60' } } },
    { label: 'Dividend Yield', value: 8.39, display: '8,39%', unit: '%', comparisons: { setor: { label: 'Setor', value: 2.76, display: '2,76%', unit: '%' }, subsetor: { label: 'Subsetor', value: 9.86, display: '9,86%', unit: '%' }, segmento: { label: 'Segmento', value: 13.44, display: '13,44%', unit: '%' } } },
    { label: 'ROE', value: 7.61, display: '7,61%', unit: '%', comparisons: { setor: { label: 'Setor', value: 2.36, display: '2,36%', unit: '%' }, subsetor: { label: 'Subsetor', value: 9.79, display: '9,79%', unit: '%' }, segmento: { label: 'Segmento', value: 10.08, display: '10,08%', unit: '%' } } }
  ],
  relatedCompanies: [
    { ticker: 'SUZB3', name: 'Suzano', source: 'Investidor10 Empresas Relacionadas', metrics: { pl: { value: 4.51, display: '4,51' }, pvp: { value: 1.07, display: '1,07' }, dividendYield: { value: 2.76, display: '2,76%' }, roe: { value: 23.68, display: '23,68%' } } },
    { ticker: 'RANI3', name: 'Irani', source: 'Investidor10 Empresas Relacionadas', metrics: { pl: { value: 9.09, display: '9,09' }, pvp: { value: 1.25, display: '1,25' }, dividendYield: { value: 6, display: '6,00%' }, roe: { value: 13.78, display: '13,78%' } } }
  ]
}, { ticker: 'KLBN11' });

const section = response.sections.find(item => item.id === 'peer_fundamental_comparator');
assert.ok(section, 'contrato deve incluir seção de comparador fundamentalista por segmento');
assert.equal(section.status, 'ready');
assert.match(section.title, /Comparador de fundamentos/);
assert.ok(section.items.some(item => item.value.includes('Segmento: Papel e Celulose')));
assert.ok(section.items.some(item => item.label === 'P/L' && item.value.includes('Melhor: SUZB3')), 'P/L deve favorecer menor múltiplo entre pares/segmento');
assert.ok(section.items.some(item => item.label === 'Dividend Yield' && item.value.includes('Setor: 2,76%') && item.value.includes('Subsetor: 9,86%') && item.value.includes('Segmento: 13,44%')), 'DY precisa preservar referências de setor, subsetor e segmento do Investidor10');
assert.ok(response.sourceCoverage?.some(item => item.id === 'peer_fundamental_comparator' && item.status === 'implemented'), 'sourceCoverage precisa chegar no topo do contrato');
assert.equal(response.dataQuality?.blockedReconstructedCharts, 0, 'dataQuality deve bloquear gráficos reconstruídos antes do APK');
assert.ok(response.consumerContract.sectionPriorities.some(item => item.id === 'peer_fundamental_comparator' && item.ready), 'contrato de consumidores deve liberar a seção para página e modais');

console.log('Analysis peer fundamental comparator v183 test OK.');
