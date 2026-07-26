import assert from 'node:assert/strict';
import fs from 'node:fs';

const sql=fs.readFileSync(new URL('../supabase/013_valorae_minimal_financial_sync_v2.sql',import.meta.url),'utf8');
const cleanup=fs.readFileSync(new URL('../supabase/014_valorae_remove_nonessential_cloud_data.sql',import.meta.url),'utf8');
const tags=[...sql.matchAll(/\$[A-Za-z_][A-Za-z0-9_]*\$|\$\$/g)].map(m=>m[0]);
for(const tag of new Set(tags)) assert.equal(tags.filter(x=>x===tag).length%2,0,`dollar quote não fechado: ${tag}`);
assert.equal((sql.match(/create or replace function public\.valorae_financial_/gi)||[]).length,9);
assert.deepEqual([...sql.matchAll(/create table if not exists public\.([a-z0-9_]+)/gi)].map(m=>m[1]),['valorae_financial_transactions','valorae_financial_dividends']);
assert.match(sql,/primary key \(user_id, client_tx_id\)/i);
assert.match(sql,/primary key \(user_id, event_id\)/i);
assert.match(sql,/where t\.user_id = p_user_id/i);
assert.match(sql,/where d\.user_id = p_user_id/i);
assert.match(sql,/is distinct from/i);
assert.match(sql,/p\.proname like 'valorae_sync_%'/i);
const tableSection=sql.slice(0,sql.indexOf('create or replace function'));
assert.doesNotMatch(tableSection,/\bpayload\s+jsonb\b/i);
for(const table of ['valorae_user_snapshots','valorae_sync_backups','valorae_monitor_events','valorae_runtime_shared_state','valorae_sync_clients','valorae_sync_user_state','valorae_financial_state']) assert.match(cleanup,new RegExp(`truncate table public\\.${table}`));
for(const financial of ['valorae_transactions','valorae_dividend_events','valorae_financial_transactions','valorae_financial_dividends']) assert.doesNotMatch(cleanup,new RegExp(`truncate table public\\.${financial}\\b`));
console.log('minimal financial SQL v363 static contract OK');

assert.doesNotMatch(sql,/create table if not exists public\.valorae_financial_state/i);
