import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../lib/analysis/stock-modal-contract.js', import.meta.url), 'utf8');

for (const token of [
  'stockRevenueByRegion: revenueByRegion',
  'stockRevenueByBusiness: revenueByBusiness',
  'stockRevenueByRegion: investidor10?.revenueByRegion',
  'stockRevenueByBusiness: investidor10?.revenueByBusiness'
]) {
  assert.ok(source.includes(token), `stock modal contract missing ${token}`);
}

console.log('stock-revenue-contract-aliases-v281 ok');
