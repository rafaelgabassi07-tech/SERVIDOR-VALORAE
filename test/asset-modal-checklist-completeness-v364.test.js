import assert from 'node:assert/strict';
import { _test } from '../lib/analysis/asset-modal-runtime.js';

const resolvedItem = (index, passed = true) => ({ id: `c${index}`, passed, status: passed ? 'PASSED' : 'FAILED' });
const stockPartial = {
  checklist: {
    id: 'stock_buy_hold_checklist',
    total: 10,
    items: Array.from({ length: 9 }, (_, index) => resolvedItem(index))
  }
};
const stockComplete = {
  checklist: {
    id: 'stock_buy_hold_checklist',
    total: 10,
    items: Array.from({ length: 10 }, (_, index) => resolvedItem(index, index !== 3))
  }
};
const stockPending = structuredClone(stockComplete);
stockPending.checklist.items[4] = { id: 'c4', passed: null, status: 'PENDING_SOURCE' };

assert.equal(_test.stockModalSections(stockPartial).find(([id]) => id === 'checklist')[1], false);
assert.equal(_test.stockModalSections(stockPending).find(([id]) => id === 'checklist')[1], false);
assert.equal(_test.stockModalSections(stockComplete).find(([id]) => id === 'checklist')[1], true);

const fiiComplete = {
  checklist: {
    id: 'fii_buy_hold_checklist',
    total: 8,
    items: Array.from({ length: 8 }, (_, index) => resolvedItem(index))
  }
};
assert.equal(_test.fiiModalSections(fiiComplete).find(([id]) => id === 'checklist')[1], true);
console.log('asset modal checklist only settles with all canonical criteria resolved');
