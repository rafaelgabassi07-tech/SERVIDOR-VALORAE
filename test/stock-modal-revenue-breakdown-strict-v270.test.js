import assert from 'node:assert/strict';
import { _test } from '../lib/analysis/stock-modal-contract.js';

const pollutedAssetRest = {
  data: {
    ticker: 'CRFB3',
    segmento: 'Alimentos',
    is_active: 1,
    tag_along: 100,
    free_float: 67.52,
    variation_30_days: 32.3,
    gross_margin: 24.87,
    p_l: 8.53,
    variation_5_days: 8.21,
    ev_ebitda: 7.3,
    ebitda_margin: 5.26,
  },
};

const business = _test.buildStockRevenueBreakdownPayload({
  ticker: 'CRFB3',
  name: 'Atacadão - Carrefour',
  canonical: { rawJson: { assetTickerRest: pollutedAssetRest } },
}, 'business');

assert.equal(business.status, 'EMPTY');
assert.deepEqual(business.items, []);
assert.equal(business.diagnostics.strictRevenueOnly, true);

const region = _test.buildStockRevenueBreakdownPayload({
  ticker: 'CRFB3',
  name: 'Atacadão - Carrefour',
  canonical: { rawJson: { assetTickerRest: pollutedAssetRest } },
}, 'region');
assert.equal(region.status, 'EMPTY');
assert.deepEqual(region.items, []);

const validBusiness = _test.buildStockRevenueBreakdownPayload({
  ticker: 'PETR4',
  name: 'Petrobras',
  canonical: {
    rawJson: {
      revenueSegmentSources: [{
        selectedYear: 2025,
        items: [
          { label: 'Diesel', amountDisplay: 'R$ 38,36 Bilhões', percentDisplay: '30%' },
          { label: 'Petróleo', amountDisplay: 'R$ 34,52 Bilhões', percentDisplay: '27%' },
          { label: 'Gasolina', amountDisplay: 'R$ 17,62 Bilhões', percentDisplay: '14%' },
          { label: 'tag_along', percent: 100 },
        ],
      }],
    },
  },
}, 'business');

assert.equal(validBusiness.status, 'OK');
assert.deepEqual(validBusiness.items.map(item => item.label), ['Diesel', 'Petróleo', 'Gasolina']);
assert.ok(validBusiness.items.every(item => !/tag_along|free_float|gross_margin|p_l|variation_/i.test(item.label)));

const validRegion = _test.buildStockRevenueBreakdownPayload({
  ticker: 'PETR4',
  name: 'Petrobras',
  canonical: {
    rawJson: {
      revenueGeographySources: [{
        ano: 2025,
        labels: ['Brasil', 'América do Norte', 'Europa'],
        datasets: [{ data: [58, 22, 20] }],
        amountsDisplay: ['R$ 122,26 Bilhões', 'R$ 46,37 Bilhões', 'R$ 42,15 Bilhões'],
      }],
      revenueSegmentSources: [{ items: [{ label: 'Diesel', percent: 30 }] }],
    },
  },
}, 'region');
assert.equal(validRegion.status, 'OK');
assert.deepEqual(validRegion.items.map(item => item.label), ['Brasil', 'América do Norte', 'Europa']);
assert.ok(!validRegion.items.some(item => item.label === 'Diesel'), 'fonte de negócio não deve contaminar região');

console.log('stock-modal-revenue-breakdown-strict-v270 ok');
