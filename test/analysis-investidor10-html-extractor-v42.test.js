import assert from 'node:assert/strict';
import { _test } from '../lib/sources/asset-details.js';

const html = `
<script>
  var companyRevenuesChartPie = {"labels":["Brasil","Exterior"],"datasets":[{"label":"2025","data":[67.5,32.5],"meta":{"safe":true}}]};
  const companyBussinesRevenuesChartPie = {labels:['Calçados','Outros'], datasets:[{data:['82,4%','17,6%']}], config:{legend:{show:true}}};
  let _sectorIndicators = {pl:{value:"10,20"}, nested:{pvp:{value:"1,40"}}};
  const rentabilidadeChart = {labels:["1 mês"], datasets:[{data:[1.25]}]};
</script>`;

const data = _test.extractInvestidor10EmbeddedAnalysisData(html);
assert.deepEqual(data.revenueGeography.labels, ['Brasil', 'Exterior']);
assert.equal(data.revenueGeography.datasets[0].meta.safe, true);
assert.deepEqual(data.revenueSegment.labels, ['Calçados', 'Outros']);
assert.equal(data.revenueSegment.config.legend.show, true);
assert.equal(data.advancedMetrics.nested.pvp.value, '1,40');
assert.deepEqual(data.rentabilidadeChart.labels, ['1 mês']);

const noSyntheticFinancials = _test.buildSimpleFinancialSeries(
  { valorDeMercado: 1_000_000_000, patrimonioLiquido: 500_000_000, lpa: 2.5, totalAtivos: 700_000_000 },
  [{ label: '2026-06-16', value: 32.1 }],
  {}
);
assert.deepEqual(noSyntheticFinancials.revenueProfit, []);
assert.deepEqual(noSyntheticFinancials.balance, []);
assert.deepEqual(noSyntheticFinancials.profitVsQuote, []);
assert.deepEqual(noSyntheticFinancials.cashFlow, []);
assert.deepEqual(noSyntheticFinancials.incomeStatement, []);

const canonicalStillAccepted = _test.buildSimpleFinancialSeries({}, [], {
  assetChartsCanonical: {
    financial: {
      revenueProfit: [{ year: '2025', netRevenue: 10, netProfit: 2 }],
      balanceSheet: [{ year: '2025', totalAssets: 20, netWorth: 12 }],
      cashFlowStatement: [{ year: '2025', operatingCashFlow: 3 }]
    }
  }
});
assert.equal(canonicalStillAccepted.revenueProfit.length, 1);
assert.equal(canonicalStillAccepted.balance.length, 1);
assert.equal(canonicalStillAccepted.cashFlow.length, 1);

console.log('Analysis Investidor10 HTML extractor v42 test OK.');
