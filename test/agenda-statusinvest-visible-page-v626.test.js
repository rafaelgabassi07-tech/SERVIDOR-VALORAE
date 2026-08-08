import assert from 'node:assert/strict';
import { _test } from '../lib/sources/status-dividends.js';
import { prioritizeDividendTickers } from '../lib/portfolio/dividends-contract.js';

assert.equal(_test.statusInvestPublicPagePaths('PETR4')[0], 'acoes');
assert.equal(_test.statusInvestPublicPagePaths('RECR11')[0], 'fundos-imobiliarios');

const stockHtml = `
<section><h2>DIVIDENDOS DO PETR4</h2><table><tbody>
<tr><td>JCP</td><td>01/06/2026</td><td>20/08/2026</td><td>0,35048636</td></tr>
<tr><td>JCP</td><td>15/06/2026</td><td>20/08/2026</td><td>0,12000000</td></tr>
<tr><td>Rend. Tributado</td><td>22/04/2026</td><td>20/05/2026</td><td>0,01649003</td></tr>
<tr><td>Dividendo</td><td>22/12/2025</td><td>20/03/2026</td><td>0,29642144</td></tr>
</tbody></table><h2>COMUNICADOS DO PETR4</h2></section>`;
const stockEvents = _test.parseStatusInvestVisibleTableEvents('PETR4', stockHtml);
assert.equal(stockEvents.length, 4);
assert.equal(stockEvents.filter(e => e.dividendType === 'JCP' && e.paymentDate === '2026-08-20').length, 2, 'duas parcelas futuras anunciadas para a mesma data de pagamento devem ser preservadas');
const futureJcp = stockEvents.find(e => e.dividendType === 'JCP' && e.paymentDate === '2026-08-20');
assert.ok(futureJcp, 'JCP futuro da tabela visível precisa sobreviver ao parser');
assert.equal(futureJcp.dateCom, '2026-06-01');
assert.equal(futureJcp.grossValuePerShare, 0.35048636);
assert.ok(futureJcp.netValuePerShare > 0 && futureJcp.netValuePerShare < futureJcp.grossValuePerShare);
assert.ok(stockEvents.some(e => e.dividendType === 'RENDIMENTO_TRIBUTADO'));

const fiiHtml = `<h2>DIVIDENDOS DO RECR11</h2><table><tr><th>Tipo</th><th>DATA COM</th><th>Pagamento</th><th>Valor</th></tr><tr><td>Rendimento</td><td>07/07/2026</td><td>14/07/2026</td><td>1,07590000</td></tr></table>`;
const fiiEvents = _test.parseStatusInvestVisibleTableEvents('RECR11', fiiHtml);
assert.equal(fiiEvents.length, 1);
assert.equal(fiiEvents[0].dividendType, 'RENDIMENTO');
assert.equal(fiiEvents[0].paymentDate, '2026-07-14');
assert.equal(fiiEvents[0].grossValuePerShare, 1.0759);

const responsiveHtml = `<div>DIVIDENDOS DO PETR4 JCP 01/06/2026 20/08/2026 R$ 0,35048636 COMUNICADOS DO PETR4</div>`;
const responsiveEvents = _test.parseStatusInvestVisibleTableEvents('PETR4', responsiveHtml);
assert.equal(responsiveEvents.length, 1);
assert.equal(responsiveEvents[0].paymentDate, '2026-08-20');

const legacyHtml = `<script>window.x={"assetEarningsModels":[{"etd":"JCP","ed":"01/06/2026","pd":"20/08/2026","v":0.35048636}]};</script>`;
const legacyEvents = _test.parseStatusInvestHtmlEvents('PETR4', legacyHtml);
assert.equal(legacyEvents.length, 1);
assert.equal(legacyEvents[0].paymentDate, '2026-08-20');

const prioritized = prioritizeDividendTickers({
  positions: [
    { ticker: 'VALE3', quantity: 10 },
    { ticker: 'PETR4', quantity: 20 },
    { ticker: 'ITUB4', quantity: 0 }
  ]
}, ['ABEV3', 'PETR4', 'VALE3', 'ITUB4']);
assert.deepEqual(prioritized.slice(0, 2), ['VALE3', 'PETR4']);
assert.deepEqual(prioritized, ['VALE3', 'PETR4', 'ABEV3', 'ITUB4']);

console.log('agenda-statusinvest-visible-page-v626: OK');
