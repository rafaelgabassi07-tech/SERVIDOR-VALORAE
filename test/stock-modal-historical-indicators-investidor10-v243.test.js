import assert from 'node:assert/strict';
import { _test } from '../lib/analysis/stock-modal-contract.js';

const investidor10TableApi = {
  '5_anos': {
    columns: ['Indicador', 'Atual', '2025', '2024', '2023', '2022', '2021'],
    data: [
      ['P/L', '4,54', '3,61', '12,74', '3,85', '1,68', '3,44'],
      ['P/Receita (PSR)', '0,98', '0,80', '0,95', '0,94', '0,49', '0,81'],
      ['P/VP', '1,10', '0,96', '1,27', '1,26', '0,87', '0,95'],
      ['Dividend Yield', '7,78%', '10,49%', '21,49%', '19,33%', '67,99%', '19,85%'],
      ['Payout', '38,46%', '43,02%', '278,99%', '79,30%', '103,29%', '68,31%'],
      ['Margem Líquida', '21,60%', '22,13%', '7,46%', '24,34%', '29,37%', '23,56%'],
      ['Margem Bruta', '47,36%', '47,63%', '50,21%', '52,72%', '52,10%', '48,52%'],
      ['Margem Ebit', '28,88%', '29,27%', '27,95%', '36,98%', '45,89%', '46,58%'],
      ['Margem Ebtda', '46,35%', '46,23%', '35,37%', '49,91%', '56,52%', '60,50%'],
      ['EV/Ebitda', '3,65', '3,23', '4,71', '2,82', '1,56', '2,37'],
      ['EV/Ebit', '5,86', '5,11', '5,96', '3,81', '1,93', '3,08'],
      ['P/Ebitda', '2,12', '1,73', '2,69', '1,88', '0,87', '1,34'],
      ['P/Ebit', '3,40', '2,73', '3,40', '2,53', '1,07', '1,74'],
      ['P/Ativo', '0,39', '0,32', '0,41', '0,46', '0,32', '0,38'],
      ['P/Cap.Giro', '-10,05', '-6,81', '-7,83', '-70,08', '-465,06', '11,00'],
      ['P/Ativo Circ. Liq.', '-0,44', '-0,37', '-0,47', '-0,54', '-0,39', '-0,46'],
      ['VPA', '34,54', '32,26', '28,40', '29,52', '28,27', '30,05'],
      ['LPA', '8,35', '8,54', '2,84', '9,67', '14,61', '8,28'],
      ['Giro Ativos', '0,40', '0,41', '0,44', '0,49', '0,66', '0,47'],
      ['ROE', '24,17%', '26,49%', '10,00%', '32,75%', '51,68%', '27,54%'],
      ['ROIC', '12,95%', '13,21%', '16,16%', '20,05%', '32,28%', '23,28%'],
      ['ROA', '8,67%', '9,04%', '3,29%', '11,91%', '19,35%', '11,02%'],
      ['Dívida Líquida / Ebitda', '1,40', '1,45', '1,88', '0,89', '0,62', '0,97'],
      ['Dívida Líquida / Ebit', '2,25', '2,29', '2,38', '1,20', '0,76', '1,26'],
      ['Dívida Bruta / Patrimônio', '0,83', '0,92', '1,02', '0,80', '0,77', '0,85'],
      ['Patrimônio / Ativos', '0,36', '0,34', '0,33', '0,36', '0,37', '0,40'],
      ['Passivos / Ativos', '0,64', '1,71', '0,67', '0,64', '0,63', '0,60'],
      ['Liquidez Corrente', '0,74', '0,71', '0,69', '0,96', '1,00', '1,25'],
      ['CAGR Receitas 5 anos', '12,83%', '12,83%', '10,18%', '7,91%', '17,72%', '9,88%'],
      ['CAGR Lucros 5 anos', '77,66%', '77,66%', '-2,01%', '36,21%', '246,76%', '0,00%']
    ]
  },
  '10_anos': {
    columns: ['Indicador', 'Atual', '2025', '2024', '2023', '2022', '2021', '2020', '2019'],
    rows: [
      ['P/L', '4,54', '3,61', '12,74', '3,85', '1,68', '3,44', '22,08', '16,62'],
      ['ROE', '24,17%', '26,49%', '10,00%', '32,75%', '51,68%', '27,54%', '1,50%', '6,70%']
    ]
  }
};

const history = _test.buildStockHistoricalIndicators(investidor10TableApi, 'PETR4');
assert.equal(history.status, 'OK');
assert.deepEqual(history.periods, ['5y', '10y']);
assert.equal(history.selectedPeriod, '5y');
assert.deepEqual(history.columns, ['Atual', '2025', '2024', '2023', '2022', '2021']);
assert.equal(history.rows.length, 30);
assert.equal(history.rows.find(row => row.label === 'P/L')?.values.Atual, '4,54');
assert.equal(history.rows.find(row => row.label === 'ROE')?.values['2024'], '10,00%');
assert.equal(history.rows.find(row => row.label === 'Margem Ebitda')?.values['2022'], '56,52%');
assert.equal(history.tablesByPeriod['10y'].rows.find(row => row.label === 'P/L')?.values['2019'], '16,62');

const chartApiShape = {
  categories: ['Atual', '2025', '2024'],
  series: [
    { name: 'ROE', unit: 'percent', data: [24.17, 26.49, 10] },
    { name: 'P/L', data: [4.54, 3.61, 12.74] }
  ]
};
const chartHistory = _test.normalizeStockHistoricalIndicatorsDataset(chartApiShape);
assert.equal(chartHistory.status, 'OK');
assert.equal(chartHistory.rows.find(row => row.label === 'ROE')?.values.Atual, '24,17%');
assert.equal(chartHistory.rows.find(row => row.label === 'P/L')?.values['2024'], '12,74');

const objectPointShape = {
  data: {
    roe: [
      { ano: 'Atual', valor: '24,17%' },
      { ano: 2025, valor: '26,49%' }
    ],
    p_l: [
      { year: 'Atual', value: '4,54' },
      { year: 2025, value: '3,61' }
    ]
  }
};
const pointHistory = _test.normalizeStockHistoricalIndicatorsDataset(objectPointShape);
assert.equal(pointHistory.rows.find(row => row.label === 'ROE')?.values['2025'], '26,49%');
assert.equal(pointHistory.rows.find(row => row.label === 'P/L')?.values.Atual, '4,54');

const htmlHistory = _test.extractInvestidor10StockHistoricalIndicatorsFromHtml(`
  <section><h2>HISTÓRICO DE INDICADORES FUNDAMENTALISTAS PETR4</h2>
  <div>ARRASTE O QUADRO PARA VER MAIS DADOS Atual 2025 2024 2023 2022 2021</div>
  <div>P/L 4,54 3,61 12,74 3,85 1,68 3,44</div>
  <div>Dividend Yield 7,78% 10,49% 21,49% 19,33% 67,99% 19,85%</div>
  <div>ROE 24,17% 26,49% 10,00% 32,75% 51,68% 27,54%</div>
  </section><section>CHECKLIST DO INVESTIDOR</section>
`, 'PETR4');
assert.equal(htmlHistory.status, 'OK');
assert.equal(htmlHistory.rows.find(row => row.label === 'Dividend Yield')?.values['2023'], '19,33%');

console.log('stock-modal-historical-indicators-investidor10-v243 ok');
