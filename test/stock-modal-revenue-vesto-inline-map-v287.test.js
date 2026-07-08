import assert from 'node:assert/strict';
import { _test } from '../lib/analysis/stock-modal-contract.js';

const investidor10RegionPieMap = {
  2025: {
    Brasil: { value: 71 },
    China: { value: 11 },
    Europa: { value: 8 },
    Outros: { value: 10 }
  },
  2024: {
    Brasil: { value: 69 },
    China: { value: 12 }
  }
};
const regionRows = _test.rowsFromRevenueCandidate(investidor10RegionPieMap, 'region');
assert.equal(regionRows.length, 4, 'region rows must be extracted from Vesto/Investidor10 year -> label -> { value } map');
assert.equal(regionRows[0].label, 'Brasil');
assert.equal(regionRows[0].percent, 71);
assert.equal(regionRows[0].amountDisplay, '—', 'value-only pie slices must not be shown as a monetary amount');
assert.equal(regionRows[0].period, '2025');
assert.equal(regionRows[1].label, 'China');
assert.equal(regionRows[1].percent, 11);

const investidor10BusinessPieMap = {
  2025: {
    Diesel: { value: 42 },
    Gasolina: { value: 25 },
    GLP: { value: 12 },
    Outros: { value: 21 }
  }
};
const businessRows = _test.rowsFromRevenueCandidate(investidor10BusinessPieMap, 'business');
assert.equal(businessRows.length, 4, 'business rows must be extracted from Vesto/Investidor10 year -> segment -> { value } map');
assert.equal(businessRows[0].label, 'Diesel');
assert.equal(businessRows[0].percent, 42);
assert.equal(businessRows[0].period, '2025');
assert.equal(businessRows[1].label, 'Gasolina');
assert.equal(businessRows[1].percent, 25);

const regionBreakdown = _test.buildStockRevenueBreakdownPayload({
  canonical: { revenueGeography: investidor10RegionPieMap },
  ticker: 'PETR4',
  name: 'Petrobras'
}, 'region');
assert.equal(regionBreakdown.status, 'OK', 'stock revenue payload must become OK from Vesto/Investidor10 inline pie map');
assert.equal(regionBreakdown.selectedYear, '2025');
assert.equal(regionBreakdown.items.length, 4);
assert.deepEqual(regionBreakdown.items.map(item => item.label), ['Brasil', 'China', 'Outros', 'Europa']);

const businessBreakdown = _test.buildStockRevenueBreakdownPayload({
  canonical: { revenueSegment: investidor10BusinessPieMap },
  ticker: 'PETR4',
  name: 'Petrobras'
}, 'business');
assert.equal(businessBreakdown.status, 'OK', 'stock business revenue payload must become OK from Vesto/Investidor10 inline pie map');
assert.equal(businessBreakdown.selectedYear, '2025');
assert.equal(businessBreakdown.items.length, 4);
assert.deepEqual(businessBreakdown.items.map(item => item.label), ['Diesel', 'Gasolina', 'Outros', 'GLP']);

console.log('stock-modal-revenue-vesto-inline-map-v287 ok');
