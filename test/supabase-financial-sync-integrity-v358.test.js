import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const sql = fs.readFileSync(path.join(process.cwd(), 'supabase/006_valorae_financial_sync_integrity_v358.sql'), 'utf8');
const functionNames = [
  'valorae_sync_get_state',
  'valorae_sync_assert_state',
  'valorae_sync_upsert_transactions',
  'valorae_sync_replace_transactions',
  'valorae_sync_upsert_snapshots',
  'valorae_sync_upsert_dividends',
  'valorae_sync_delete_user_data',
];

for (const name of functionNames) {
  const declarations = sql.match(new RegExp(`create\\s+or\\s+replace\\s+function\\s+public\\.${name}\\s*\\(`, 'gi')) || [];
  assert.equal(declarations.length, 1, `${name} deve ser declarada exatamente uma vez`);
}
assert.equal((sql.match(/\bas \$\$/gi) || []).length, (sql.match(/\n\$\$;/g) || []).length, 'blocos PL/pgSQL devem estar balanceados');

const normalizeDeclarations = sql.match(/create\s+or\s+replace\s+function\s+public\.valorae_normalize_client_tx_id\s*\(/gi) || [];
assert.equal(normalizeDeclarations.length, 1, 'normalizador SQL de client_tx_id deve existir uma única vez');
assert.match(sql, /regexp_replace\(trim\(coalesce\(p_value, ''\)\), '\[\^A-Za-z0-9:_-\]'/i, 'SQL deve usar o mesmo alfabeto seguro do APK/Proxy');
assert.match(sql, /length\(v_safe\) <= 96/i, 'SQL deve preservar IDs seguros de até 96 caracteres');
assert.match(sql, /left\(v_safe, 71\).*left\(encode\(digest\(v_safe, 'sha256'\), 'hex'\), 24\)/is, 'SQL deve usar o mesmo prefixo/hash determinístico');
assert.equal((sql.match(/public\.valorae_normalize_client_tx_id\(\s*r->>'client_tx_id'/gi) || []).length, 2, 'as duas RPCs de transação devem normalizar IDs no banco');

function functionBody(name) {
  const start = sql.search(new RegExp(`create\\s+or\\s+replace\\s+function\\s+public\\.${name}\\s*\\(`, 'i'));
  assert.ok(start >= 0, `função ausente: ${name}`);
  const next = sql.indexOf('\ncreate or replace function public.', start + 10);
  return sql.slice(start, next >= 0 ? next : sql.length);
}

for (const name of functionNames) {
  const body = functionBody(name);
  assert.match(body, /security definer/i, `${name} deve ser SECURITY DEFINER`);
  assert.match(body, /set search_path = public, pg_temp/i, `${name} deve fixar search_path`);
  const declarationBlock = body.match(/\ndeclare\s+([\s\S]*?)\nbegin\b/i)?.[1] || '';
  const declared = [...declarationBlock.matchAll(/^\s*(v_[a-z0-9_]+)\s+[^;]+;/gim)].map((match) => match[1]);
  assert.equal(new Set(declared).size, declared.length, `${name} não pode declarar variável duplicada`);
}

const replaceBody = functionBody('valorae_sync_replace_transactions');
assert.ok(replaceBody.indexOf('delete from public.valorae_transactions') < replaceBody.indexOf('insert into public.valorae_transactions'), 'replace deve excluir antes de inserir dentro da mesma RPC');
assert.match(replaceBody, /valorae_sync_assert_state/i, 'replace deve validar e bloquear a revisão antes de escrever');
assert.match(functionBody('valorae_sync_assert_state'), /for update/i, 'assert_state deve adquirir lock por usuário');
assert.match(replaceBody, /p_backup/i, 'espelho de segurança deve participar da mesma transação');

const deleteBody = functionBody('valorae_sync_delete_user_data');
for (const table of ['valorae_user_snapshots', 'valorae_transactions', 'valorae_dividend_events', 'valorae_sync_backups']) {
  assert.match(deleteBody, new RegExp(`delete\\s+from\\s+public\\.${table}`, 'i'), `delete deve limpar ${table}`);
}
assert.match(deleteBody, /deletion_generation\s*=\s*deletion_generation\s*\+\s*1/i);
assert.match(deleteBody, /tombstone\s*=\s*true/i);
assert.match(deleteBody, /deleted_at\s*=\s*now\(\)/i);

assert.match(sql, /revoke all on public\.valorae_sync_user_state from anon, authenticated/i);
for (const name of functionNames.filter((name) => name !== 'valorae_sync_assert_state')) {
  assert.match(sql, new RegExp(`grant\\s+execute\\s+on\\s+function\\s+public\\.${name}\\(`, 'i'), `${name} deve ser acessível ao service_role`);
}
assert.doesNotMatch(sql, /grant\s+execute[^;]+to\s+(?:anon|authenticated)/i);

console.log('supabase-financial-sync-integrity-v358 ok');
