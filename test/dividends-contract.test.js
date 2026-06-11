import assert from 'node:assert/strict';
import { parseAgendaHtml } from '../lib/sources/agenda-dividends.js';
import { buildDividendsContract } from '../lib/portfolio/dividends-contract.js';

const compact = 'FISC11 R$ 0,62 20/07/2026 FATN11 R$ 0,80 21/07/2026';
const fisc = parseAgendaHtml(compact, ['FISC11']);
assert.equal(fisc.length, 1);
assert.equal(fisc[0].ticker, 'FISC11');
assert.equal(fisc[0].valuePerShare, 0.62);
assert.equal(fisc[0].paymentDate, '2026-07-20');
const fatn = parseAgendaHtml(compact, ['FATN11']);
assert.equal(fatn.length, 1);
assert.equal(fatn[0].ticker, 'FATN11');
assert.equal(fatn[0].valuePerShare, 0.8);
assert.equal(fatn[0].paymentDate, '2026-07-21');
assert.deepEqual(parseAgendaHtml(compact, []), []);

const empty = await buildDividendsContract({ positions: [], tickers: [], includeDividends: true });
assert.equal(empty.status, 'EMPTY');
assert.equal(empty.officialEvents.length, 0);
assert.equal(empty.diagnostics[0].reason, 'emptyTickers');


const variants = parseAgendaHtml('PETR4 JSCP R$ 1,000000 Data COM 05/01/2026 Data de Pagamento 20/01/2026 BBAS3 DIV R$ 0,50 Data COM 01/02/2026 Data de Pagamento 15/02/2026 MXRF11 Rendimentos R$ 0,10 Data COM 30/01/2026 Data de Pagamento 14/02/2026', ['PETR4','BBAS3','MXRF11']);
const petr = variants.find(e => e.ticker === 'PETR4');
assert.equal(petr.dividendType, 'JCP');
assert.equal(petr.grossValuePerShare, 1);
assert.equal(petr.valuePerShare, 0.825);
assert.equal(petr.taxRate, 0.175);
assert.equal(petr.taxable, true);
const bbas = variants.find(e => e.ticker === 'BBAS3');
assert.equal(bbas.dividendType, 'DIVIDENDO');
assert.equal(bbas.valuePerShare, 0.5);
assert.equal(bbas.taxRate, 0);
const mxrf = variants.find(e => e.ticker === 'MXRF11');
assert.equal(mxrf.dividendType, 'RENDIMENTO');
assert.equal(mxrf.valuePerShare, 0.1);
assert.equal(mxrf.taxRate, 0);

const tableHtml = `
<table>
  <tr><th>Ativo</th><th>Tipo</th><th>Valor</th><th>Data Com</th><th>Pagamento</th></tr>
  <tr><td>PETR4</td><td>JSCP</td><td>R$ 1,00</td><td>05/01/2026</td><td>20/01/2026</td></tr>
  <tr><td>MXRF11</td><td>Rend. Trib.</td><td>R$ 0,10</td><td>05/01/2026</td><td>20/01/2026</td></tr>
</table>`;
const tableEvents = parseAgendaHtml(tableHtml, ['PETR4', 'MXRF11']);
assert.equal(tableEvents.find(e => e.ticker === 'PETR4')?.dividendType, 'JCP');
assert.equal(tableEvents.find(e => e.ticker === 'PETR4')?.valuePerShare, 0.825);
assert.equal(tableEvents.find(e => e.ticker === 'MXRF11')?.dividendType, 'RENDIMENTO_TRIBUTADO');
assert.equal(tableEvents.find(e => e.ticker === 'MXRF11')?.taxRate, 0);

const jsonHtml = `<script type="application/json">[{"ticker":"BBAS3","tipo":"DIV","valorPorAcao":"0,50","dataCom":"01/02/2026","dataPagamento":"15/02/2026"}]</script>`;
const jsonEvents = parseAgendaHtml(jsonHtml, ['BBAS3']);
assert.equal(jsonEvents.length, 1);
assert.equal(jsonEvents[0].dividendType, 'DIVIDENDO');
assert.equal(jsonEvents[0].paymentDate, '2026-02-15');

const nextFlightHtml = `<script>self.__next_f.push([1,"{\\\"ticker\\\":\\\"BBAS3\\\",\\\"tipo\\\":\\\"JSCP\\\",\\\"valorPorAcao\\\":\\\"1,20\\\",\\\"dataCom\\\":\\\"10/03/2026\\\",\\\"dataPagamento\\\":\\\"25/03/2026\\\"}"])</script>`;
const nextFlightEvents = parseAgendaHtml(nextFlightHtml, ['BBAS3']);
assert.equal(nextFlightEvents.some(e => e.ticker === 'BBAS3' && e.dividendType === 'JCP' && e.paymentDate === '2026-03-25'), true);
