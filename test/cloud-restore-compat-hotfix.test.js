import assert from 'node:assert/strict';
import { _test } from '../routes/sync.js';

const legacy=_test.storedTransactionToClient({ticker:'BVMF:PETR4.SA',transaction_date:'2026-01-02',operation:'compra',quantity:'2',purchase_price:'30',gross_value:'60',source:'LEGACY'});
assert.equal(legacy.symbol,'PETR4');
assert.equal(legacy.date,'2026-01-02');
assert.equal(legacy.quantity,2);
assert.equal(legacy.price,30);
assert.match(legacy.clientTxId,/^valorae-[a-f0-9]+$/);
const again=_test.storedTransactionToClient({ticker:'BVMF:PETR4.SA',transaction_date:'2026-01-02',operation:'compra',quantity:'2',purchase_price:'30',gross_value:'60',source:'LEGACY'});
assert.equal(again.clientTxId,legacy.clientTxId);
console.log('legacy transaction normalization compatibility OK');
