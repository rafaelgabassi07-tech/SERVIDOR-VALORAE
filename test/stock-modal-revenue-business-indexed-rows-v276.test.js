import assert from 'node:assert/strict';
import { _test } from '../lib/analysis/stock-modal-contract.js';

const indexedBusinessPayload = {
  columns: [
    { data: '0', title: 'Negócio' },
    { data: '1', title: 'Receita' },
    { data: '2', title: 'Participação' }
  ],
  data: [
    { 0: 'Diesel', 1: 'R$ 38,36 Bilhões', 2: '30%' },
    { 0: 'Petróleo', 1: 'R$ 34,52 Bilhões', 2: '27%' },
    { 0: 'Gasolina', 1: 'R$ 17,62 Bilhões', 2: '14%' }
  ],
  totalAmountDisplay: 'R$ 127,37 Bilhões',
  selectedYear: '2025'
};

const rows = _test.rowsFromRevenueCandidate(indexedBusinessPayload, 'business');
assert.equal(rows.length, 3);
assert.equal(rows[0].label, 'Diesel');
assert.equal(rows[0].amountDisplay, 'R$ 38,36 Bilhões');
assert.equal(rows[0].percent, 30);

const business = _test.buildStockRevenueBreakdownPayload({ canonical: { revenueByBusiness: indexedBusinessPayload }, ticker: 'PETR4', name: 'Petrobras' }, 'business');
assert.equal(business.status, 'OK');
assert.equal(business.items.length, 3);
assert.equal(business.items[1].label, 'Petróleo');
assert.equal(business.items[1].percentDisplay, '27%');
assert.equal(business.totalAmountDisplay, 'R$ 127,37 Bilhões');

const indexedRegionPayload = {
  columns: [
    { data: 'name', title: 'Região' },
    { data: 'value', title: 'Valor da receita' },
    { data: 'share', title: '%' }
  ],
  rows: [
    { name: 'Brasil', value: 'R$ 89,95 Bilhões', share: '71%' },
    { name: 'China', value: 'R$ 13,67 Bilhões', share: '11%' }
  ]
};
const region = _test.buildStockRevenueBreakdownPayload({ canonical: { revenueByRegion: indexedRegionPayload }, ticker: 'PETR4', name: 'Petrobras' }, 'region');
assert.equal(region.status, 'OK');
assert.equal(region.items[0].label, 'Brasil');
assert.equal(region.items[0].percent, 71);

console.log('stock-modal-revenue-business-indexed-rows-v276 ok');
