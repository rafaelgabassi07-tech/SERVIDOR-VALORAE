import assert from 'node:assert/strict';
import { _test } from '../lib/analysis/analysis-page-response.js';

const payload = {
  ticker: 'HGLG11',
  assetClass: 'FII',
  precoAtual: 151.94,
  dividendYield: 8.69,
  pvp: 0.96,
  results: {
    ticker: 'HGLG11',
    assetClass: 'FII',
    informacoesFundo: {
      segmento: 'Logístico / Indústria / Galpões',
      tipoFundo: 'Fundo de Tijolo',
      publicoAlvo: 'Investidores em geral',
      mandato: 'Renda',
      tipoGestao: 'Ativa',
      taxaAdministracao: '0,60% a.a.',
      valorPatrimonialCota: 'R$ 157,20',
      patrimonioLiquido: 'R$ 7,1 bi',
      numeroCotistas: '573.386',
      cotasEmitidas: '45.601.745'
    },
    assetChartsCanonical: {
      fii: {
        info: { segmento: 'Logístico', valorPatrimonialCota: 'R$ 157,20' },
        physicalAssets: [
          { tipo: 'estado', estado: 'São Paulo', quantidade: 25, source: 'Investidor10HTML.listaImoveis.estado' },
          { nome: 'HGLG CAMPO GRANDE', estado: 'Rio de Janeiro', area_bruta_locavel: '16.532,00 m²', tipo: 'imovel' }
        ],
        assetDistribution: [{ nome: 'Imóveis', percentual: 82.5, value: 82.5 }]
      }
    },
    sections: {
      fundo: {
        statusInvestFiiPortfolio: [
          { nome: 'Ribeirão Preto', cidade: 'Ribeirão Preto', area_bruta_locavel: '59.871,86 m²', vacancia: '0,00%', inadimplencia: '0,00%', objetivo: 'Renda' }
        ],
        contabilidade: { disponibilidades: 'R$ 120 mi', totalInvestido: 'R$ 6,7 bi' }
      }
    }
  }
};

const page = _test.buildAnalysisPageResponse(payload, { ticker: 'HGLG11', type: 'FII' });
const accounting = page.sections.find(section => section.id === 'fii_accounting');
const portfolio = page.sections.find(section => section.id === 'fii_portfolio');
assert.equal(accounting.status, 'ready');
assert.ok(accounting.items.some(item => item.label === 'Patrimônio líquido'));
assert.equal(portfolio.status, 'ready');
assert.ok(portfolio.items.some(item => /São Paulo/i.test(item.label)));
assert.ok(portfolio.items.some(item => /HGLG CAMPO GRANDE/i.test(item.label)));
assert.ok(portfolio.charts.some(chart => chart.id === 'fii_portfolio_by_state'));

const stockPage = _test.buildAnalysisPageResponse({ ticker: 'BBAS3', assetClass: 'ACAO', indicators: { pegRatio: -0.19, pl: 8.78 } }, { ticker: 'BBAS3', type: 'ACAO' });
const fundamentals = stockPage.sections.find(section => section.id === 'fundamental_indicators');
assert.ok(fundamentals.items.some(item => item.label === 'PEG Ratio'));

console.log('Analysis source coverage v52 test OK.');
