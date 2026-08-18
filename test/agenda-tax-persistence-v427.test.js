import assert from 'node:assert/strict';
import fs from 'node:fs';

const sync = fs.readFileSync(new URL('../routes/sync.js', import.meta.url), 'utf8');
const sqlFiles = [
  '../supabase/00_cloud_transaction_recovery.sql',
  '../supabase/02_dividends.sql',
  '../supabase/03_legacy_block_and_verification.sql',
  '../supabase/complete/02_dividends_COMPLETO.sql'
].map(path => fs.readFileSync(new URL(path, import.meta.url), 'utf8'));
const fields = [
  'gross_value_per_share', 'net_value_per_share', 'tax_rate', 'tax_withheld_per_share',
  'gross_amount', 'net_amount', 'tax_withheld_amount', 'tax_rule'
];
for (const field of fields) {
  assert.ok(sqlFiles.every(sql => sql.includes(field)), `${field} deve existir em todos os contratos SQL de dividendos`);
}
for (const field of ['grossValuePerShare','netValuePerShare','taxRate','taxWithheldPerShare','grossAmount','netAmount','taxWithheldAmount','taxRule']) {
  assert.ok(sync.includes(field), `sync route deve transportar ${field}`);
}
assert.match(sqlFiles[1], /add column if not exists\s+tax_withheld_amount/i, 'upgrade idempotente deve incluir IRRF total');
assert.match(sqlFiles[0], /add column if not exists\s+tax_rule/i, 'instalador unificado deve atualizar bancos existentes');
console.log('agenda tax persistence v427 OK');
