import assert from 'node:assert/strict';
import { invokeSync, jsonResponse, withMinimalSupabase } from './helpers/minimal-sync-harness.js';
let calls=0;
await withMinimalSupabase(async url=>{
  calls++;
  if(String(url).includes('/auth/v1/user')) return jsonResponse({id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'});
  throw new Error(`snapshot must not access DB: ${url}`);
},async()=>{
  const write=await invokeSync('upsert_snapshots',{token:'snapshot-noop-v2',body:{snapshots:[{payload:{large:'ignored'}}]}});
  assert.equal(write.res.statusCode,200,JSON.stringify(write.payload));
  assert.equal(write.payload.featureDisabled,true);
  const read=await invokeSync('get_snapshot',{token:'snapshot-noop-v2-read'});
  assert.equal(read.res.statusCode,200,JSON.stringify(read.payload));
  assert.deepEqual(read.payload.snapshots,[]);
});
assert.equal(calls,2,'cada ação legada apenas valida Auth');
console.log('Supabase snapshot compatibility disabled OK');
