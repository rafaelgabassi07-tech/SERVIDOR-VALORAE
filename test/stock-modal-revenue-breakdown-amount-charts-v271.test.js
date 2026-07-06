import assert from 'node:assert/strict';
import { _test } from '../lib/analysis/stock-modal-contract.js';

const highchartsAmountPayload = {
  title: { text: 'Regiões onde Petrobras gera receita' },
  series: [{
    type: 'pie',
    data: [
      { name: 'Brasil', y: 89950000000 },
      { name: 'China', y: 13670000000 },
      { name: 'Ásia', y: 6190000000 },
      { name: 'Europa', y: 5250000000 }
    ]
  }],
  totalAmountDisplay: 'R$ 115,06 Bilhões'
};

const regionRows = _test.rowsFromRevenueCandidate(highchartsAmountPayload, 'region');
assert.equal(regionRows.length, 4);
assert.equal(regionRows[0].label, 'Brasil');
assert.ok(regionRows[0].percent > 70 && regionRows[0].percent < 90);
assert.match(regionRows[0].amountDisplay, /R\$/);

const chartJsAmountPayload = {
  selectedYear: 2025,
  labels: ['Diesel', 'Petróleo', 'Gasolina'],
  datasets: [{ label: '2025', data: [38360000000, 34520000000, 17620000000] }],
  totalAmountDisplay: 'R$ 90,50 Bilhões'
};
const business = _test.buildStockRevenueBreakdownPayload({
  ticker: 'PETR4',
  name: 'Petrobras',
  canonical: { rawJson: { revenueSegmentSources: [chartJsAmountPayload] } }
}, 'business');
assert.equal(business.status, 'OK');
assert.deepEqual(business.items.map(item => item.label), ['Diesel', 'Petróleo', 'Gasolina']);
assert.ok(business.items.every(item => item.percent > 0 && item.percent <= 100));
assert.ok(business.items.every(item => /^R\$/.test(item.amountDisplay)));

const htmlHighchartsSection = `
<h2>Regiões onde Petrobras gera receita</h2>
<script>
Highcharts.chart('region-chart', {
  series: [{ type: 'pie', data: [{ name: 'Brasil', y: 89950000000 }, { name: 'China', y: 13670000000 }] }],
  totalAmountDisplay: 'R$ 103,62 Bilhões'
});
</script>
<h2>negócios que geram receita para Petrobras</h2>
<script>
Highcharts.chart('business-chart', {
  labels: ['Diesel','Petróleo'],
  datasets: [{ label: '2025', data: [38360000000, 34520000000] }],
  totalAmountDisplay: 'R$ 72,88 Bilhões'
});
</script>`;
const embedded = _test.extractInvestidor10StockEmbeddedAnalysisData(htmlHighchartsSection);
assert.ok(embedded.revenueGeography, 'deve extrair Highcharts de região no bloco do Investidor10');
assert.ok(embedded.revenueSegment, 'deve extrair Highcharts de negócios no bloco do Investidor10');
const fromHtmlRegion = _test.buildStockRevenueBreakdownPayload({ html: htmlHighchartsSection, ticker: 'PETR4', name: 'Petrobras' }, 'region');
assert.equal(fromHtmlRegion.status, 'OK');
assert.equal(fromHtmlRegion.items[0].label, 'Brasil');

console.log('stock-modal-revenue-breakdown-amount-charts-v271 ok');
