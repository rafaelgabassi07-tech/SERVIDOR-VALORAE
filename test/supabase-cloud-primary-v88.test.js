import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const syncRoute = fs.readFileSync(path.join(process.cwd(), 'routes/sync.js'), 'utf8');
const sql = fs.readFileSync(path.join(process.cwd(), 'supabase/003_valorae_cloud_primary_tables_v88.sql'), 'utf8');

assert.match(syncRoute, /21\.12\.151-cloud-primary-supabase-v88/);
assert.match(syncRoute, /BACKUPS_TABLE/);
assert.doesNotMatch(syncRoute, /['\"]upsert_sync_backup['\"]/, 'backup manual foi removido para não contornar revisão/tombstone');
assert.match(syncRoute, /get_sync_backups/);
assert.doesNotMatch(syncRoute, /function\s+mirrorSyncBackup\b/, 'backup agora é gravado somente dentro das RPCs transacionais');
assert.match(syncRoute, /upsert_dividend_events/);
assert.match(sql, /create table if not exists public\.valorae_sync_backups/i);
assert.match(sql, /create table if not exists public\.valorae_transactions/i);
assert.match(sql, /create table if not exists public\.valorae_dividend_events/i);
assert.match(sql, /notify pgrst, 'reload schema'/i);

console.log('Supabase cloud primary v88 tests OK.');
