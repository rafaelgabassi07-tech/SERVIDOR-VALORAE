import assert from 'node:assert/strict';
import { _test } from '../lib/analysis/stock-modal-contract.js';

const seoText = [
  'Regiões onde Petrobras gera receita. 2025, 2024. 2025.',
  'Brasil. R$ 89,95 Bilhões. 71%.',
  'China. R$ 13,67 Bilhões. 11%.',
  'Ásia. R$ 6,19 Bilhões. 5%.',
  'Total (trimestral) R$ 127,37 Bilhões.',
  'Cotação.',
  'negócios que geram receita para Petrobras. 2025, 2024. 2025.',
  'Diesel. R$ 38,36 Bilhões. 30%.',
  'Petróleo. R$ 34,52 Bilhões. 27%.',
  'Gasolina. R$ 17,62 Bilhões. 14%.'
].join(' ');

const html = `
<html>
  <head>
    <meta property="og:description" content="${seoText.replace(/"/g, '&quot;')}">
  </head>
  <body>
    <h2>Regiões onde Petrobras gera receita</h2>
    <ul><li>2025 2024</li></ul>
    <img alt="Cotação">
    <h2>negócios que geram receita para Petrobras</h2>
    <ul><li>2025 2024</li></ul>
    <img>
  </body>
</html>`;

const searchable = _test.stockRevenueSearchableText(html);
assert.match(searchable, /Brasil\. R\$ 89,95 Bilhões\. 71%/);
assert.match(searchable, /Diesel\. R\$ 38,36 Bilhões\. 30%/);

const region = _test.buildStockRevenueBreakdownPayload({ html, ticker: 'PETR4', name: 'Petrobras' }, 'region');
assert.equal(region.status, 'OK');
assert.deepEqual(region.items.map(item => item.label), ['Brasil', 'China', 'Ásia']);
assert.equal(region.items[0].percent, 71);
assert.equal(region.totalAmountDisplay, 'R$ 127,37 Bilhões');

const business = _test.buildStockRevenueBreakdownPayload({ html, ticker: 'PETR4', name: 'Petrobras' }, 'business');
assert.equal(business.status, 'OK');
assert.deepEqual(business.items.map(item => item.label), ['Diesel', 'Petróleo', 'Gasolina']);
assert.equal(business.items[0].amountDisplay, 'R$ 38,36 Bilhões');
assert.equal(business.items[2].percentDisplay, '14%');

console.log('stock-modal-revenue-seo-hidden-v277 ok');
