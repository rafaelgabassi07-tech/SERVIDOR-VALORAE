import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../lib/analysis/stock-modal-contract.js', import.meta.url), 'utf8');

assert.ok(source.includes("export const STOCK_MODAL_VERSION = '26.asset-modal.stock.v47'"));
assert.ok(source.includes('stockModalWithBudget'), 'stock modal must cap optional Investidor10 blocks by a local budget');
assert.ok(source.includes('function metricCard'), 'stock modal must define metricCard used by the runtime contract');
assert.ok(source.includes('stock_bundle_budget_timeout'), 'stock modal must return a partial fallback if the Investidor10 bundle exceeds budget');
assert.ok(source.includes('Promise.allSettled(candidates.map'), 'ID resolver must use bounded parallel resolution');
assert.ok(!source.includes('api/search?term=${encodeURIComponent(symbol)}'), 'ID resolver must not block mobile modal on broad sequential search endpoints');
assert.ok(source.includes('fetchInvestidor10StockApiExtras({ ticker: symbol, html: \'\''), 'REST extras must start without waiting for the HTML page');
assert.ok(source.includes('stockModalWithBudget(\n      buildStockIndexComparison(ticker'), 'index comparison must be part of the budgeted parallel load set');

console.log('stock-modal-timeout-budget-v266 ok');
