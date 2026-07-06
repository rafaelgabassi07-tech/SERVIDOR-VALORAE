import assert from 'node:assert/strict';
import { _test } from '../lib/analysis/stock-modal-contract.js';

const assetTickerRestAmountOnly = {
  ticker: 'PETR4',
  companyId: 9512,
  empresa: { nome: 'Petrobras' },
  receita: {
    distribuicao: {
      geografica: {
        selectedYear: 2025,
        totalValue: 127370000000,
        data: {
          2025: [
            { pais: 'Brasil', valor: 89950000000 },
            { pais: 'China', valor: 13670000000 },
            { pais: 'Ásia', valor: 6190000000 },
            { pais: 'Europa', valor: 5250000000 },
            { pais: 'Américas', valor: 5130000000 }
          ]
        }
      },
      negocios: {
        ano: 2025,
        totalAmount: 127370000000,
        rows: [
          { negocio: 'Diesel', value: 38360000000 },
          { negocio: 'Petróleo', value: 34520000000 },
          { negocio: 'Gasolina', value: 17620000000 }
        ]
      }
    }
  },
  posicaoAcionaria: {
    columns: ['Acionista', '% ON', '% PN', '% Total'],
    rows: [
      ['OUTROS', '40,77%', '67,21%', '52,03%'],
      ['UNIÃO FEDERAL', '50,26%', '0,00%', '29,02%'],
      ['BNDES PARTICIPAÇÕES - BNDESPAR', '0,00%', '16,53%', '7,04%']
    ]
  }
};

const canonical = { rawJson: { assetTickerRest: assetTickerRestAmountOnly } };

const region = _test.buildStockRevenueBreakdownPayload({ canonical, ticker: 'PETR4', name: 'Petrobras' }, 'region');
assert.equal(region.status, 'OK');
assert.equal(region.selectedYear, '2025');
assert.equal(region.items.length >= 5, true);
assert.equal(region.items[0].label, 'Brasil');
assert.equal(region.items[0].amountDisplay, 'R$ 89,95 Bilhões');
assert.equal(Math.round(region.items[0].percent), 71);
assert.equal(region.totalAmountDisplay, 'R$ 127,37 Bilhões');

const business = _test.buildStockRevenueBreakdownPayload({ canonical, ticker: 'PETR4', name: 'Petrobras' }, 'business');
assert.equal(business.status, 'OK');
assert.equal(business.items[0].label, 'Diesel');
assert.equal(business.items[0].amountDisplay, 'R$ 38,36 Bilhões');
assert.equal(Math.round(business.items[0].percent), 30);

const shareholding = _test.buildStockShareholdingPayload({ canonical, ticker: 'PETR4' });
assert.equal(shareholding.status, 'OK');
assert.equal(shareholding.rows.length, 3);
assert.equal(shareholding.rows[0].shareholder, 'OUTROS');
assert.equal(shareholding.rows[0].totalPercentDisplay, '52,03%');
assert.equal(shareholding.rows[1].shareholder, 'UNIÃO FEDERAL');
assert.equal(shareholding.rows[1].pnPercentDisplay, '0,00%');

console.log('stock-modal-revenue-region-shareholding-i10-v263 ok');
