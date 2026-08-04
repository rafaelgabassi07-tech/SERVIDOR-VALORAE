import assert from 'node:assert/strict';
import { portfolioInceptionDate, quantityAtDate } from '../lib/portfolio/positions.js';
import { __testBuildDividendResult } from '../lib/portfolio/dividends-contract.js';

const positions = [
  { ticker: 'PETR4', quantity: 20, firstPurchaseDate: '2025-01-10', assetClass: 'ACAO' },
];
const transactions = [
  { ticker: 'PETR4', side: 'BUY', quantity: 20, date: '2025-01-10' },
];

assert.equal(portfolioInceptionDate(positions, transactions), '2025-01-10');
assert.equal(quantityAtDate('PETR4', '2024-12-30', positions, transactions), 0);

const result = __testBuildDividendResult({
  payload: {
    positions,
    transactions,
    portfolioStartDate: '2025-01-10',
    historyMonths: 120,
  },
  tickers: ['PETR4'],
  officialEvents: [
    {
      ticker: 'PETR4',
      assetClass: 'ACAO',
      dateCom: '2024-12-30',
      paymentDate: '2025-02-10',
      dividendType: 'DIVIDENDO',
      grossValuePerShare: 1,
      netValuePerShare: 1,
    },
    {
      ticker: 'PETR4',
      assetClass: 'ACAO',
      dateCom: '2025-01-15',
      paymentDate: '2025-02-20',
      dividendType: 'DIVIDENDO',
      grossValuePerShare: 2,
      netValuePerShare: 2,
    },
  ],
});

assert.equal(result.portfolioStartDate, '2025-01-10');
assert.equal(result.excludedBeforePortfolioStart, 1);
assert.equal(result.officialPaidEvents.length, 2, 'histórico oficial continua auditável');
assert.equal(result.portfolioReceived.length, 1, 'histórico pessoal começa na primeira compra');
assert.equal(result.portfolioReceived[0].paymentDate, '2025-02-20');
assert.equal(result.officialPaidEvents[0].eligibilityReason, 'BEFORE_PORTFOLIO_START');
assert.equal(result.portfolioReceived[0].eligibilityReason, 'POSITION_CONFIRMED_ON_ELIGIBILITY_DATE');

const exDateResult = __testBuildDividendResult({
  payload: {
    positions: [{ ticker: 'VALE3', quantity: 10, firstPurchaseDate: '2025-03-10', assetClass: 'ACAO' }],
    transactions: [{ ticker: 'VALE3', side: 'BUY', quantity: 10, date: '2025-03-10' }],
    portfolioStartDate: '2025-03-10',
  },
  tickers: ['VALE3'],
  officialEvents: [{
    ticker: 'VALE3',
    assetClass: 'ACAO',
    exDate: '2025-03-10',
    eligibilityDate: '2025-03-07',
    eligibilityDateSource: 'exDatePreviousBusinessDay',
    paymentDate: '2025-04-01',
    dividendType: 'JCP',
    grossValuePerShare: 1,
    netValuePerShare: 0.85,
  }],
});
assert.equal(exDateResult.portfolioReceived.length, 0, 'compra na Data EX não dá direito ao provento');
assert.equal(exDateResult.officialPaidEvents[0].eligible, false);

console.log('Dividend portfolio inception boundary v407 tests OK.');
