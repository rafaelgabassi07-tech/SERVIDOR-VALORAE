import assert from 'node:assert/strict';
import { buildAnalysisPageResponse } from '../lib/analysis/analysis-page-response.js';

const fixture = {
  ticker: 'PETR4',
  symbol: 'PETR4',
  assetClass: 'ACAO',
  name: 'PETROBRAS PN',
  price: 38.99,
  currentPrice: 38.99,
  indicators: {
    pl: 4.67,
    psr: 1.01,
    pvp: 1.13,
    dividendYield: 7.15,
    payout: 33.43,
    margemLiquida: 21.44,
    margemBruta: 48.33,
    margemEbit: 36.68,
    margemEbitda: 49.11,
    evEbitda: 2.28,
    evEbit: 3.06,
    pEbitda: 1.81,
    pEbit: 2.44,
    pAtivo: 0.44,
    pCapGiro: 10.09,
    pAtivoCircLiq: -0.72,
    vpa: 34.39,
    lpa: 8.32,
    giroAtivos: 0.43,
    roe: 24.22,
    roic: 14.31,
    roa: 9.49,
    dividaLiquidaPatrimonio: 0.59,
    dividaLiquidaEbitda: 0.95,
    dividaLiquidaEbit: 1.26,
    dividaBrutaPatrimonio: 0.78,
    patrimonioAtivos: 0.39,
    passivosAtivos: 0.61,
    liquidezCorrente: 0.89,
    cagrReceitas5Anos: 14.72,
    cagrLucros5Anos: 21.65
  },
  assetChartBundle: {
    priceHistory: [
      { date: '2025-01-01', close: 30 },
      { date: '2026-01-01', close: 39 }
    ]
  }
};

const response = buildAnalysisPageResponse(fixture, { ticker: 'PETR4' });
assert.equal(response.contract, 'AnalysisPageResponse');
assert.equal(response.endpoint, 'analysis');
assert.equal(response.ticker, 'PETR4');
assert.equal(response.sections.length, 2);
assert.deepEqual(response.sections.map(s => s.id), ['summary', 'fundamental_indicators']);
assert.equal(response.sections[0].type, 'metric_cards');
assert.equal(response.sections[0].items.length, 5);
assert.equal(response.sections[1].type, 'metric_grid');
assert.equal(response.sections[1].items.length, 31);
assert.ok(response.sections[0].items.find(item => item.label === 'Cotação')?.value.includes('R$'));
assert.ok(response.sections[0].items.find(item => item.label === 'P/L')?.value.includes('4,67'));
assert.ok(response.sections[1].items.find(item => item.label === 'P/Receita (PSR)'));
assert.ok(!JSON.stringify(response).includes('assetAnalysisPage'));
