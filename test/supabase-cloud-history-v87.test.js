import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const syncRoute = fs.readFileSync(path.join(process.cwd(), 'routes/sync.js'), 'utf8');

assert.match(syncRoute, /21\.12\.394-runtime-safety-v362/);
assert.match(syncRoute, /valorae_sync_upsert_transactions/);
assert.match(syncRoute, /valorae_sync_replace_transactions/);
assert.match(syncRoute, /get_transactions/);
assert.match(syncRoute, /replace_transactions_for_symbols/);
assert.doesNotMatch(syncRoute, /async function postTransactionRows/);
assert.doesNotMatch(syncRoute, /function isTransactionDateColumnError/);

console.log('Supabase cloud history v87 test OK.');
