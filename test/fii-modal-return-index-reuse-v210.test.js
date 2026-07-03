import assert from 'node:assert/strict';
import { _test } from '../lib/analysis/fii-modal-contract.js';

assert.equal(_test.FII_MODAL_VERSION, '26.asset-modal.fii.v20');
assert.equal(_test.comparisonHistoryRangeForPeriod({ key: '2y', months: 24 }), '5Y');
assert.equal(_test.comparisonHistoryRangeForPeriod({ key: '5y', months: 60 }), '5Y');
assert.equal(_test.comparisonHistoryRangeForPeriod({ key: '10y', months: 120 }), 'MAX');

const points = _test.normalizeReturnPageHistoryPoints({
  source: 'Retorno/Proxy teste',
  points: [
    { date: '2024-01-31', close: 100 },
    { date: '2024-07-31', close: 110 },
    { date: '2025-01-31', close: 120 },
    { date: '2025-07-31', close: 130 },
    { date: '2026-01-31', close: 140 },
    { date: '2026-07-31', close: 160 }
  ]
}, { key: '2y', months: 24 }, 'Retorno/Proxy teste');

assert.ok(points.length >= 2);
assert.equal(points[0].returnPercent, 0);
assert.ok(points.at(-1).investedValue > 1000);

const options = _test.fixedFiiIndexSelectorOptions('GGRC11').map(item => item.code);
assert.deepEqual(options, ['IFIX', 'CDI', 'IPCA', 'IBOV', 'SMLL', 'IDIV', 'IVVB11']);

const official = _test.FII_INDEX_BENCHMARKS.filter(item => ['IFIX', 'SMLL', 'IDIV', 'IBOV'].includes(item.code));
assert.ok(official.every(item => item.kind === 'official_return_index'));

console.log('fii-modal-return-index-reuse-v210 ok');
