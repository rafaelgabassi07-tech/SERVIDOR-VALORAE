import assert from 'node:assert/strict';
import { classifyTicker, uniqueTickers } from '../lib/core/tickers.js';
import { dividendTickers } from '../lib/portfolio/positions.js';

assert.equal(classifyTicker('TAEE11'), 'ACAO_UNIT');
assert.equal(classifyTicker('MXRF11'), 'FII');
assert.equal(classifyTicker('PETR4'), 'ACAO');

assert.deepEqual(uniqueTickers('PETR4, BBAS3;MXRF11'), ['PETR4','BBAS3','MXRF11']);
assert.deepEqual(dividendTickers({ tickers: 'PETR4, BBAS3;MXRF11' }), ['PETR4','BBAS3','MXRF11']);
assert.deepEqual(dividendTickers({ ticker: 'TAEE11' }), ['TAEE11']);
