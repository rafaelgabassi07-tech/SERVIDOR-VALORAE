import assert from 'node:assert/strict';
import fs from 'node:fs';
import { _test } from '../routes/_router.js';

const emptyRequested = await _test.buildMobileAlerts({
  includeQuotes: true,
  includeDividends: true,
  includeNews: true,
  symbols: [],
  positions: [],
  transactions: [],
});

assert.equal(emptyRequested.status, 'EMPTY');
assert.deepEqual(emptyRequested.requestedBlocks, { quotes: true, dividends: true, news: true, rankings: false });
assert.deepEqual(emptyRequested.effectiveBlocks, { quotes: false, dividends: false, news: false, rankings: false });
assert.deepEqual(emptyRequested.blockStatus, { quotes: 'SKIPPED', dividends: 'SKIPPED', news: 'SKIPPED', rankings: 'SKIPPED' });
assert.equal(emptyRequested.diagnostics.effectiveCount, 0);
assert.equal(emptyRequested.diagnostics.failedCount, 0);

const routerSource = fs.readFileSync(new URL('../routes/_router.js', import.meta.url), 'utf8');
assert.match(routerSource, /const canonicalPositions =/);
assert.match(routerSource, /const canonicalTransactions =/);
assert.match(routerSource, /value\.status === 'PARTIAL' \? 15_000 : 90_000/);
assert.match(routerSource, /dividendItemCount/);

console.log('background notification reliability v402 OK');
