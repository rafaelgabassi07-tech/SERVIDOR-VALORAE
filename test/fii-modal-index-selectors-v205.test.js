import assert from 'node:assert/strict';
import { _test } from '../lib/analysis/fii-modal-contract.js';

assert.equal(_test.FII_MODAL_VERSION, '26.asset-modal.fii.v21');

const plans2y = _test.comparisonFetchPlans({ key: '2y', range: '2Y', interval: '1wk' });
assert.ok(plans2y.some(plan => plan.range === '2Y' && plan.interval === '1mo'));
assert.ok(plans2y.some(plan => plan.range === '2Y' && plan.interval === '1d'));

const benchmarks = _test.FII_INDEX_BENCHMARKS;
assert.deepEqual(benchmarks.filter(item => ['IFIX', 'SMLL', 'IDIV'].includes(item.code)).map(item => item.yahooSymbol), ['IFIX.SA', 'SMLL.SA', 'IDIV.SA']);
assert.deepEqual(benchmarks.find(item => item.code === 'IFIX')?.yahooSymbols, ['IFIX.SA', '^IFIX']);
assert.deepEqual(benchmarks.find(item => item.code === 'SMLL')?.yahooSymbols, ['SMLL.SA', '^SMLL']);
assert.deepEqual(benchmarks.find(item => item.code === 'IDIV')?.yahooSymbols, ['IDIV.SA', '^IDIV']);

console.log('fii-modal-index-selectors-v205 ok');
