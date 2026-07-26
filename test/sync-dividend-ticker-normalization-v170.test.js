import assert from 'node:assert/strict';
import { _test } from '../routes/sync.js';

assert.equal(_test.normalizeSingleTransactionSymbol('BVMF:KLBN4F'),'KLBN4');
assert.equal(_test.normalizeSingleTransactionSymbol('B3:PETR4.SA'),'PETR4');
const row=_test.normalizeDividend({ticker:'BVMF:KLBN4F',dateCom:'2026-07-02',paymentDate:'2026-07-20',valuePerShare:0.25,status:'oficial',source:'StatusInvest'});
assert.equal(row.ticker,'KLBN4');
assert.ok(row.eventId);
const same=_test.normalizeDividend({symbol:'KLBN4.SA',date_com:'2026-07-02',payment_date:'2026-07-20',value_per_share:0.25,status:'oficial',source:'StatusInvest'});
assert.equal(same.ticker,'KLBN4');
assert.equal(same.eventId,row.eventId,'normalização equivalente deve manter a chave estável');
console.log('Sync dividend ticker normalization minimal v2 OK');
