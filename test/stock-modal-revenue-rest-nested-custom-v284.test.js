import assert from 'node:assert/strict';
import { _test } from '../lib/analysis/stock-modal-contract.js';

const restLike = {
  ticker: 'PETR4',
  payload: {
    company: { name: 'Petrobras' },
    receitas: {
      origemReceita: {
        anos: [2025, 2024],
        items: [
          { localidade: 'Brasil', custom: { valorReceita: 89950000000, valorDisplay: 'R$ 89,95 Bilhões', participacao: '71%' } },
          { localidade: 'China', custom: { valorReceita: 13670000000, valorDisplay: 'R$ 13,67 Bilhões', participacao: '11%' } }
        ],
        receitaTotalDisplay: 'R$ 127,37 Bilhões'
      },
      linhasDeNegocio: {
        rows: [
          { linha_negocio: 'Diesel', meta: { receitaBruta: 38360000000, receitaDisplay: 'R$ 38,36 Bilhões', revenueShare: 30 } },
          { linha_negocio: 'Petróleo', meta: { receitaBruta: 34520000000, receitaDisplay: 'R$ 34,52 Bilhões', revenueShare: 27 } },
          { linha_negocio: 'Gasolina', meta: { receitaBruta: 17620000000, receitaDisplay: 'R$ 17,62 Bilhões', revenueShare: 14 } }
        ],
        totalAmountDisplay: 'R$ 127,37 Bilhões'
      }
    }
  }
};

const regionRows = _test.rowsFromRevenueCandidate(restLike, 'region');
assert.equal(regionRows.length, 2);
assert.equal(regionRows[0].label, 'Brasil');
assert.equal(regionRows[0].percent, 71);

const businessRows = _test.rowsFromRevenueCandidate(restLike, 'business');
assert.equal(businessRows.length, 3);
assert.equal(businessRows[0].label, 'Diesel');
assert.equal(businessRows[0].amountDisplay, 'R$ 38,36 Bilhões');

const canonical = { rawJson: { assetTickerRest: restLike } };
const region = _test.buildStockRevenueBreakdownPayload({ canonical, ticker: 'PETR4', name: 'Petrobras' }, 'region');
const business = _test.buildStockRevenueBreakdownPayload({ canonical, ticker: 'PETR4', name: 'Petrobras' }, 'business');
assert.equal(region.status, 'OK');
assert.equal(business.status, 'OK');
assert.equal(region.items[0].label, 'Brasil');
assert.equal(business.items[0].label, 'Diesel');

console.log('stock-modal-revenue-rest-nested-custom-v284 ok');
