import assert from 'node:assert/strict';
import { normalizeTicker, uniqueTickers } from '../lib/core/tickers.js';
import { canonicalizeTicker } from '../lib/Valorae-engine.js';
import { canonicalTicker, yahooSymbol } from '../lib/market/yahoo.js';

const cases = {
  'PETR4.SA': 'PETR4',
  'B3:PETR4': 'PETR4',
  'BVMF:KLBN4': 'KLBN4',
  'BMFBOVESPA:TAEE11': 'TAEE11',
  'KLBN4F': 'KLBN4',
  'KLBN4SA': 'KLBN4',
  'AAPL34.SA': 'AAPL34',
  'BOVA11.SA': 'BOVA11'
};

for (const [input, expected] of Object.entries(cases)) {
  assert.equal(normalizeTicker(input), expected, `normalização canônica falhou para ${input}`);
}
assert.deepEqual(
  uniqueTickers(['PETR4.SA', 'B3:PETR4', 'BVMF:PETR4', 'KLBN4F', 'KLBN4SA']),
  ['PETR4', 'KLBN4']
);
assert.equal(canonicalizeTicker('BVMF:PETR4F'), 'PETR4');
assert.equal(canonicalTicker('B3:KLBN4SA'), 'KLBN4');
assert.equal(yahooSymbol('BVMF:KLBN4F'), 'KLBN4.SA');
console.log('Full audit ticker normalization v169/v170 test OK.');
