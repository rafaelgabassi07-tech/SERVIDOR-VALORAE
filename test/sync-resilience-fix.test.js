import assert from 'node:assert/strict';
import { _test } from '../routes/sync.js';
import { invokeSync, jsonResponse, withMinimalSupabase } from './helpers/minimal-sync-harness.js';

assert.equal(_test.isRetryableSyncStatus(400),false);
assert.equal(_test.isRetryableSyncStatus(409),false);
assert.equal(_test.isRetryableSyncStatus(429),true);
assert.equal(_test.isRetryableSyncStatus(503),true);
assert.equal(_test.errorMeta({status:503,code:'SUPABASE_NOT_CONFIGURED',retryable:true}).retryable,true);

await withMinimalSupabase(async url=>{
  const href=String(url);
  if(href.includes('/auth/v1/user')) return jsonResponse({id:'cccccccc-cccc-4ccc-8ccc-cccccccccccc'});
  if(href.includes('/rpc/valorae_financial_download_v2')) return jsonResponse({code:'PGRST202',message:'Could not find the function'},404);
  if(href.includes('/rest/v1/valorae_financial_transactions')) return jsonResponse({code:'PGRST205',message:'Could not find the table'},404);
  if(href.includes('/rest/v1/valorae_financial_dividends')) return jsonResponse({code:'PGRST205',message:'Could not find the table'},404);
  throw new Error(`unexpected ${href}`);
},async()=>{
  const {res,payload}=await invokeSync('download_financial_data',{token:'migration-missing-v2'});
  assert.equal(res.statusCode,503,JSON.stringify(payload));
  assert.equal(payload.code,'MINIMAL_SYNC_MIGRATION_REQUIRED');
  assert.equal(payload.retryable,true);
});

await withMinimalSupabase(async url=>{
  if(String(url).includes('/auth/v1/user')) return jsonResponse({message:'temporarily unavailable'},503,{'retry-after':'5'});
  throw new Error(`unexpected ${url}`);
},async()=>{
  const {res,payload}=await invokeSync('auth_check',{token:'auth-unavailable-v2'});
  assert.equal(res.statusCode,503,JSON.stringify(payload));
  assert.equal(payload.retryable,true);
});
console.log('Sync resilience minimal v2 OK');
