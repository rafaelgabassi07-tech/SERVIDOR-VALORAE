import assert from 'node:assert/strict';
import { _test } from '../lib/analysis/stock-modal-contract.js';

const dataTablesShareholding = {
  columns: [
    { data: '0', title: 'Acionista' },
    { data: '1', title: '% ON' },
    { data: '2', title: '% PN' },
    { data: '3', title: '% Total' }
  ],
  data: [
    { '0': 'OUTROS', '1': '40,77%', '2': '67,21%', '3': '52,03%' },
    { '0': 'UNIÃO FEDERAL', '1': '50,26%', '2': '0,00%', '3': '29,02%' },
    { '0': 'BLACKROCK INC.', '1': '0,00%', '2': '12,49%', '3': '5,32%' }
  ]
};

const parsed = _test.buildStockShareholdingPayload({
  canonical: { rawJson: { assetTickerRest: { posicaoAcionaria: dataTablesShareholding } } },
  ticker: 'PETR4'
});

assert.equal(parsed.status, 'OK');
assert.equal(parsed.rows.length, 3);
assert.deepEqual(parsed.rows.map(row => row.shareholder), ['OUTROS', 'UNIÃO FEDERAL', 'BLACKROCK INC.']);
assert.equal(parsed.rows[0].onPercentDisplay, '40,77%');
assert.equal(parsed.rows[1].pnPercentDisplay, '0,00%');
assert.equal(parsed.rows[2].totalPercentDisplay, '5,32%');
assert.ok(parsed.rows.every(row => !/(P\/VP|DY|ROE|Dividend Yield|vou vender|iniciante)/i.test(row.shareholder)));

console.log('stock-modal-shareholding-indexed-rows-v275 ok');
