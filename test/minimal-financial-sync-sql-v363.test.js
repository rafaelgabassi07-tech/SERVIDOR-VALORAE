import assert from 'node:assert/strict';
import fs from 'node:fs';
import { readMinimalFinancialSql } from './helpers/minimal-financial-sql.js';

const sql = readMinimalFinancialSql();
const legacyBlock=fs.readFileSync(new URL('../supabase/03_legacy_block_and_verification.sql',import.meta.url),'utf8');
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
for(const table of ['valorae_user_snapshots','valorae_sync_backups','valorae_monitor_events','valorae_runtime_shared_state','valorae_sync_clients','valorae_sync_user_state','valorae_financial_state']) assert.match(legacyBlock,new RegExp(table));
assert.match(legacyBlock,/revoke all on table public\.%I from public, anon, authenticated, service_role/i);
for(const financial of ['valorae_financial_transactions','valorae_financial_dividends']) assert.doesNotMatch(legacyBlock,new RegExp(`revoke all on table public\.${financial}\b`));
console.log('minimal financial SQL v363 static contract OK');

assert.doesNotMatch(sql,/create table if not exists public\.valorae_financial_state/i);
