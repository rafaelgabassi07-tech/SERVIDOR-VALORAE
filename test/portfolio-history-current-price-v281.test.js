import assert from 'node:assert/strict';
import { normalizePortfolioPositions, buildPortfolioHistory } from '../lib/portfolio/history.js';

const positions = normalizePortfolioPositions({ positions: [{ ticker: 'PETR4', quantity: 10, averagePrice: 20, currentPrice: 30, firstPurchaseAt: 0 }] });
assert.equal(positions[0].currentPrice, 30);
assert.equal(positions[0].ticker, 'PETR4');

const history = await buildPortfolioHistory([{ ticker: 'INVALIDO99', quantity: 2, averagePrice: 10, currentPrice: 14 }], {
  range: '1mo',
  interval: '1d',
  timeoutMs: 1,
  maxConcurrency: 1,
  limit: 1
});
assert.equal(history.ok, true);
assert.equal(history.fallbackUsed, false);
assert.equal(history.remotePointCount, 0);
assert.equal(history.series.length, 1);
assert.equal(history.series[0].completeValuation, true);
assert.equal(history.series[0].source, 'currentPrice');
assert.equal(history.series.at(-1).totalValue, 28);
assert.equal(history.summary.lastValue, 28);
console.log('portfolio-history-current-price-v281 ok');
