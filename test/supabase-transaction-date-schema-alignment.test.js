import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bootstrapFiles = [
  'supabase/001_valorae_snapshots.sql',
  'supabase/003_valorae_cloud_primary_tables_v88.sql',
  'supabase/release_2026_07_25/02_TABELAS_FINANCEIRAS_E_ESTADO.sql',
];
for (const relative of bootstrapFiles) {
  const content = fs.readFileSync(path.join(root, relative), 'utf8');
  assert.match(content, /transaction_date\s+timestamptz/i, `${relative} must bootstrap the RPC-compatible timestamptz schema`);
  assert.doesNotMatch(content, /transaction_date\s+bigint/i, `${relative} must not bootstrap the obsolete bigint schema`);
}
const migration = fs.readFileSync(path.join(root, 'supabase/006_valorae_financial_sync_integrity_v358.sql'), 'utf8');
assert.match(migration, /alter column transaction_date type timestamptz/i, 'migration 006 must convert legacy transaction_date columns');
assert.match(migration, /nullif\(r->>'transaction_date', ''\)::timestamptz/i, 'financial RPCs must consume ISO/timestamptz transaction dates');
console.log('Supabase transaction_date schema alignment OK');
