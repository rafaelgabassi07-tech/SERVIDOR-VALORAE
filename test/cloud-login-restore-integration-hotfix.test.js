import assert from 'node:assert/strict';
import { invokeSync, jsonResponse, withMinimalSupabase } from './helpers/minimal-sync-harness.js';

await withMinimalSupabase(async url => {
  const href=String(url);
  if (href.includes('/auth/v1/user')) return jsonResponse({id:'33333333-3333-4333-8333-333333333333'});
  if (href.includes('/rpc/valorae_financial_download_v2')) return jsonResponse({
    ok:true,contract:'valorae-financial-sync-v2',
    transactions:[
      {clientTxId:'a',date:'2026-01-01',operation:'COMPRA',symbol:'VALE3',assetType:'Ação',quantity:2,price:50,grossValue:100,source:'B3'},
      {clientTxId:'b',date:'2026-02-01',operation:'VENDA',symbol:'VALE3',assetType:'Ação',quantity:1,price:60,grossValue:60,source:'B3'}
    ],
    dividends:[{eventId:'d1',ticker:'VALE3',paymentDate:'2026-03-01',valuePerShare:1,quantity:1,estimatedAmount:1,status:'pago',source:'B3'}],
    transactions_count:2,dividends_count:1,transactions_version:7,dividends_version:3
  });
  throw new Error(`unexpected ${href}`);
}, async () => {
  const {res,payload}=await invokeSync('restore_transactions',{token:'login-restore-minimal'});
  assert.equal(res.statusCode,200,JSON.stringify(payload));
  assert.equal(payload.transactions.length,2);
  assert.equal(payload.dividends.length,1);
  assert.equal(payload.syncState.revision,7);
});
console.log('cloud login minimal restore integration OK');
