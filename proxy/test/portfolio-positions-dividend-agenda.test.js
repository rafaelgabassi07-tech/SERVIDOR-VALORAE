import assert from 'node:assert/strict';
import { normalizeTransactions, quantityAtDate } from '../lib/portfolio/positions.js';

const transactions = normalizeTransactions([
  { ticker: 'CMIG4', operation: 'COMPRA', quantity: 10, price: 10, date: '2026-01-10' },
  { ticker: 'CMIG4', operation: 'COMPRA', quantity: 20, price: 11, date: '2026-03-10' },
  { ticker: 'CMIG4', operation: 'VENDA', quantity: 5, price: 12, date: '2026-04-10' },
  { ticker: 'CMIG4', operation: 'GRUPAMENTO', quantity: 5, price: 0, date: '2026-05-10' }
]);

assert.equal(transactions[0].quantity, 10);
assert.equal(transactions[2].quantity, -5);
assert.equal(transactions[3].quantity, -5);
assert.equal(quantityAtDate('CMIG4', '2026-02-01', [], transactions), 10);
assert.equal(quantityAtDate('CMIG4', '2026-04-20', [], transactions), 25);
assert.equal(quantityAtDate('CMIG4', '2026-05-20', [], transactions), 20);

const fallbackPositions = [{ ticker: 'ITSA4', quantity: 20, firstPurchaseDate: '2026-01-15' }];
assert.equal(quantityAtDate('ITSA4', '2026-01-10', fallbackPositions, []), 0);
assert.equal(quantityAtDate('ITSA4', '2026-02-10', fallbackPositions, []), 20);

console.log('Portfolio positions dividend agenda tests OK.');
