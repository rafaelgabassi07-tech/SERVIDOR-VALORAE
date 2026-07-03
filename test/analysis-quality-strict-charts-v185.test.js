import assert from 'node:assert/strict';
import { buildAnalysisPageResponse } from '../lib/analysis/analysis-page-response.js';

const onePointQuoteOnly = buildAnalysisPageResponse({
  ticker: 'FAKE3',
  assetClass: 'ACAO',
  currentPrice: 10.25,
  assetChartBundle: {
    priceHistory: []
  }
}, { ticker: 'FAKE3' });

const chartsFromQuoteOnly = onePointQuoteOnly.sections.flatMap(section => section.charts || []);
assert.ok(!chartsFromQuoteOnly.some(chart => chart.id === 'price_history'), 'cotação com apenas um ponto não deve virar gráfico profissional');

const richPage = buildAnalysisPageResponse({
  ticker: 'KLBN11',
  assetClass: 'ACAO',
  currentPrice: 17.02,
  profilePresentation: {
    summary: 'A Klabin S.A. é uma empresa do setor de papel e celulose com operação verticalizada.',
    sections: [{ title: 'História', text: 'A companhia possui longa trajetória operacional e atuação no mercado nacional e internacional.' }]
  },
  companyInfo: { setor: 'Materiais Básicos', subsetor: 'Madeira e Papel', segmento: 'Papel e Celulose' },
  indicators: { pl: 30.86, pvp: 2.35, dividendYield: 8.39, roe: 7.61 },
  assetChartBundle: {
    priceHistory: [{ label: '2024', close: 15 }, { label: '2025', close: 17.02 }],
    revenueProfit: [{ label: '2024', netRevenue: 100, netProfit: 10 }, { label: '2025', netRevenue: 110, netProfit: 12 }]
  },
  comparativeGroups: { sector: 'Materiais Básicos', subSector: 'Madeira e Papel', segment: 'Papel e Celulose' },
  relatedCompanies: [
    { ticker: 'SUZB3', name: 'Suzano', metrics: { pl: { value: 4.51, display: '4,51' }, pvp: { value: 1.07, display: '1,07' }, dividendYield: { value: 2.76, display: '2,76%' }, roe: { value: 23.68, display: '23,68%' } } }
  ]
}, { ticker: 'KLBN11' });

assert.ok(Array.isArray(richPage.dataQuality?.sourceCaptureMap), 'dataQuality precisa entregar mapa de captura para auditoria APK/Proxy');
assert.ok(richPage.sourceCoverage?.some(item => item.id === 'company_profile' && item.critical === true && item.status === 'implemented'), 'perfil textual é seção crítica implementada');
assert.ok(richPage.dataQuality?.strictChartPolicyOk, 'gráficos reais precisam chegar com política estrita OK');
assert.equal(richPage.dataQuality?.blockedReconstructedCharts, 0);
assert.ok(!richPage.dataQuality?.criticalMissingSectionIds?.includes('company_profile'));

console.log('Analysis quality strict charts v185 test OK.');
