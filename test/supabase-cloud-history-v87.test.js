import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const syncRoute = fs.readFileSync(path.join(process.cwd(), 'routes/sync.js'), 'utf8');

assert.match(syncRoute, /21\.12\.151-cloud-primary-supabase-v88/);
assert.match(syncRoute, /function isTransactionDateColumnError/);
assert.match(syncRoute, /async function postTransactionRows/);
assert.match(syncRoute, /transactionDateMode/);
assert.match(syncRoute, /get_transactions/);
assert.match(syncRoute, /replace_transactions_for_symbols/);

console.log('Supabase cloud history v87 test OK.');
