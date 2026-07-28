import assert from 'node:assert/strict';
import { __testBuildDividendResult } from '../lib/portfolio/dividends-contract.js';

function isoWithMonthOffset(months, day = 15) {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + months, day)).toISOString().slice(0, 10);
}

const events = [
  { ticker: 'PETR4', paymentDate: isoWithMonthOffset(-4), dateCom: isoWithMonthOffset(-5), dividendType: 'DIVIDENDO', valuePerShare: 0.4 },
  { ticker: 'PETR4', paymentDate: isoWithMonthOffset(0, 1), dateCom: isoWithMonthOffset(-1), dividendType: 'DIVIDENDO', valuePerShare: 0.5 },
  { ticker: 'PETR4', paymentDate: isoWithMonthOffset(1), dateCom: isoWithMonthOffset(0), dividendType: 'DIVIDENDO', valuePerShare: 0.6 },
  { ticker: 'PETR4', paymentDate: isoWithMonthOffset(5), dateCom: isoWithMonthOffset(4), dividendType: 'DIVIDENDO', valuePerShare: 0.7 },
];

const result = __testBuildDividendResult({
  payload: {
    historyMonths: 1,
    futureMonths: 2,
    positions: [{ ticker: 'PETR4', quantity: 10, currentPrice: 30 }],
  },
  tickers: ['PETR4'],
  officialEvents: events,
});

assert.equal(result.officialEvents.length, 2, 'janela solicitada deve remover histórico antigo e futuro distante');
assert.equal(result.officialPaidEvents.length, 1);
assert.equal(result.officialFutureEvents.length, 1);
assert.ok(result.officialEvents.every(event => event.valuePerShare === 0.5 || event.valuePerShare === 0.6));
console.log('dividend request window v400 OK');
