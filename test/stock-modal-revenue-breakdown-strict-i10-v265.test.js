import assert from 'node:assert/strict';
import { _test } from '../lib/analysis/stock-modal-contract.js';

const restWithAmountSeriesAndNoise = {
  ticker: 'PETR4',
  noticias: [
    { title: 'Negócios Petrobras (PETR4) lucra R$ 110 bi e puxa estatais', value: '70%' },
    { title: 'Mercado Petrobras reduz preço do diesel', percent: '12%' }
  ],
  discussao: [
    { title: 'Vou vender', value: '30%' },
    { title: 'Sou iniciante', value: '3%' }
  ],
  indicadores: [
    { name: 'DY', value: '7,69%' },
    { name: 'ROE', value: '24,17%' },
    { name: 'P/VP', value: '1,11' }
  ],
  receita: {
    distribuicao: {
      geografica: {
        selectedYear: 2025,
        labels: ['Brasil', 'China', 'Ásia', 'Europa', 'Américas'],
        series: [{ label: '2025', data: [89950000000, 13670000000, 6190000000, 5250000000, 5130000000] }],
        totalAmount: 127370000000
      },
      negocios: {
        selectedYear: 2025,
        labels: ['Diesel', 'Petróleo', 'Gasolina', 'Óleo combustível (incluindo bunker)', 'Querosene de aviação (QAV)'],
        series: [{ label: '2025', data: [38360000000, 34520000000, 17620000000, 7360000000, 6320000000] }],
        totalAmount: 127370000000
      }
    }
  }
};

const canonical = { rawJson: { assetTickerRest: restWithAmountSeriesAndNoise } };

const region = _test.buildStockRevenueBreakdownPayload({ canonical, ticker: 'PETR4', name: 'Petrobras' }, 'region');
assert.equal(region.status, 'OK');
assert.equal(region.selectedYear, '2025');
assert.equal(region.totalAmountDisplay, 'R$ 127,37 Bilhões');
assert.deepEqual(region.items.map(item => item.label), ['Brasil', 'China', 'Ásia', 'Europa', 'Américas']);
assert.deepEqual(region.items.map(item => item.percentDisplay), ['70,62%', '10,73%', '4,86%', '4,12%', '4,03%']);
assert.ok(!JSON.stringify(region.items).includes('Negócios Petrobras'));
assert.ok(!JSON.stringify(region.items).includes('DY'));
assert.ok(!JSON.stringify(region.items).includes('Sou iniciante'));

const business = _test.buildStockRevenueBreakdownPayload({ canonical, ticker: 'PETR4', name: 'Petrobras' }, 'business');
assert.equal(business.status, 'OK');
assert.equal(business.selectedYear, '2025');
assert.equal(business.totalAmountDisplay, 'R$ 127,37 Bilhões');
assert.deepEqual(business.items.map(item => item.label), ['Diesel', 'Petróleo', 'Gasolina', 'Óleo combustível (incluindo bunker)', 'Querosene de aviação (QAV)']);
assert.deepEqual(business.items.map(item => item.percentDisplay), ['30,12%', '27,10%', '13,83%', '5,78%', '4,96%']);
assert.ok(!JSON.stringify(business.items).includes('Vou vender'));
assert.ok(!JSON.stringify(business.items).includes('ROE'));

console.log('stock-modal-revenue-breakdown-strict-i10-v265 ok');
