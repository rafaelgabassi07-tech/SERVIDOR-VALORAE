import assert from 'node:assert/strict';
import { _test as syncTest } from '../routes/sync.js';
import { normalizeTicker } from '../lib/core/tickers.js';

const variants = ['B3:KLBN4F', 'BVMF:KLBN4.SA', 'BMFBOVESPA:KLBN4-SA', 'KLBN4SA'];
for (const variant of variants) {
  assert.equal(normalizeTicker(variant), 'KLBN4');
  assert.equal(syncTest.normalizeSingleTransactionSymbol(variant), 'KLBN4');
}

assert.deepEqual(syncTest.normalizeTransactionSymbols(['B3:PETR4F', 'PETR4.SA', 'BVMF:VALE3']), ['PETR4', 'VALE3']);

console.log('General full regression audit v171 test OK.');
