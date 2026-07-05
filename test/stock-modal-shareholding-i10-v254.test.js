import assert from 'node:assert/strict';
import { _test } from '../lib/analysis/stock-modal-contract.js';

const indexedHtml = `
<html><body>
<nav>Aviso aos acionistas e comunicados antes do conteúdo principal.</nav>
<section><h2>POSIÇÃO ACIONÁRIA DA PETR4</h2>
  <div>Acionista % ON % PN % Total OUTROS, 40.77, 67.21, 52.03; UNIÃO FEDERAL, 50.26, 0.00, 29.02; BNDES PARTICIPAÇÕES - BNDESPAR, 0.00, 16.53, 7.04; GQG PARTNERS LLC, 5.03, 6.38, 5.61;</div>
</section>
<h2>Receitas e Lucros</h2>
</body></html>`;

const parsed = _test.buildStockShareholdingPayload({ html: indexedHtml, ticker: 'PETR4' });
assert.equal(parsed.status, 'OK');
assert.equal(parsed.rows.length, 4);
assert.equal(parsed.rows[0].shareholder, 'OUTROS');
assert.equal(parsed.rows[0].onPercentDisplay, '40,77%');
assert.equal(parsed.rows[1].shareholder, 'UNIÃO FEDERAL');
assert.equal(parsed.rows[1].pnPercentDisplay, '0,00%');
assert.equal(parsed.rows[2].totalPercentDisplay, '7,04%');
assert.equal(parsed.rows[3].totalPercent, 5.61);

const hiddenTableHtml = `
<div>acionista genérico antes</div>
<section id="shareholding"><h2>POSIÇÃO ACIONÁRIA DA TEST3</h2>
<table><thead><tr><th>Acionista</th><th>% ON</th><th>% PN</th><th>% Total</th></tr></thead><tbody>
<tr><td>CONTROLADOR TESTE</td><td>55,10%</td><td>0,00%</td><td>33,30%</td></tr>
<tr><td>OUTROS</td><td>44,90%</td><td>100,00%</td><td>66,70%</td></tr>
</tbody></table></section><h2>Receitas e Lucros</h2>`;
const tableParsed = _test.buildStockShareholdingPayload({ html: hiddenTableHtml, ticker: 'TEST3' });
assert.equal(tableParsed.status, 'OK');
assert.equal(tableParsed.rows.length, 2);
assert.equal(tableParsed.rows[0].shareholder, 'CONTROLADOR TESTE');
assert.equal(tableParsed.rows[0].totalPercentDisplay, '33,30%');

const rawParsed = _test.buildStockShareholdingPayload({
  ticker: 'TEST3',
  raw: [{ headers: ['Acionista', '% ON', '% PN', '% Total'], rows: [['OUTROS', '20.00', '30.00', '25.00']] }]
});
assert.equal(rawParsed.status, 'OK');
assert.equal(rawParsed.rows[0].totalPercentDisplay, '25,00%');

const empty = _test.buildStockShareholdingPayload({ ticker: 'TEST3', html: '<h2>POSIÇÃO ACIONÁRIA DA TEST3</h2><img src="x.svg"><h2>Receitas e Lucros</h2>' });
assert.equal(empty.status, 'EMPTY');
assert.equal(empty.rows.length, 0);
