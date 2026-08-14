import assert from 'node:assert/strict';
import { parseCurrentInvestidor10PeerTable } from '../lib/analysis/stock-peer-table.js';

const sample = `
COMPARADOR DE AÇÕES
Ativos Cotação Variação 12m DY P/L P/VP ROE Margem Líquida
PETR4 Petrobras PN R$ 31,42 -10,20% 13,80% 5,21 1,12 22,42% 17,35%
PRIO3 Prio ON R$ 41,80 5,10% 0,00% 8,91 2,35 28,40% 25,10%
RECV3 PetroReconcavo ON R$ 15,76 -2,44% 9,70% 6,18 1,01 16,05% 21,60%
`;

const rows = parseCurrentInvestidor10PeerTable(sample);
assert.equal(rows.length, 3);
assert.deepEqual(rows[0], {
  ticker: 'PETR4',
  quoteDisplay: 'R$ 31,42',
  variation12mDisplay: '-10,20%',
  dividendYieldDisplay: '13,80%',
  plDisplay: '5,21',
  pvpDisplay: '1,12',
  roeDisplay: '22,42%',
  marginLiquidDisplay: '17,35%'
});
assert.equal(rows[1].ticker, 'PRIO3');
assert.equal(rows[2].pvpDisplay, '1,01');
assert.equal(parseCurrentInvestidor10PeerTable('sem tabela').length, 0);

console.log('stock-peer-current-table-v422 ok');
