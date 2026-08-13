import assert from 'node:assert/strict';
import { _test as snapshotTest } from '../lib/market/fundamentus-snapshot.js';

const fiiHtml = `
<table>
  <tr><th>Papel</th><th>Segmento</th><th>Cotação</th><th>FFO Yield</th><th>Dividend Yield</th><th>P/VP</th><th>Valor de Mercado</th><th>Liquidez</th></tr>
  <tr><td><a>HGLG11</a></td><td>Logística</td><td>160,00</td><td>8,00%</td><td>9,25%</td><td>1,02</td><td>5.500.000.000,00</td><td>8.500.000,00</td></tr>
</table>`;

// Deliberately use an unknown label at the historical stock liquidity position.
// This exercises the defensive legacy index and prevents accidentally reading debt/equity at index 19.
const stockHtml = `
<table>
  <tr><th>Papel</th><th>Cotação</th><th>P/L</th><th>P/VP</th><th>PSR</th><th>Div.Yield</th><th>P/Ativo</th><th>P/Cap.Giro</th><th>P/EBIT</th><th>P/Ativ Circ.Liq</th><th>EV/EBIT</th><th>EV/EBITDA</th><th>Marg. EBIT</th><th>Marg. Líquida</th><th>Liq. Corr.</th><th>ROIC</th><th>ROE</th><th>Turnover BRL</th><th>Patrim. Líq</th><th>Dív.Brut/ Patrim.</th></tr>
  <tr><td><a>BBAS3</a></td><td>36,54</td><td>7,20</td><td>0,92</td><td>1,00</td><td>7,82%</td><td>0,50</td><td>1,00</td><td>5,00</td><td>-</td><td>6,00</td><td>5,00</td><td>20%</td><td>15%</td><td>1,5</td><td>18%</td><td>16%</td><td>1.240.000.000,00</td><td>134.130.434.782,61</td><td>0,10</td></tr>
</table>`;

const fii = snapshotTest.parseTable(fiiHtml, 'fiis')[0];
assert.equal(fii.dailyLiquidity, 8_500_000, 'bare Liquidez header must be recognized for FIIs');
assert.equal(fii.dailyLiquidityDisplay, 'R$ 8.500.000,00');

const stock = snapshotTest.parseTable(stockHtml, 'stocks')[0];
assert.equal(stock.dailyLiquidity, 1_240_000_000, 'stock legacy liquidity fallback must use historical index 17');
assert.notEqual(stock.dailyLiquidity, 0.10, 'debt/equity column must never be interpreted as liquidity');

console.log('analysis discovery liquidity contract v421: ok');
