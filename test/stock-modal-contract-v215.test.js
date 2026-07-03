import assert from 'node:assert/strict';
import { _test } from '../lib/analysis/stock-modal-contract.js';

assert.equal(_test.STOCK_MODAL_VERSION, '26.asset-modal.stock.v2');

const html = `
<html><body>
  <h1>PETR4 Petrobras</h1>
  <section>
    <div>Cotação R$ 37,92 - 0,26%</div>
    <div>VARIAÇÃO (12M) 27,09%</div>
    <div>P/L 4,54</div>
    <div>P/VP 1,10</div>
    <div>DY 7,76%</div>
  </section>
</body></html>`;

const quick = _test.extractInvestidor10StockQuickMetrics(html, 'PETR4');
assert.equal(quick.priceDisplay, 'R$ 37,92');
assert.equal(quick.price, 37.92);
assert.equal(quick.variation12mDisplay, '27,09%');
assert.equal(quick.variation12mPercent, 27.09);
assert.equal(quick.pl, 4.54);
assert.equal(quick.pvp, 1.10);
assert.equal(quick.dy, 7.76);


const fundamentalsHtml = `
<html><body>
  <h2>INDICADORES FUNDAMENTALISTAS PETR4</h2>
  <div>CONFIRA OS FUNDAMENTOS DAS AÇÕES PETR4</div>
  <div>Sem comparativos</div>
  <div>P/L 4,54</div><div>P/receita (PSR) 0,98</div><div>P/VP 1,0</div><div>Dividend Yield 7,76%</div>
  <div>Payout 38,6%</div><div>Margem Líquida 21,60%</div><div>Margem Bruta 47,36%</div><div>Margem Ebit 28,88%</div>
  <div>Margem Ebitda 46,35%</div><div>EV/Ebitda 3,65</div><div>EV/ebit 5,6</div><div>P/Ebitda 2,12</div>
  <div>P/Ebit 3,40</div><div>P/Ativo 0,39</div><div>P/Cap.Giro -10,05</div><div>P/Ativo Circ. Liq. -0,44</div>
  <div>VPA 34,4</div><div>LPA 8,35</div><div>Giro Ativos 0,40</div><div>ROE 24,17%</div>
  <div>ROIC 12,5%</div><div>ROA 8,67%</div><div>Dívida Líquida / Patrimônio 0,73</div><div>Dívida Líquida / Ebitda 1,40</div>
  <div>Dívida Líquida / Ebit 2,25</div><div>Dívida Bruta / Patrimônio 0,83</div><div>Patrimônio / Ativos 0,36</div><div>Passivos / Ativos 0,64</div>
  <div>Liquidez Corrente 0,74</div><div>CAGR Receitas 5 anos 12,83%</div><div>CAGR Lucros 5 anos 77,66%</div>
</body></html>`;
const fundamentals = _test.extractInvestidor10StockFundamentalIndicators(fundamentalsHtml, 'PETR4');
assert.equal(fundamentals.status, 'OK');
assert.equal(fundamentals.items.length, 31);
assert.equal(fundamentals.comparator.selected, 'Sem comparativos');
assert.equal(fundamentals.groups.length, 5);
assert.equal(fundamentals.items.find(item => item.id === 'psr').value, '0,98');
assert.equal(fundamentals.items.find(item => item.id === 'margem_ebit').value, '28,88%');
assert.equal(fundamentals.items.find(item => item.id === 'margem_ebitda').value, '46,35%');
assert.equal(fundamentals.items.find(item => item.id === 'divida_liquida_patrimonio').value, '0,73');
assert.equal(fundamentals.items.find(item => item.id === 'cagr_lucros_5_anos').numericValue, 77.66);

const rows = _test.returnsRowsFromInvestidor10Profitability({
  profitability: {
    periods: ['1 mês', '3 meses', '1 ano', '2 anos', '5 anos', '10 anos'],
    nominal: [
      { period: '1 mês', valuePercent: -8.58, raw: '-8,58%' },
      { period: '3 meses', valuePercent: -19.26, raw: '-19,26%' },
      { period: '1 ano', valuePercent: 27.09, raw: '27,09%' }
    ],
    real: [
      { period: '1 mês', valuePercent: -8.58, raw: '-8,58%' },
      { period: '3 meses', valuePercent: -19.73, raw: '-19,73%' },
      { period: '1 ano', valuePercent: 21.96, raw: '21,96%' }
    ]
  }
});
assert.equal(rows.length, 3);
assert.equal(rows[0].key, '1_mes');
assert.equal(rows[2].label, '1 ano');
assert.equal(rows[2].returnDisplay, '27,09%');
assert.equal(rows[2].realReturnDisplay, '21,96%');

const summary = _test.chartSummary([
  { close: 10 },
  { close: 12 },
  { close: 11 }
]);
assert.equal(summary.points, 3);
assert.equal(summary.variationPercent, 10);


const notStock = await import('../lib/analysis/stock-modal-contract.js').then(mod => mod.buildStockModalContract({ ticker: 'BOVA11', timeoutMs: 3500 }));
assert.equal(notStock.status, 'NOT_STOCK');
assert.equal(notStock.assetType, 'ETF');

console.log('stock-modal-contract-v215 ok');
