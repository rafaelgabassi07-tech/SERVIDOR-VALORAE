import assert from 'node:assert/strict';
import { _test } from '../lib/analysis/stock-modal-contract.js';

const html = `
<html><body>
  <h2>Regiões onde Petrobras gera receita</h2>
  <div id="company-geographic-revenues-chart-pie"></div>
  <script>
    Highcharts.chart('company-geographic-revenues-chart-pie', {
      title: { text: '' },
      series: [{
        name: '2025',
        type: 'pie',
        data: [
          { name: 'Brasil', y: 89950000000, custom: { amountDisplay: 'R$ 89,95 Bilhões', percentDisplay: '71%' } },
          { name: 'China', y: 13670000000, custom: { amountDisplay: 'R$ 13,67 Bilhões', percentDisplay: '11%' } },
          { name: 'Ásia', y: 6190000000, custom: { amountDisplay: 'R$ 6,19 Bilhões', percentDisplay: '5%' } }
        ]
      }]
    });
  </script>
  <h2>negócios que geram receita para Petrobras</h2>
  <div id="company-business-revenues-chart-pie"></div>
  <script>
    window.companyBusinessRevenuesChartPie = {
      years: [2025, 2024],
      series: [{
        name: '2025',
        data: [
          { name: 'Diesel', y: 38360000000, custom: { valorDisplay: 'R$ 38,36 Bilhões', percentualDisplay: '30%' } },
          { name: 'Petróleo', y: 34520000000, custom: { valorDisplay: 'R$ 34,52 Bilhões', percentualDisplay: '27%' } },
          { name: 'Gasolina', y: 17620000000, custom: { valorDisplay: 'R$ 17,62 Bilhões', percentualDisplay: '14%' } }
        ]
      }],
      totalAmountDisplay: 'R$ 127,37 Bilhões'
    };
  </script>
</body></html>`;

const embedded = _test.extractInvestidor10StockEmbeddedAnalysisData(html);
assert.ok(embedded.revenueGeography, 'expected embedded geographic revenue chart');
assert.ok(embedded.revenueSegment, 'expected embedded business revenue chart');

const region = _test.buildStockRevenueBreakdownPayload({ html, ticker: 'PETR4', name: 'Petrobras' }, 'region');
assert.equal(region.status, 'OK');
assert.deepEqual(region.items.map(item => item.label), ['Brasil', 'China', 'Ásia']);
assert.equal(region.items[0].amountDisplay, 'R$ 89,95 Bilhões');
assert.equal(region.items[0].percentDisplay, '71%');

const business = _test.buildStockRevenueBreakdownPayload({ html, ticker: 'PETR4', name: 'Petrobras' }, 'business');
assert.equal(business.status, 'OK');
assert.deepEqual(business.items.map(item => item.label), ['Diesel', 'Petróleo', 'Gasolina']);
assert.equal(business.items[0].amountDisplay, 'R$ 38,36 Bilhões');
assert.equal(business.items[2].percentDisplay, '14%');

console.log('stock-modal-revenue-highcharts-realistic-v284 ok');
