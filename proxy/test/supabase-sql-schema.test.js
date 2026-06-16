import assert from 'node:assert/strict';
import fs from 'node:fs';

const sql = fs.readFileSync('supabase/001_valorae_snapshots.sql', 'utf8');

for (const table of [
  'public.valorae_user_snapshots',
  'public.valorae_sync_clients',
  'public.valorae_transactions',
  'public.valorae_dividend_events',
]) {
  assert.match(sql, new RegExp(`create table if not exists ${table.replace('.', '\\.')}`, 'i'), `${table} deve existir no SQL de setup`);
  assert.match(sql, new RegExp(`alter table ${table.replace('.', '\\.')} enable row level security`, 'i'), `${table} deve ativar RLS`);
}

assert.doesNotMatch(sql, /valorae_official_dividend_events/i, 'SQL de setup não deve trazer tabela antiga não usada pela rota /api/sync');
assert.doesNotMatch(sql, /valorae_user_dividend_events/i, 'SQL de setup não deve trazer tabela antiga não usada pela rota /api/sync');

console.log('Supabase SQL schema tests OK.');
