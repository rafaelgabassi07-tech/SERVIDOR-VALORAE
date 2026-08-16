import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseYahooAnalysisFundamentals } from '../lib/sources/quotes.js';
import { _test as snapshotTest } from '../lib/market/fundamentus-snapshot.js';

const yahoo = parseYahooAnalysisFundamentals('PETR4', {
  quoteSummary: {
    result: [{
      price: {
        regularMarketPrice: { raw: 31.5 },
        marketCap: { raw: 420_000_000_000 },
      },
      summaryDetail: {
        dividendYield: { raw: 0.1325 },
        averageVolume: { raw: 25_000_000 },
      },
      defaultKeyStatistics: {
        priceToBook: { raw: 1.18 },
      },
    }],
  },
});
assert.ok(yahoo, 'Yahoo fallback must parse a usable row');
assert.equal(yahoo.marketCap, 420_000_000_000);
assert.equal(yahoo.marketValue, 420_000_000_000);
assert.equal(yahoo.valorMercado, 420_000_000_000);
assert.equal(yahoo.pvp, 1.18);
assert.equal(yahoo.dividendYield, 13.25);
assert.equal(yahoo.dailyLiquidity, 787_500_000);
assert.match(yahoo.marketCapDisplay, /R\$/);

const stockHtml = `
<table>
<tr><th>Papel</th><th>Cotação</th><th>P/L</th><th>P/VP</th><th>PSR</th><th>Div.Yield</th><th>P/Ativo</th><th>P/Cap.Giro</th><th>P/EBIT</th><th>P/Ativ Circ.Liq</th><th>EV/EBIT</th><th>EV/EBITDA</th><th>Mrg Bruta</th><th>Mrg Ebit</th><th>Mrg. Líq.</th><th>Liq. Corr.</th><th>ROIC</th><th>ROE</th><th>Liq.2meses</th><th>Patrim. Líq</th><th>Dív.Líq/ Patrim.</th><th>Cresc. Rec.5a</th></tr>
<tr><td>PETR4</td><td>31,50</td><td>5,10</td><td>1,18</td><td>1,0</td><td>13,25%</td><td>0,5</td><td>1,0</td><td>4,0</td><td>-</td><td>4,2</td><td>3,8</td><td>40%</td><td>35%</td><td>18%</td><td>1,1</td><td>20%</td><td>22%</td><td>787.500.000</td><td>355.932.203.389,83</td><td>0,8</td><td>5%</td></tr>
</table>`;
const stock = snapshotTest.parseTable(stockHtml, 'stocks')[0];
assert.equal(stock.dailyLiquidity, 787_500_000);
assert.ok(Math.abs(stock.marketCap - 420_000_000_000) < 10);

const fiiHtml = `
<table>
<tr><th>Papel</th><th>Segmento</th><th>Cotação</th><th>FFO Yield</th><th>Dividend Yield</th><th>P/VP</th><th>Valor de Mercado</th><th>Liquidez</th></tr>
<tr><td>BLCP11</td><td>Logística</td><td>91,00</td><td>5,41%</td><td>0,00%</td><td>0,81</td><td>208.962.000</td><td>17.566</td></tr>
</table>`;
const fii = snapshotTest.parseTable(fiiHtml, 'fiis')[0];
assert.equal(fii.marketCap, 208_962_000, 'pt-BR integer market cap must not be parsed as NaN');
assert.equal(fii.dailyLiquidity, 17_566, 'pt-BR thousand-separated liquidity must remain numeric');

const source = fs.readFileSync(new URL('../lib/sources/quotes.js', import.meta.url), 'utf8');
assert.match(source, /analysis_discovery_full/);
assert.match(source, /backfillAnalysisFundamentals/);
assert.match(source, /Yahoo Finance quoteSummary fallback/);
assert.match(source, /fallbackFilled/);

console.log('analysis discovery completeness v424: ok');
