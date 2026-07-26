import assert from 'node:assert/strict';
import { invokeSync, jsonResponse, withMinimalSupabase } from './helpers/minimal-sync-harness.js';
const transactions=Array.from({length:1620},(_,i)=>({clientTxId:`tx-${i}`,date:'2026-01-01',operation:'COMPRA',symbol:'PETR4',assetType:'Ação',quantity:1,price:30,grossValue:30,source:'B3'}));
let rpcCalls=0;
await withMinimalSupabase(async url=>{
  const href=String(url);
  if(href.includes('/auth/v1/user')) return jsonResponse({id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'});
  if(href.includes('/rpc/valorae_financial_download_v2')) {rpcCalls++; return jsonResponse({ok:true,contract:'valorae-financial-sync-v2',transactions,dividends:[],transactions_count:transactions.length,dividends_count:0});}
  throw new Error(`unexpected ${href}`);
},async()=>{
  const {res,payload}=await invokeSync('get_transactions',{token:'large-history-v2'});
  assert.equal(res.statusCode,200,JSON.stringify(payload).slice(0,400));
  assert.equal(payload.transactions.length,1620);
  assert.equal(payload.totalCount,1620);
});
assert.equal(rpcCalls,1,'histórico completo deve vir em uma RPC, sem páginas recusáveis');
console.log('large history one-RPC restore regression OK');
