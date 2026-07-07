import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../lib/analysis/stock-modal-contract.js', import.meta.url), 'utf8');

assert.ok(source.includes("export const STOCK_MODAL_VERSION = '26.asset-modal.stock.v51'"));
assert.ok(source.includes('fetchInvestidor10StockBundle(ticker, Math.min(timeoutMs, 7000))'), 'stock modal must cap the Investidor10 bundle by a local timeout');
assert.ok(source.includes('function metricCard'), 'stock modal must define metricCard used by the runtime contract');
assert.ok(source.includes('Promise.all(['), 'stock modal must keep core providers in parallel');
assert.ok(source.includes('buildStockIndexComparison(ticker, timeoutMs)'), 'index comparison must be part of the parallel load set');
assert.ok(source.includes('fetchYahooHistory(ticker, {'), 'stock modal must keep Yahoo history as an independent provider');
assert.ok(source.includes('fetchYahooLogo(ticker'), 'stock modal must keep Yahoo logo resolution independent from Investidor10');
assert.ok(source.includes('fetchInvestidor10StockApiExtras({ ticker: symbol, html,'), 'REST extras must be loaded from the Investidor10 bundle path');

console.log('stock-modal-timeout-budget-v266 ok');
