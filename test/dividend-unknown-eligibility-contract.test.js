import assert from 'node:assert/strict';
import { __testBuildDividendResult } from '../lib/portfolio/dividends-contract.js';

const future = new Date();
future.setMonth(future.getMonth() + 1);
const y = future.getFullYear();
const m = String(future.getMonth() + 1).padStart(2, '0');
const d = String(future.getDate()).padStart(2, '0');
const futureDate = `${y}-${m}-${d}`;

const result = __testBuildDividendResult({
  payload: {
    positions: [{ ticker: 'BTCI11', quantity: 10, assetClass: 'FII' }],
    transactions: []
  },
  tickers: ['BTCI11'],
  officialEvents: [{
    ticker: 'BTCI11',
    dividendType: 'RENDIMENTO',
    paymentDate: futureDate,
    referenceDate: `${y}-${m}-01`,
    valuePerShare: 0.95,
    rawProvider: 'investidor10-agenda'
  }]
});

assert.equal(result.status, 'OK');
assert.equal(result.portfolioUpcoming.length, 1, 'Evento sem data-com real deve continuar visível como A confirmar');
assert.equal(result.portfolioUpcoming[0].eligibilityKnown, false);
assert.equal(result.portfolioUpcoming[0].eligible, false);
assert.equal(result.portfolioUpcoming[0].comDate, undefined);

const knownIneligible = __testBuildDividendResult({
  payload: {
    positions: [{ ticker: 'BTCI11', quantity: 10, firstPurchaseDate: futureDate, assetClass: 'FII' }],
    transactions: []
  },
  tickers: ['BTCI11'],
  officialEvents: [{
    ticker: 'BTCI11',
    dividendType: 'RENDIMENTO',
    paymentDate: futureDate,
    dateCom: '2024-01-02',
    valuePerShare: 0.95,
    rawProvider: 'statusinvest'
  }]
});

assert.equal(knownIneligible.portfolioUpcoming.length, 0, 'Evento com data-com conhecida e carteira inelegível não deve ir para agenda');
assert.equal(knownIneligible.officialUpcomingEvents.length, 1, 'Evento oficial permanece disponível para auditoria');
console.log('Dividend unknown eligibility agenda visibility test OK.');
