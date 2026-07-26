import assert from 'node:assert/strict';
import { invokeSync, jsonResponse, withMinimalSupabase } from './helpers/minimal-sync-harness.js';

const rpc=[];
await withMinimalSupabase(async (url, init={}) => {
  const href=String(url);
  if (href.includes('/auth/v1/user')) return jsonResponse({id:'22222222-2222-4222-8222-222222222222',email:'legacy@example.com'});
  if (href.includes('/rpc/valorae_financial_download_v2')) { rpc.push(JSON.parse(init.body)); return jsonResponse({ok:true,contract:'valorae-financial-sync-v2',transactions:[],dividends:[],transactions_count:0,dividends_count:0}); }
  throw new Error(`unexpected ${href}`);
}, async () => {
  const {res,payload}=await invokeSync('download_financial_data',{token:'uuid-only-mixed-test'});
  assert.equal(res.statusCode,200,JSON.stringify(payload));
  assert.equal(payload.identitySource,'supabase_user_id');
});
assert.deepEqual(rpc,[{p_user_id:'22222222-2222-4222-8222-222222222222'}]);
assert.ok(!JSON.stringify(rpc).includes('legacy@example.com'));
console.log('UUID-only cloud restore identity OK');
