import assert from 'node:assert/strict';
import { quantityAtDate } from '../lib/portfolio/positions.js';
import { __testBuildDividendResult } from '../lib/portfolio/dividends-contract.js';

const positions = [{ ticker: 'PETR4', quantity: 30, firstPurchaseDate: '2026-03-10', assetClass: 'ACAO' }];
const transactions = [
  { ticker: 'PETR4', side: 'BUY', quantity: 10, date: '2026-03-10' },
  { ticker: 'PETR4', side: 'BUY', quantity: 20, date: '2026-04-10' },
  { ticker: 'PETR4', side: 'SELL', quantity: 5, date: '2026-05-10' },
  { ticker: 'PETR4', side: 'SELL', quantity: 25, date: '2026-06-10' },
];

assert.equal(quantityAtDate('PETR4', '2026-03-09', positions, transactions), 0, 'compra posterior à Data COM não pode herdar posição atual');
assert.equal(quantityAtDate('PETR4', '2026-03-10', positions, transactions), 10, 'compra na Data COM participa da posição de fechamento');
assert.equal(quantityAtDate('PETR4', '2026-04-20', positions, transactions), 30, 'compras parciais devem ser somadas');
assert.equal(quantityAtDate('PETR4', '2026-05-20', positions, transactions), 25, 'venda parcial deve reduzir a quantidade elegível');
assert.equal(quantityAtDate('PETR4', '2026-06-20', positions, transactions), 0, 'venda total antes da Data COM elimina a elegibilidade');

const laterOnly = [{ ticker: 'VALE3', side: 'BUY', quantity: 100, date: '2026-07-01' }];
assert.equal(
  quantityAtDate('VALE3', '2026-06-01', [{ ticker: 'VALE3', quantity: 100, assetClass: 'ACAO' }], laterOnly),
  0,
  'histórico existente, porém posterior, não pode cair para a posição atual'
);

assert.equal(
  quantityAtDate('ITSA4', '2024-01-01', [{ ticker: 'ITSA4', quantity: 50, assetClass: 'ACAO' }], []),
  0,
  'posição legada sem primeira compra não comprova provento histórico'
);
assert.equal(
  quantityAtDate('ITSA4', '2099-01-01', [{ ticker: 'ITSA4', quantity: 50, assetClass: 'ACAO' }], []),
  50,
  'posição atual pode fundamentar Data COM futura quando não há histórico'
);

const paidAfterSale = __testBuildDividendResult({
  payload: { positions: [], transactions },
  tickers: ['PETR4'],
  officialEvents: [{
    ticker: 'PETR4',
    assetClass: 'ACAO',
    dateCom: '2026-05-20',
    paymentDate: '2026-07-20',
    dividendType: 'DIVIDENDO',
    grossValuePerShare: 1,
    netValuePerShare: 1,
  }],
});
assert.equal(paidAfterSale.officialEvents[0].quantityAtDate, 25, 'venda após Data COM não remove direito adquirido');
assert.equal(paidAfterSale.officialEvents[0].eligible, true);

const boughtAfterCom = __testBuildDividendResult({
  payload: {
    positions: [{ ticker: 'VALE3', quantity: 100, firstPurchaseDate: '2026-07-01', assetClass: 'ACAO' }],
    transactions: laterOnly,
  },
  tickers: ['VALE3'],
  officialEvents: [{
    ticker: 'VALE3',
    assetClass: 'ACAO',
    dateCom: '2026-06-01',
    paymentDate: '2026-08-01',
    dividendType: 'JCP',
    grossValuePerShare: 0.5,
    netValuePerShare: 0.4125,
  }],
});
assert.equal(boughtAfterCom.officialEvents[0].eligible, false);
assert.equal(boughtAfterCom.portfolioUpcoming.length, 0, 'compra posterior à Data COM não entra na Agenda');

const unknownEligibility = __testBuildDividendResult({
  payload: { positions: [{ ticker: 'MXRF11', quantity: 100, assetClass: 'FII' }], transactions: [] },
  tickers: ['MXRF11'],
  officialEvents: [{
    ticker: 'MXRF11',
    assetClass: 'FII',
    paymentDate: '2026-08-15',
    dividendType: 'RENDIMENTO',
    grossValuePerShare: 0.1,
  }],
});
assert.equal(unknownEligibility.officialUpcomingEvents.length, 1, 'evento oficial permanece auditável');
assert.equal(unknownEligibility.portfolioUpcoming.length, 0, 'evento sem Data COM não entra na agenda pessoal');
assert.equal(unknownEligibility.portfolioAgenda.length, 0);

console.log('Dividend portfolio lifecycle eligibility v405 tests OK.');
