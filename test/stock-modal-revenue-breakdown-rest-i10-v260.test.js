import assert from 'node:assert/strict';
import { _test } from '../lib/analysis/stock-modal-contract.js';

const assetTickerRestShape = {
  ticker: 'PETR4',
  company: { id: 1, name: 'Petrobras' },
  revenueBreakdowns: {
    geography: {
      years: [2025, 2024],
      data: {
        2025: [
          { regiao: 'Brasil', receitaDisplay: 'R$ 89,95 Bilhões', percentual: 71 },
          { regiao: 'China', receitaDisplay: 'R$ 13,67 Bilhões', percentual: 11 },
          { regiao: 'Ásia', receitaDisplay: 'R$ 6,19 Bilhões', percentual: 5 }
        ]
      },
      totalAmountDisplay: 'R$ 127,37 Bilhões'
    },
    byBusiness: {
      2025: [
        { negocio: 'Diesel', receitaDisplay: 'R$ 38,36 Bilhões', percentualDisplay: '30%' },
        { negocio: 'Petróleo', receitaDisplay: 'R$ 34,52 Bilhões', percentualDisplay: '27%' },
        { negocio: 'Gasolina', receitaDisplay: 'R$ 17,62 Bilhões', percentualDisplay: '14%' }
      ],
      totalAmountDisplay: 'R$ 127,37 Bilhões'
    }
  }
};

const canonical = { rawJson: { assetTickerRest: assetTickerRestShape } };
const region = _test.buildStockRevenueBreakdownPayload({ canonical, ticker: 'PETR4', name: 'Petrobras' }, 'region');
assert.equal(region.status, 'OK');
assert.equal(region.selectedYear, '2025');
assert.equal(region.items[0].label, 'Brasil');
assert.equal(region.items[0].amountDisplay, 'R$ 89,95 Bilhões');
assert.equal(region.items[0].percent, 71);
assert.equal(region.totalAmountDisplay, 'R$ 127,37 Bilhões');

const business = _test.buildStockRevenueBreakdownPayload({ canonical, ticker: 'PETR4', name: 'Petrobras' }, 'business');
assert.equal(business.status, 'OK');
assert.equal(business.selectedYear, '2025');
assert.equal(business.items[0].label, 'Diesel');
assert.equal(business.items[0].amountDisplay, 'R$ 38,36 Bilhões');
assert.equal(business.items[0].percentDisplay, '30%');

console.log('stock-modal-revenue-breakdown-rest-i10-v260 ok');
