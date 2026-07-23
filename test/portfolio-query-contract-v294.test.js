import assert from 'node:assert/strict';
import { buildPortfolioHistory, normalizePortfolioPositions, normalizePortfolioTransactions } from '../lib/portfolio/history.js';

const fromSymbols = normalizePortfolioPositions({ symbols: 'PETR4, BBAS3', quantities: '10,20', avgPrices: '30,10' });
assert.equal(fromSymbols.length, 2);
assert.equal(fromSymbols[0].ticker, 'PETR4');
assert.equal(fromSymbols[0].quantity, 10);
assert.equal(fromSymbols[1].ticker, 'BBAS3');

const fromJsonPositions = normalizePortfolioPositions({ positions: JSON.stringify([{ ticker: 'PETR4.SA', quantity: '3', averagePrice: '28,50' }]) });
assert.equal(fromJsonPositions.length, 1);
assert.equal(fromJsonPositions[0].ticker, 'PETR4');
assert.equal(fromJsonPositions[0].averagePrice, 28.5);

const fromJsonTransactions = normalizePortfolioTransactions({ transactions: JSON.stringify([{ symbol: 'PETR4.SA', quantity: '3', price: '28,50', date: '2026-01-02', operation: 'Compra' }]) });
assert.equal(fromJsonTransactions.length, 1);
assert.equal(fromJsonTransactions[0].ticker, 'PETR4');
assert.equal(fromJsonTransactions[0].side, 'BUY');

const history = await buildPortfolioHistory([], {
  symbols: 'PETR4',
  quantities: '1',
  avgPrices: '20',
  range: '1D',
  timeoutMs: 1,
  maxConcurrency: 1,
});
assert.equal(history.ok, false);
assert.deepEqual(history.activeTickers, ['PETR4']);
assert.equal(history.series.length, 0, 'average cost must not fabricate a market series when quotes are unavailable');
assert.equal(history.source, 'Unavailable');

console.log('portfolio-query-contract-v294 ok');
