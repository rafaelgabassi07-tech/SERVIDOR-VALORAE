import assert from 'node:assert/strict';
import { canonicalizeTicker, inferAssetType, validarTicker } from '../lib/Valorae-engine.js';
import { classifyTicker, normalizeTicker, uniqueTickers, looksLikeB3Ticker } from '../lib/core/tickers.js';
import { yahooSymbol } from '../lib/market/yahoo.js';

const cases = [
  ['B3:B5P211.SA', 'B5P211'],
  ['B5P211SA', 'B5P211'],
  ['IB5M11.SA', 'IB5M11'],
  ['WEB311-SA', 'WEB311'],
  ['PETR4F.SA', 'PETR4'],
];

for (const [raw, expected] of cases) {
  assert.equal(normalizeTicker(raw), expected, `core normalize ${raw}`);
  assert.equal(canonicalizeTicker(raw), expected, `engine canonicalize ${raw}`);
  assert.equal(looksLikeB3Ticker(raw), true, `looksLikeB3Ticker ${raw}`);
  assert.equal(validarTicker(raw), null, `validarTicker ${raw}`);
}

assert.deepEqual(uniqueTickers(['B5P211.SA', 'IB5M11', 'WEB311SA']), ['B5P211', 'IB5M11', 'WEB311']);
assert.equal(classifyTicker('B5P211'), 'ETF');
assert.equal(classifyTicker('IB5M11'), 'ETF');
assert.equal(classifyTicker('WEB311'), 'ETF');
assert.equal(inferAssetType('B5P211'), 'ETF');
assert.equal(inferAssetType('WEB311'), 'ETF');
assert.equal(yahooSymbol('B5P211SA'), 'B5P211.SA');
assert.equal(classifyTicker('AAPL39'), 'BDR');
assert.equal(inferAssetType('AAPL39'), 'BDR');

console.log('B3 alphanumeric ticker coverage v174 test OK.');
