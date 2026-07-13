import assert from 'node:assert/strict';
import { _test } from '../lib/analysis/fii-modal-contract.js';

assert.equal(_test.FII_MODAL_VERSION, '26.asset-modal.fii.v24-data-truth');

const points = _test.normalizeComparisonPoints({
  source: 'YahooChart',
  points: [
    { date: '2024-07-01T00:00:00.000Z', close: 100 },
    { date: '2025-07-01T00:00:00.000Z', close: 110 },
    { date: '2026-07-01T00:00:00.000Z', close: 125 }
  ]
});
const items = _test.comparisonItemsForSelectableSeries([
  { id: 'asset', code: 'GGRC11', label: 'GGRC11', points, source: 'Yahoo Finance Chart API ativo' },
  { id: 'ifix', code: 'IFIX', label: 'IFIX', points, source: 'Yahoo Finance Chart API índice direto IFIX.SA' },
  { id: 'smll', code: 'SMLL', label: 'SMLL', points, source: 'Yahoo Finance Chart API índice direto SMLL.SA' },
  { id: 'idiv', code: 'IDIV', label: 'IDIV', points, source: 'Yahoo Finance Chart API índice direto IDIV.SA' }
], '2y');

assert.deepEqual(items.map(item => item.code), ['GGRC11', 'IFIX', 'SMLL', 'IDIV']);
assert.equal(items.find(item => item.code === 'IFIX')?.investedValueDisplay, 'R$ 1.250,00');
assert.equal(items.find(item => item.code === 'SMLL')?.returnDisplay, '+25,00%');
assert.equal(items.find(item => item.code === 'IDIV')?.selectorEnabled, true);

console.log('fii-modal-index-selector-v201 ok');
