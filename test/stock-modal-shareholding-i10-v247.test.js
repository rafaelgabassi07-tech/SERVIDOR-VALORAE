import assert from 'node:assert/strict';
import { _test } from '../lib/analysis/stock-modal-contract.js';

const snippetRows = _test.parseStockShareholdingRowsFromSection(`
  POSIÇÃO ACIONÁRIA DA PETR4 Acionista % ON % PN % Total
  OUTROS 40.77 67.21 52.03
  UNIÃO FEDERAL 50.26 0.00 29.02
  BNDES PARTICIPAÇÕES - BNDESPAR 0.00 7.94 3.40
`);
assert.equal(snippetRows.length, 3);
assert.equal(snippetRows[0].shareholder, 'OUTROS');
assert.equal(snippetRows[0].onPercentDisplay, '40,77%');
assert.equal(snippetRows[1].totalPercentDisplay, '29,02%');

const tableCandidate = {
  columns: ['Acionista', '% ON', '% PN', '% Total'],
  rows: [
    ['OUTROS', '40.77', '67.21', '52.03'],
    ['UNIÃO FEDERAL', '50.26', '0.00', '29.02']
  ]
};
const tableRows = _test.rowsFromShareholdingCandidate(tableCandidate);
assert.equal(tableRows.length, 2);
assert.equal(tableRows[0].pnPercentDisplay, '67,21%');

const objectCandidate = {
  acionistas: [
    { nomeAcionista: 'OUTROS', participacao_on: '40,77%', participacao_pn: '67,21%', participacao_total: '52,03%' },
    { nomeAcionista: 'UNIÃO FEDERAL', ordinarias: 50.26, preferenciais: 0, participacaoTotal: 29.02 }
  ]
};
const objectRows = _test.rowsFromShareholdingCandidate(objectCandidate);
assert.equal(objectRows.length, 2);
assert.equal(objectRows[1].shareholder, 'UNIÃO FEDERAL');
assert.equal(objectRows[1].onPercentDisplay, '50,26%');

const htmlPayload = `
<script>
  window.__I10__ = { posicaoAcionaria: [
    ['Acionista','% ON','% PN','% Total'],
    ['OUTROS','40.77','67.21','52.03'],
    ['UNIÃO FEDERAL','50.26','0.00','29.02']
  ] };
</script>`;
const payload = _test.buildStockShareholdingPayload({ html: htmlPayload, ticker: 'PETR4' });
assert.equal(payload.status, 'OK');
assert.equal(payload.rows.length, 2);
assert.equal(payload.rows[0].totalPercentDisplay, '52,03%');

const removedHistorical = _test.buildStockHistoricalIndicators({}, 'PETR4');
assert.equal(removedHistorical.rows.length, 0);

console.log('stock-modal-shareholding-i10-v247 ok');
