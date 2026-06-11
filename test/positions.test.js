import assert from 'node:assert/strict';
import { normalizePositions, normalizeTransactions, quantityAtDate } from '../lib/portfolio/positions.js';

const positions = normalizePositions([{ ticker: 'petr4', quantity: 10, averagePrice: 20, currentPrice: 30, sector: 'Petróleo', name: 'Petrobras' }]);
assert.equal(positions[0].ticker, 'PETR4');
assert.equal(positions[0].sector, 'Petróleo');
assert.equal(positions[0].name, 'Petrobras');

const txs = normalizeTransactions([
  { ticker: 'PETR4', quantity: 10, price: 20, date: '2025-01-02', isSell: false },
  { ticker: 'PETR4', quantity: 4, price: 22, date: '2025-02-02', isSell: true }
]);
assert.equal(txs[1].quantity, -4);
assert.equal(quantityAtDate('PETR4', '2025-03-01', [], txs), 6);

const mixedSellTimestamps = normalizeTransactions([
  { ticker: 'BBAS3', quantity: -3, price: 28, date: '2025-03-01', isSell: true },
  { ticker: 'BBAS3', quantity: -2, price: 28, date: '2025-03-02' },
  { ticker: 'BBAS3', quantity: 5, price: 30, date: '2025-03-03', side: 'SELL' }
]);
assert.deepEqual(mixedSellTimestamps.map(t => t.quantity), [-3, -2, -5]);
assert.equal(quantityAtDate('BBAS3', '2025-03-04', [{ ticker: 'BBAS3', quantity: 20, avgPrice: 20, currentPrice: 30 }], mixedSellTimestamps), 0);
