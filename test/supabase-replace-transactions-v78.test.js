import assert from 'node:assert/strict';
import { invokeSync, jsonResponse, withMinimalSupabase } from './helpers/minimal-sync-harness.js';
let rpc;
await withMinimalSupabase(async (url,init={})=>{
  const href=String(url);
  if(href.includes('/auth/v1/user')) return jsonResponse({id:'99999999-9999-4999-8999-999999999999'});
  if(href.includes('/rpc/valorae_financial_upload_transactions_v2')) {rpc=JSON.parse(init.body); return jsonResponse({ok:true,contract:'valorae-financial-sync-v2',count:2,deleted:1,transactions_version:8});}
  throw new Error(`unexpected ${href}`);
},async()=>{
  const {res,payload}=await invokeSync('replace_transactions_for_symbols',{token:'replace-v2',body:{symbols:['petr4','BVMF:VALE3.SA'],transactions:[{id:'1',date:'2026-01-01',operation:'COMPRA',ticker:'PETR4',assetType:'Ação',quantity:1,price:30,grossValue:30},{id:'2',date:'2026-01-02',operation:'COMPRA',ticker:'VALE3',assetType:'Ação',quantity:1,price:50,grossValue:50}]}});
  assert.equal(res.statusCode,200,JSON.stringify(payload));
  assert.equal(payload.deleted,1);
});
assert.deepEqual(rpc.p_replace_symbols,['PETR4','VALE3']);
assert.equal(rpc.p_rows.length,2);
console.log('Supabase differential replace v2 OK');
