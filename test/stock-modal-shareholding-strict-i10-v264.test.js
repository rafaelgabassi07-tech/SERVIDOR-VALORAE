import assert from 'node:assert/strict';
import { _test } from '../lib/analysis/stock-modal-contract.js';

const noisyRest = {
  ticker: 'PETR4',
  comments: [
    { title: '5/05/2026 Abrir Press-release Data de Divulgação 15...', value: '1,00%' },
    { name: '4 5 6...', value: '27,00%' },
    { label: '555 milhões no TT26 queda da', value: '24,00%' },
    { nome: 'Vou vender', valor: '1,00%' },
    { nome: 'Sou iniciante', valor: '3,00%' },
    { name: 'PONDER 3 RESPOSTAS CARREGAR MAIS COMENTÁR...', value: '1,00%' },
    { label: 'FIIS de Tijolo que se beneficiam com selic baixa. Peç...', value: '7,00%' },
    { name: 'O Banco Safra vê possibilidade de recuperação se a ...', value: '2,00%' },
    { name: 'P/VP', value: '0,00%' },
    { name: 'DY', value: '3,00%' },
    { name: 'ROE', value: '3,00%' }
  ],
  indicators: [
    { label: 'P/VP', value: '0,00%' },
    { label: 'Dividend Yield', value: '7,78%' },
    { label: 'ROE', value: '24,17%' }
  ]
};

const noisyOnly = _test.buildStockShareholdingPayload({ canonical: { rawJson: { assetTickerRest: noisyRest } }, ticker: 'PETR4' });
assert.equal(noisyOnly.status, 'EMPTY');
assert.equal(noisyOnly.rows.length, 0);

const mixedRest = {
  ...noisyRest,
  posicaoAcionaria: {
    columns: ['Acionista', '% ON', '% PN', '% Total'],
    rows: [
      ['OUTROS', '40,77%', '67,21%', '52,03%'],
      ['UNIÃO FEDERAL', '50,26%', '0,00%', '29,02%'],
      ['BNDES PARTICIPAÇÕES - BNDESPAR', '0,00%', '16,53%', '7,04%']
    ]
  }
};
const parsed = _test.buildStockShareholdingPayload({ canonical: { rawJson: { assetTickerRest: mixedRest } }, ticker: 'PETR4' });
assert.equal(parsed.status, 'OK');
assert.deepEqual(parsed.rows.map(row => row.shareholder), ['OUTROS', 'UNIÃO FEDERAL', 'BNDES PARTICIPAÇÕES - BNDESPAR']);
assert.ok(parsed.rows.every(row => !/(P\/VP|DY|ROE|Vou vender|Sou iniciante|Press-release|COMENTÁR)/i.test(row.shareholder)));

console.log('stock-modal-shareholding-strict-i10-v264 ok');
