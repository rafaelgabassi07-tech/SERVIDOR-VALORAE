import assert from 'node:assert/strict';
import { invokeSync, jsonResponse, withMinimalSupabase } from './helpers/minimal-sync-harness.js';

const calls=[];
await withMinimalSupabase(async (url, init={}) => {
  const href=String(url); calls.push({href, body:init.body ? JSON.parse(init.body) : null});
  if (href.includes('/auth/v1/user')) return jsonResponse({id:'11111111-1111-4111-8111-111111111111',email:'restore@test'});
  if (href.includes('/rpc/valorae_financial_download_v2')) return jsonResponse({
    ok:true, contract:'valorae-financial-sync-v2',
    transactions:[{clientTxId:'tx-1',date:'2026-07-01',operation:'COMPRA',symbol:'PETR4',assetType:'Ação',quantity:1,price:30,grossValue:30,source:'B3'}],
    dividends:[], transactions_count:1, dividends_count:0, transactions_version:2, dividends_version:0
  });
  throw new Error(`unexpected ${href}`);
}, async () => {
  const {res,payload}=await invokeSync('download_financial_data',{token:'restore-v2-token'});
  assert.equal(res.statusCode,200,JSON.stringify(payload));
  assert.equal(payload.contract,'valorae-financial-sync-v2');
  assert.equal(payload.transactionsCount,1);
  assert.equal(payload.verifiedEmpty,false);
});
assert.equal(calls.filter(x=>x.href.includes('/rest/v1/rpc/')).length,1);
assert.equal(calls.find(x=>x.href.includes('/rpc/valorae_financial_download_v2')).body.p_user_id,'11111111-1111-4111-8111-111111111111');
console.log('minimal financial restore v363 OK');
