import assert from 'node:assert/strict';
import { buildAssetHistory } from '../lib/portfolio/analysis.js';
const empty = buildAssetHistory({ ticker: 'PETR4' });
assert.equal(empty.status, 'EMPTY');
assert.equal(empty.ticker, 'PETR4');
assert.deepEqual(empty.points, []);
assert.equal(empty.reason, 'real-asset-history-required');
const ok = buildAssetHistory({
  ticker: 'PETR4',
  points: [
    { date: '2026-04-01', close: 31.7, source: 'Yahoo Finance real history' },
    { date: '2026-05-01', close: 32.1, source: 'Yahoo Finance real history' }
  ]
});
assert.equal(ok.status, 'OK');
assert.equal(ok.points.length, 2);
assert.equal(ok.points.at(-1).ticker, 'PETR4');
assert.ok(ok.points.every(p => typeof p.close === 'number'));
const synthetic = buildAssetHistory({ ticker: 'PETR4', points: [{ date: '2026-05-01', close: 32, source: 'normalized-asset-history' }] });
assert.equal(synthetic.status, 'EMPTY');
