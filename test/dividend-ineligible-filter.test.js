import assert from 'node:assert/strict';
import { __testBuildDividendResult } from '../lib/portfolio/dividends-contract.js';

const result = __testBuildDividendResult({
  payload: {
    positions: [{ ticker: 'BTCI11', quantity: 10, firstPurchaseDate: '2026-07-01', assetClass: 'FII' }],
    transactions: []
  },
  tickers: ['BTCI11'],
  officialEvents: [
    {
      ticker: 'BTCI11',
      assetClass: 'FII',
      dateCom: '2026-06-20',
      paymentDate: '2026-07-15',
      dividendType: 'RENDIMENTO',
      grossValuePerShare: 0.10,
      netValuePerShare: 0.10,
      rawProvider: 'statusinvest'
    }
  ]
});

assert.equal(result.officialUpcomingEvents.length, 1, 'official future event remains auditable');
assert.equal(result.officialUpcomingEvents[0].eligible, false, 'event is marked as not eligible by date-com');
assert.equal(result.portfolioUpcoming.length, 0, 'known ineligible event must not enter portfolio agenda');
assert.equal(result.portfolioAgenda.length, 0, 'known ineligible event must not enter agenda rows');
assert.equal(result.upcoming.length, 0, 'APK upcoming alias must stay free of known ineligible events');
console.log('Dividend agenda known-ineligible filter test OK.');
