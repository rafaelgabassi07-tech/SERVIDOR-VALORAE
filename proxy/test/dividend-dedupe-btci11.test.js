import assert from 'node:assert/strict';
import { __testDedupeEvents } from '../lib/portfolio/dividends-contract.js';

const events = __testDedupeEvents([
  {
    ticker: 'BTCI11',
    assetClass: 'FII',
    eligibilityDate: '2026-06-20',
    dateCom: '2026-06-20',
    paymentDate: '2026-06-30',
    dividendType: 'RENDIMENTO',
    grossValuePerShare: 0.096,
    netValuePerShare: 0.096,
    valuePerShare: 0.096,
    rawProvider: 'investidor10-agenda',
    sourceKind: 'calendar-complement'
  },
  {
    ticker: 'BTCI11',
    assetClass: 'FII',
    eligibilityDate: '2026-06-20',
    dateCom: '2026-06-20',
    paymentDate: '2026-06-30',
    dividendType: 'RENDIMENTO',
    grossValuePerShare: 0.10,
    netValuePerShare: 0.10,
    valuePerShare: 0.10,
    rawProvider: 'statusinvest',
    sourceKind: 'confirmed-per-ticker'
  }
]);

assert.equal(events.length, 1, 'BTCI11 same payment/family must appear once');
assert.equal(events[0].rawProvider, 'statusinvest', 'StatusInvest per-ticker must be preferred over calendar complement');
assert.deepEqual(events[0].providers.sort(), ['investidor10-agenda', 'statusinvest'].sort());
assert.equal(events[0].dedupeStrategy, 'ticker-payment-family-or-fii-payment-primary-source');


const mixedTypeEvents = __testDedupeEvents([
  {
    ticker: 'BTCI11',
    assetClass: 'FII',
    paymentDate: '2026-07-15',
    dividendType: 'RENDIMENTO',
    grossValuePerShare: 0.091,
    netValuePerShare: 0.091,
    valuePerShare: 0.091,
    rawProvider: 'investidor10-agenda',
    sourceKind: 'calendar-complement'
  },
  {
    ticker: 'BTCI11',
    assetClass: 'FII',
    paymentDate: '2026-07-15',
    dividendType: 'DIVIDENDO',
    grossValuePerShare: 0.10,
    netValuePerShare: 0.10,
    valuePerShare: 0.10,
    rawProvider: 'statusinvest',
    sourceKind: 'confirmed-per-ticker'
  }
]);

assert.equal(mixedTypeEvents.length, 1, 'BTCI11 same payment date must appear once even when providers use different provento labels and cents');
assert.equal(mixedTypeEvents[0].rawProvider, 'statusinvest', 'StatusInvest remains preferred when mixed labels are merged');

console.log('BTCI11 dividend agenda dedupe test OK.');
