import assert from 'node:assert/strict';
import { invokeSync, jsonResponse, withMinimalSupabase } from './helpers/minimal-sync-harness.js';

let rpc;
await withMinimalSupabase(async (url, init={}) => {
  const href=String(url);
  if (href.includes('/auth/v1/user')) return jsonResponse({id:'55555555-5555-4555-8555-555555555555'});
  if (href.includes('/rpc/valorae_financial_upload_dividends_v2')) { rpc=JSON.parse(init.body); return jsonResponse({ok:true,contract:'valorae-financial-sync-v2',count:1,deleted:0,dividends_version:1}); }
  throw new Error(`unexpected ${href}`);
}, async () => {
  const {res,payload}=await invokeSync('upload_dividends',{token:'dividend-v2',body:{events:[{eventKey:'evt-1',ticker:'BVMF:PETR4F',date_com:'2026-07-20',payment_date:'2026-08-01',value_per_share:'1.5',quantity:2,estimated_amount:3,source:'B3'}]}});
  assert.equal(res.statusCode,200,JSON.stringify(payload));
  assert.equal(payload.count,1);
});
assert.equal(rpc.p_user_id,'55555555-5555-4555-8555-555555555555');
assert.equal(rpc.p_rows[0].ticker,'PETR4');
assert.equal(rpc.p_rows[0].valuePerShare,1.5);
assert.equal(rpc.p_replace_all,true);
console.log('minimal dividend cloud sync v363 OK');
