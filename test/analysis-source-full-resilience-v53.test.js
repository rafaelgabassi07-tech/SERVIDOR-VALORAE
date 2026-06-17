import assert from 'node:assert/strict';
import { _test as analysisTest } from '../lib/analysis/analysis-page-response.js';
import { _test as assetTest } from '../lib/sources/asset-details.js';

const stockPage = analysisTest.buildAnalysisPageResponse({
  ticker: 'BBAS3',
  assetClass: 'ACAO',
  assetChartBundle: {
    indicatorCards: [
      { label: 'P/L', value: 8.78, display: '8,78', comparisons: { setor: { value: 8.3, display: '8,30' }, subsetor: { value: 8.35, display: '8,35' }, segmento: { value: 7.59, display: '7,59' } } },
      { label: 'Dividend Yield', value: 0.12, display: '12,00%', comparisons: { setor: { value: 0.08, display: '8,00%' } } }
    ]
  },
  results: {
    sections: {
      empresa: {
        valuationModels: {
          grahamFairPrice: 'R$ 31,20',
          grahamCurrentPrice: 'R$ 19,40',
          grahamUpside: '60,82%',
          bazinCeilingPrice: 'R$ 24,30',
          bazinMinimumDy: '6%'
        },
        indices: [{ ticker: 'IBOV', participacao: '2,31%' }]
      }
    }
  }
}, { ticker: 'BBAS3', type: 'ACAO' });

const valuation = stockPage.sections.find(section => section.id === 'valuation_models');
const sourceComparatives = stockPage.sections.find(section => section.id === 'source_comparatives');
const indices = stockPage.sections.find(section => section.id === 'indices_events');
assert.equal(valuation.status, 'ready');
assert.ok(valuation.items.some(item => item.label === 'Preço justo de Graham'));
assert.equal(sourceComparatives.status, 'ready');
assert.ok(sourceComparatives.items.some(item => item.label === 'P/L' && /Setor/.test(item.value)));
assert.equal(indices.status, 'ready');
assert.ok(indices.items.some(item => item.label === 'IBOV'));

const fiiPage = analysisTest.buildAnalysisPageResponse({
  ticker: 'HGLG11',
  assetClass: 'FII',
  results: {
    informacoesFundo: {
      dyCagr3: '8,12%',
      dyCagr5: '7,60%',
      valorCagr3: '4,20%',
      valorCagr5: '5,10%',
      rendimentoMedio24m: 'R$ 1,10',
      participacaoIfix: '3,45%'
    },
    statusInvestFiiAccounting: {
      despesasAgenteCustodiante: 'R$ 12.000,00',
      fundosRendaFixa: 'R$ 45.000.000,00',
      imoveisRendaAcabados: 'R$ 6.900.000.000,00',
      certificadosDepositosValoresMobiliarios: 'R$ 1.000.000,00'
    },
    indices: [{ ticker: 'IFIX', participacao: '3,45%' }]
  }
}, { ticker: 'HGLG11', type: 'FII' });
const fiiDetails = fiiPage.sections.find(section => section.id === 'fii_details');
const fiiAccounting = fiiPage.sections.find(section => section.id === 'fii_accounting');
const fiiIndices = fiiPage.sections.find(section => section.id === 'indices_events');
assert.equal(fiiDetails.status, 'ready');
assert.ok(fiiDetails.items.some(item => item.label === 'DY CAGR 3 anos'));
assert.equal(fiiAccounting.status, 'ready');
assert.ok(fiiAccounting.items.some(item => item.label === 'Despesa custodiante'));
assert.ok(fiiAccounting.items.some(item => item.label === 'Fundos renda fixa'));
assert.ok(fiiAccounting.items.some(item => item.label === 'Imóveis renda acabados'));
assert.equal(fiiIndices.status, 'ready');
assert.ok(fiiIndices.items.some(item => item.label === 'IFIX'));

const htmlMetrics = assetTest.parseMetricsFromHtml('Indicadores Fundamentalistas P/L 8,78 Setor: 8,30 Subsetor: 8,35 Segmento: 7,59 Dividend Yield 12,00% Setor: 8,00%');
assert.ok(htmlMetrics.indicatorCards.some(card => card.label === 'P/L' && card.comparisons?.setor?.display === '8,30'));

const valuationHtml = 'O Preço Justo de Graham Preço Atual R$ 19,40 Preço Justo R$ 31,20 Upside 60,82% O Preço-teto de Bazin Preço Atual R$ 19,40 Preço-teto R$ 24,30 Upside 25,25% DY mínimo desejado de 6%';
const valuationModels = assetTest.extractInvestidor10ValuationModelsFromHtml(valuationHtml);
assert.equal(valuationModels.grahamFairPrice, 'R$ 31,20');
assert.equal(valuationModels.bazinCeilingPrice, 'R$ 24,30');

const fiiHtml = 'DY CAGR (3 anos) 8,12% DY CAGR (5 anos) 7,60% Valor CAGR (3 anos) 4,20% Nº de Cotistas 573.386 RENDIMENTO MENSAL MÉDIO (24M) R$ 1,10 PARTICIPAÇÃO NO IFIX 3,45% Número cotistas 573.386 Número cotas emitidas 43.453.000 Ativos - (R$) R$ 7.500.000.000,00 Despesas Agente Custodiante - (R$) R$ 12.000,00 Fundos Renda Fixa - (R$) R$ 45.000.000,00 ÍNDICES COM HGLG11 IFIX PARTICIPAÇÃO 3,45%';
assert.equal(assetTest.extractStatusInvestFiiHighlightsFromHtml(fiiHtml).participacaoIfix, '3,45%');
assert.equal(assetTest.extractStatusInvestFiiAccountingFromHtml(fiiHtml).fundosRendaFixa, 'R$ 45.000.000,00');
assert.ok(assetTest.extractStatusInvestIndicesFromHtml(fiiHtml).some(row => row.ticker === 'IFIX'));

console.log('Analysis source full resilience v53 test OK.');
