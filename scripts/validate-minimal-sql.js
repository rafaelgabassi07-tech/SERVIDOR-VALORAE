#!/usr/bin/env node
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sqlDir = path.join(root, 'supabase');
const canonical = [
  '01_transactions.sql',
  '02_dividends.sql',
  '03_legacy_block_and_verification.sql',
];
const expected = ['00_cloud_transaction_recovery.sql', ...canonical];
const actual = fs.readdirSync(sqlDir).filter(name => name.endsWith('.sql')).sort();
assert.deepEqual(actual, expected, 'supabase/ deve conter o instalador único e os três SQLs canônicos');

const texts = Object.fromEntries(expected.map(name => [name, fs.readFileSync(path.join(sqlDir, name), 'utf8')]));
const combined = canonical.map(name => texts[name]).join('\n');
const recovery = texts['00_cloud_transaction_recovery.sql'];
for (const name of canonical) {
  assert.ok(recovery.includes(texts[name].trim()), `00_cloud_transaction_recovery.sql não incorpora ${name}`);
}

for (const [name, text] of Object.entries(texts)) {
  assert.equal((text.match(/\$\$/g) || []).length % 2, 0, `${name}: delimitadores $$ desbalanceados`);
  assert.ok(text.trim().endsWith(';'), `${name}: arquivo deve terminar com ponto e vírgula`);
}

assert.match(texts['01_transactions.sql'], /create table if not exists public\.valorae_financial_transactions/i);
assert.match(texts['01_transactions.sql'], /valorae_financial_upload_transactions_v2/i);
assert.match(texts['02_dividends.sql'], /create table if not exists public\.valorae_financial_dividends/i);
assert.match(texts['02_dividends.sql'], /valorae_financial_upload_dividends_v2/i);
for (const rpc of ['download', 'status', 'delete']) {
  assert.match(texts['03_legacy_block_and_verification.sql'], new RegExp(`valorae_financial_${rpc}_v2`, 'i'));
}
assert.match(texts['03_legacy_block_and_verification.sql'], /valorae_sync_%/i);

assert.match(texts['03_legacy_block_and_verification.sql'], /extract\s*\(\s*epoch\s+from\s+v_transactions_updated\s*\)/i);
assert.match(texts['03_legacy_block_and_verification.sql'], /extract\s*\(\s*epoch\s+from\s+v_dividends_updated\s*\)/i);
for (const name of ['01_transactions_COMPLETO.sql', '02_dividends_COMPLETO.sql']) {
  const completePath = path.join(sqlDir, 'complete', name);
  assert.ok(fs.existsSync(completePath), `SQL completo ausente: ${name}`);
  const completeText = fs.readFileSync(completePath, 'utf8');
  assert.match(completeText, /valorae-financial-sync-v2/i);
  assert.match(completeText, /extract\s*\(\s*epoch\s+from\s+v_(?:transactions|dividends)_updated\s*\)/i);
}

const createdTables = [...combined.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?([a-z0-9_]+)/gi)]
  .map(match => match[1].toLowerCase());
assert.deepEqual([...new Set(createdTables)].sort(), [
  'valorae_financial_dividends',
  'valorae_financial_transactions',
]);
assert.doesNotMatch(combined, /create\s+table[^;]*(snapshot|monitor|cache|shared_runtime|sync_state)/i);

const digest = crypto.createHash('sha256').update(combined).digest('hex');
console.log(`SQL mínimo OK: instalador único + 3 canônicos, 2 tabelas financeiras, legado bloqueado; sha256=${digest}`);
