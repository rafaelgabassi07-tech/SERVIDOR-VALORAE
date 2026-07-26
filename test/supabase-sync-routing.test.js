import assert from 'node:assert/strict';
import { invokeSync, withMinimalSupabase } from './helpers/minimal-sync-harness.js';
await withMinimalSupabase(async()=>{ throw new Error('health must not call Supabase'); },async()=>{
  const {res,payload}=await invokeSync('health',{token:'',method:'GET'});
  assert.equal(res.statusCode,200,JSON.stringify(payload));
  assert.equal(payload.contract,'valorae-financial-sync-v2');
  assert.equal(payload.supabase.cloudMode,'minimal_financial_only');
  assert.equal(payload.supabase.snapshotsEnabled,false);
  assert.ok(payload.capabilities.includes('download_financial_data'));
  assert.ok(payload.capabilities.includes('upload_transactions'));
  assert.ok(payload.capabilities.includes('upload_dividends'));
});
console.log('Supabase minimal sync routing OK');
