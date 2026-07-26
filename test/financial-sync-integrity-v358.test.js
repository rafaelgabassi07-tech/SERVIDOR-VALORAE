import assert from 'node:assert/strict';
import fs from 'node:fs';
import { invokeSync, jsonResponse, withMinimalSupabase } from './helpers/minimal-sync-harness.js';

await withMinimalSupabase(async url => {
  const href=String(url);
  if (href.includes('/auth/v1/user')) return jsonResponse({id:'66666666-6666-4666-8666-666666666666'});
  throw new Error(`unexpected ${href}`);
}, async () => {
  const missing=await invokeSync('auth_check',{token:''});
  assert.equal(missing.res.statusCode,401);
  assert.equal(missing.payload.code,'AUTH_TOKEN_MISSING');
  const valid=await invokeSync('auth_check',{token:'financial-integrity-token'});
  assert.equal(valid.res.statusCode,200,JSON.stringify(valid.payload));
  assert.equal(valid.payload.authenticated,true);
});
const source=fs.readFileSync(new URL('../routes/sync.js',import.meta.url),'utf8');
assert.match(source,/SUPABASE_SERVICE_ROLE_KEY/);
assert.doesNotMatch(source,/password\s*[:=]/i);
assert.match(source,/valorae_financial_transactions/);
assert.match(source,/valorae_financial_dividends/);
assert.doesNotMatch(source,/insert.*valorae_user_snapshots/is);
console.log('minimal financial sync integrity v363 OK');
