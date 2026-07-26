import assert from 'node:assert/strict';
import fs from 'node:fs';
const route=fs.readFileSync(new URL('../routes/sync.js',import.meta.url),'utf8');
assert.match(route,/Snapshots em nuvem foram desativados/);
assert.match(route,/featureDisabled:\s*true/);
assert.doesNotMatch(route,/valorae_sync_upsert_snapshots|valorae_user_snapshots/);
console.log('Supabase snapshot writes removed from runtime OK');
