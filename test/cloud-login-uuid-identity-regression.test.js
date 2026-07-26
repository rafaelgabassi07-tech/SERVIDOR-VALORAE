import assert from 'node:assert/strict';
import { invokeSync, jsonResponse, withMinimalSupabase } from './helpers/minimal-sync-harness.js';

let args;
await withMinimalSupabase(async (url, init={}) => {
  const href=String(url);
  if (href.includes('/auth/v1/user')) return jsonResponse({id:'44444444-4444-4444-8444-444444444444',email:'uuid@test'});
  if (href.includes('/rpc/valorae_financial_download_v2')) { args=JSON.parse(init.body); return jsonResponse({ok:true,contract:'valorae-financial-sync-v2',transactions:[],dividends:[],transactions_count:0,dividends_count:0}); }
  throw new Error(`unexpected ${href}`);
}, async () => {
  const {res,payload}=await invokeSync('get_transactions',{token:'uuid-regression-v2'});
  assert.equal(res.statusCode,200,JSON.stringify(payload));
  assert.equal(payload.verifiedEmpty,true);
});
assert.deepEqual(args,{p_user_id:'44444444-4444-4444-8444-444444444444'});
console.log('cloud login UUID identity v2 OK');
