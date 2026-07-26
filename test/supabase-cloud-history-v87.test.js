import assert from 'node:assert/strict';
import { invokeSync, jsonResponse, withMinimalSupabase } from './helpers/minimal-sync-harness.js';

await withMinimalSupabase(async url => {
  const href=String(url);
  if (href.includes('/auth/v1/user')) return jsonResponse({id:'88888888-8888-4888-8888-888888888888'});
  if (href.includes('/rpc/valorae_financial_download_v2')) return jsonResponse({ok:true,contract:'valorae-financial-sync-v2',transactions:[{clientTxId:'x',date:'2026-01-01',operation:'COMPRA',symbol:'ITUB4',assetType:'Ação',quantity:1,price:35,grossValue:35,source:'B3'}],dividends:[],transactions_count:1,dividends_count:0});
  throw new Error(`unexpected ${href}`);
}, async()=>{
  const {res,payload}=await invokeSync('get_transactions',{token:'cloud-history-v2'});
  assert.equal(res.statusCode,200,JSON.stringify(payload));
  assert.equal(payload.transactions[0].symbol,'ITUB4');
  assert.equal(payload.totalCount,1);
});
console.log('Supabase cloud history minimal v2 OK');
