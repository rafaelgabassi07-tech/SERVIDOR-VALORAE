import fs from 'node:fs';

export function readMinimalFinancialSql() {
  return [
    '../../supabase/01_transactions.sql',
    '../../supabase/02_dividends.sql',
    '../../supabase/03_legacy_block_and_verification.sql',
  ].map(path => fs.readFileSync(new URL(path, import.meta.url), 'utf8')).join('\n');
}
