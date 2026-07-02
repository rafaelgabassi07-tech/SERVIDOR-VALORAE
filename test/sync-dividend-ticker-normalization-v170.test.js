import assert from 'node:assert/strict';
import { _test } from '../routes/sync.js';

assert.equal(_test.normalizeSingleTransactionSymbol('BVMF:KLBN4F'), 'KLBN4');
assert.equal(_test.normalizeSingleTransactionSymbol('B3:PETR4.SA'), 'PETR4');

const row = _test.dividendRow('valorae-test-user-000000000000', {
  ticker: 'BVMF:KLBN4F',
  dateCom: '2026-07-02',
  paymentDate: '2026-07-20',
  valuePerShare: 0.25,
  status: 'oficial',
  source: 'StatusInvest'
});

assert.equal(row.ticker, 'KLBN4');
assert.equal(row.payload.ticker, 'KLBN4');
assert.equal(row.payload.symbol, 'KLBN4');
assert.ok(row.event_key, 'evento de dividendo precisa manter chave estável');

const sameRow = _test.dividendRow('valorae-test-user-000000000000', {
  symbol: 'KLBN4.SA',
  date_com: '2026-07-02',
  payment_date: '2026-07-20',
  value_per_share: 0.25,
  status: 'oficial',
  source: 'StatusInvest'
});
assert.equal(sameRow.event_key, row.event_key, 'variação de ticker não pode criar evento de dividendo duplicado');

console.log('Sync dividend ticker normalization v170 test OK.');
