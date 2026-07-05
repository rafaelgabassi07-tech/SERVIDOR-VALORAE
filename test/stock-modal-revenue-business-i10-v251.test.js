import assert from 'node:assert/strict';
import { _test } from '../lib/analysis/stock-modal-contract.js';

const htmlAccessibleBusiness = `
<section>
  <h2>negócios que geram receita para Petrobras</h2>
  <button>2025</button><button>2024</button>
  Diesel R$ 38,36 Bilhões 30%
  Petróleo R$ 34,52 Bilhões 27%
  Gasolina R$ 17,62 Bilhões 14%
  Óleo combustível (incluindo bunker) R$ 7,36 Bilhões 6%
  Querosene de aviação (QAV) R$ 6,32 Bilhões 5%
  Total (trimestral) R$ 127,37 Bilhões
  <h2>POSIÇÃO ACIONÁRIA DA PETR4</h2>
</section>`;

const fromAccessible = _test.buildStockRevenueBreakdownPayload({ html: htmlAccessibleBusiness, ticker: 'PETR4', name: 'Petrobras' }, 'business');
assert.equal(fromAccessible.status, 'OK');
assert.equal(fromAccessible.selectedYear, '2025');
assert.equal(fromAccessible.totalAmountDisplay, 'R$ 127,37 Bilhões');
assert.equal(fromAccessible.items.length, 5);
assert.equal(fromAccessible.items[0].label, 'Diesel');
assert.equal(fromAccessible.items[0].amountDisplay, 'R$ 38,36 Bilhões');
assert.equal(fromAccessible.items[0].percentDisplay, '30%');

const htmlJsonParseBusiness = String.raw`
<script>
window.companyBussinessRevenuesChartPie = JSON.parse('{"labels":["Diesel","Petróleo","Gasolina"],"datasets":[{"label":"2025","data":[30,27,14]}],"dataLabels":["R$ 38,36 Bilhões","R$ 34,52 Bilhões","R$ 17,62 Bilhões"],"totalAmountDisplay":"R$ 127,37 Bilhões"}');
</script>`;
const embedded = _test.extractInvestidor10StockEmbeddedAnalysisData(htmlJsonParseBusiness);
assert.ok(embedded.revenueSegment, 'deve ler JSON.parse com alias companyBussinessRevenuesChartPie');
const fromJsonParse = _test.buildStockRevenueBreakdownPayload({ html: htmlJsonParseBusiness, ticker: 'PETR4', name: 'Petrobras' }, 'business');
assert.equal(fromJsonParse.status, 'OK');
assert.equal(fromJsonParse.selectedYear, '2025');
assert.equal(fromJsonParse.items[0].label, 'Diesel');
assert.equal(fromJsonParse.items[0].amountDisplay, 'R$ 38,36 Bilhões');

const canonicalBusiness = {
  revenueBreakdowns: {
    byBusiness: {
      labels: ['Diesel', 'Petróleo', 'Gasolina'],
      series: [{ name: '2025', data: [30, 27, 14] }],
      formattedValues: ['R$ 38,36 Bilhões', 'R$ 34,52 Bilhões', 'R$ 17,62 Bilhões'],
      totalValueDisplay: 'R$ 127,37 Bilhões'
    }
  }
};
const fromCanonical = _test.buildStockRevenueBreakdownPayload({ canonical: canonicalBusiness, ticker: 'PETR4', name: 'Petrobras' }, 'business');
assert.equal(fromCanonical.status, 'OK');
assert.equal(fromCanonical.selectedYear, '2025');
assert.deepEqual(fromCanonical.years, ['2025']);
assert.equal(fromCanonical.totalAmountDisplay, 'R$ 127,37 Bilhões');
assert.equal(fromCanonical.items[1].label, 'Petróleo');
assert.equal(fromCanonical.items[1].amountDisplay, 'R$ 34,52 Bilhões');

const tupleRows = _test.rowsFromRevenueCandidate([
  ['Diesel', 'R$ 38,36 Bilhões', '30%'],
  ['Petróleo', 'R$ 34,52 Bilhões', '27%']
], 'business');
assert.equal(tupleRows.length, 2);
assert.equal(tupleRows[0].label, 'Diesel');
assert.equal(tupleRows[0].amountDisplay, 'R$ 38,36 Bilhões');

console.log('stock-modal-revenue-business-i10-v251 ok');
