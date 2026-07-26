import assert from 'node:assert/strict';
import { invokeSync, jsonResponse, withMinimalSupabase } from './helpers/minimal-sync-harness.js';

let authCalls=0;
await withMinimalSupabase(async url => {
  if (String(url).includes('/auth/v1/user')) { authCalls++; return jsonResponse({id:'77777777-7777-4777-8777-777777777777',email:'auth@test'}); }
  throw new Error(`unexpected ${url}`);
}, async () => {
  const first=await invokeSync('auth_check',{token:'auth-check-v2'});
  assert.equal(first.res.statusCode,200,JSON.stringify(first.payload));
  assert.equal(first.payload.code,'AUTH_OK');
  const second=await invokeSync('auth_check',{token:'auth-check-v2'});
  assert.equal(second.res.statusCode,200);
});
assert.equal(authCalls,1,'a mesma sessão deve usar cache local de autenticação');
console.log('Supabase auth check minimal v2 OK');
