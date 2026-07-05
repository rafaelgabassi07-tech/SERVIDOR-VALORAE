import assert from 'node:assert/strict';
import { _test } from '../lib/analysis/stock-modal-contract.js';

const htmlWithJsLikePayload = `
<html><body>
<h2>Regiões onde Petrobras gera receita</h2>
<script>
  window.companyRevenuesChartPie = {
    labels: ['Brasil', 'China', 'Ásia', 'Europa', 'Américas'],
    datasets: [{ label: '2025', data: [71, 11, 5, 4, 4] }],
    valoresDisplay: ['R$ 89,95 Bilhões', 'R$ 13,67 Bilhões', 'R$ 6,19 Bilhões', 'R$ 5,25 Bilhões', 'R$ 5,13 Bilhões'],
    totalAmountDisplay: 'R$ 127,37 Bilhões'
  };
</script>
<h2>Negócios que geram receita para Petrobras</h2>
<script>
  const companyBussinesRevenuesChartPie = {
    labels: ['Diesel', 'Petróleo', 'Gasolina', 'Óleo combustível', 'Querosene de aviação (QAV)'],
    datasets: [{ label: '2025', data: [30, 27, 14, 6, 5] }],
    valoresDisplay: ['R$ 38,36 Bilhões', 'R$ 34,52 Bilhões', 'R$ 17,62 Bilhões', 'R$ 7,36 Bilhões', 'R$ 6,32 Bilhões'],
    totalAmountDisplay: 'R$ 127,37 Bilhões'
  };
</script>
</body></html>`;

const embedded = _test.extractInvestidor10StockEmbeddedAnalysisData(htmlWithJsLikePayload);
assert.ok(embedded.revenueGeography, 'deve extrair companyRevenuesChartPie JS-like do Investidor10');
assert.ok(embedded.revenueSegment, 'deve extrair companyBussinesRevenuesChartPie JS-like do Investidor10');

const region = _test.buildStockRevenueBreakdownPayload({ html: htmlWithJsLikePayload, ticker: 'PETR4', name: 'Petrobras' }, 'region');
assert.equal(region.status, 'OK');
assert.equal(region.items.length, 5);
assert.equal(region.items[0].label, 'Brasil');
assert.equal(region.items[0].amountDisplay, 'R$ 89,95 Bilhões');
assert.equal(region.items[0].percent, 71);
assert.equal(region.totalAmountDisplay, 'R$ 127,37 Bilhões');

const business = _test.buildStockRevenueBreakdownPayload({ html: htmlWithJsLikePayload, ticker: 'PETR4', name: 'Petrobras' }, 'business');
assert.equal(business.status, 'OK');
assert.equal(business.items.length, 5);
assert.equal(business.items[0].label, 'Diesel');
assert.equal(business.items[0].amountDisplay, 'R$ 38,36 Bilhões');
assert.equal(business.items[0].percentDisplay, '30%');

const objectMapRegion = _test.rowsFromRevenueCandidate({ Brasil: 71, China: 11, Europa: 4 }, 'region');
assert.equal(objectMapRegion.length, 3);
assert.equal(objectMapRegion[0].label, 'Brasil');

const highchartsRegion = _test.rowsFromRevenueCandidate({ series: [{ data: [{ name: 'Brasil', y: 71, valorDisplay: 'R$ 89,95 Bilhões' }, ['China', 11]] }] }, 'region');
assert.equal(highchartsRegion.length, 2);
assert.equal(highchartsRegion[0].label, 'Brasil');
assert.equal(highchartsRegion[0].amountDisplay, 'R$ 89,95 Bilhões');

console.log('stock-modal-revenue-region-i10-v250 OK');
