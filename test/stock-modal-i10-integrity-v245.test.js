import assert from 'node:assert/strict';
import { _test } from '../lib/analysis/stock-modal-contract.js';

const unitSeries = {
  xAxis: { categories: ['2025', 'Últ 12M'] },
  series: [
    { name: 'Lucro Líquido', unit: 'Bilhões', data: [110.61, 108.04] },
    { name: 'Payout', data: [43.02, 38.46] },
    { name: 'Dividend Yield', data: [10.49, 7.78] }
  ]
};
const normalizedPayout = _test.normalizeStockPayoutDedicatedSource(unitSeries, { ticker: 'PETR4' });
assert.equal(normalizedPayout.find(point => point.label === '2025').netIncome, 110_610_000_000);
assert.equal(normalizedPayout.find(point => point.label === 'Últ 12M').netIncome, 108_040_000_000);

const noInventedLast12mProfit = _test.buildStockPayoutChartPayload({
  ticker: 'PETR4',
  canonical: { financial: { revenueProfit: [{ year: 2025, netProfit: 110_610_000_000 }] } },
  historicalIndicators: { rows: [
    { label: 'Payout', values: { Atual: '38,46%', '2025': '43,02%' } },
    { label: 'Dividend Yield', values: { Atual: '7,78%', '2025': '10,49%' } }
  ] }
});
assert.equal(noInventedLast12mProfit.points.find(point => point.label === 'Últ 12M')?.netIncome, null);

const numericPercentHistory = _test.buildStockHistoricalIndicators([
  { '5_anos': { categories: ['Atual', '2025'], series: [
    { name: 'ROE', data: [24.17, 26.49] },
    { name: 'Payout', data: [38.46, 43.02] },
    { name: 'P/L', data: [4.54, 3.61] }
  ] } },
  { '10_anos': { rows: [
    ['Indicador', 'Atual', '2025', '2024', '2023', '2022', '2021', '2020'],
    ['ROE', '24,17%', '26,49%', '10,00%', '32,75%', '51,68%', '27,54%', '1,50%']
  ] } }
], 'PETR4');
assert.deepEqual(numericPercentHistory.periods, ['5y', '10y']);
assert.equal(numericPercentHistory.rows.find(row => row.label === 'ROE')?.values.Atual, '24,17%');
assert.equal(numericPercentHistory.rows.find(row => row.label === 'Payout')?.values['2025'], '43,02%');
assert.equal(numericPercentHistory.rows.find(row => row.label === 'P/L')?.values.Atual, '4,54');
assert.equal(numericPercentHistory.tablesByPeriod['10y'].rows.find(row => row.label === 'ROE')?.values['2020'], '1,50%');

const checklistWithSiblingIcons = _test.extractInvestidor10StockBuyHoldChecklist(`
  <section class="checklist-area">
    <h2>CHECKLIST DO INVESTIDOR BUY AND HOLD SOBRE PETR4</h2>
    <div class="checklist-row"><span class="icon icon-check success"></span><span>Empresa com mais de 5 anos de Bolsa</span></div>
    <div class="checklist-row"><span class="icon icon-xmark danger unchecked"></span><span>Empresa nunca deu prejuízo (ano fiscal)</span></div>
    <div class="checklist-row"><span class="icon icon-check success"></span><span>Empresa com lucro nos últimos 20 trimestres (5 anos)</span></div>
    <div class="checklist-row"><span class="icon icon-check success"></span><span>Empresa pagou +5% de dividendos/ano nos últimos 5 anos</span></div>
    <div class="checklist-row"><span class="icon icon-check success"></span><span>Empresa possui ROE acima de 10%</span></div>
    <div class="checklist-row"><span class="icon icon-check success"></span><span>Empresa possui dívida menor que patrimônio</span></div>
    <div class="checklist-row"><span class="icon icon-check success"></span><span>Empresa apresentou crescimento de receita nos últimos 5 anos</span></div>
    <div class="checklist-row"><span class="icon icon-check success"></span><span>Empresa apresentou crescimento de lucros nos últimos 5 anos</span></div>
    <div class="checklist-row"><span class="icon icon-check success"></span><span>Empresa possui liquidez diária acima de US$ 2M</span></div>
    <div class="checklist-row"><span class="icon icon-check success"></span><span>Empresa é bem avaliada pelos usuários do Investidor10</span></div>
  </section><section><h2>Histórico de Dividendos - PETR4</h2></section>
`, 'PETR4');
assert.equal(checklistWithSiblingIcons.items.length, 10);
assert.equal(checklistWithSiblingIcons.items.find(item => item.id === 'listed_5y')?.passed, true);
assert.equal(checklistWithSiblingIcons.items.find(item => item.id === 'never_loss_fiscal')?.passed, false);
assert.equal(checklistWithSiblingIcons.items.find(item => item.id === 'dividends_5y_above_5')?.passed, true);
assert.equal(checklistWithSiblingIcons.passed, 9);
assert.equal(checklistWithSiblingIcons.failed, 1);

console.log('stock-modal-i10-integrity-v245 ok');
