import assert from 'node:assert/strict';
import fs from 'node:fs';

const base = new URL('../supabase/release_2026_07_25/', import.meta.url);
const read = (name) => fs.readFileSync(new URL(name, base), 'utf8');
const sql = [
  '01_EXTENSAO_TABELAS_SNAPSHOTS_CLIENTES.sql',
  '02_TABELAS_FINANCEIRAS_E_ESTADO.sql',
  '03_NORMALIZAR_DADOS_EXISTENTES.sql',
  '04_FUNCOES_DE_ESTADO_E_REVISAO.sql',
  '05_RPC_UPSERT_TRANSACOES_OTIMIZADO.sql',
  '06_RPC_SUBSTITUIR_TRANSACOES_OTIMIZADO.sql',
  '07_RPC_UPSERT_SNAPSHOTS_OTIMIZADO.sql',
  '08_RPC_UPSERT_PROVENTOS_OTIMIZADO.sql',
  '09_RPC_EXCLUSAO_E_PERMISSOES.sql',
  '10_INDICES_LIMPEZA_E_ESTATISTICAS.sql',
  '11_VALIDAR_INSTALACAO.sql',
].map(read).join('\n');
const diagnostics = read('12_DIAGNOSTICO_DE_RECURSOS_OPCIONAL.sql');
const route = fs.readFileSync(new URL('../routes/sync.js', import.meta.url), 'utf8');
const shared = fs.readFileSync(new URL('../lib/state/shared-state-foundation.js', import.meta.url), 'utf8');
const monitor = fs.readFileSync(new URL('../lib/observability/monitor-persistence.js', import.meta.url), 'utf8');

for (const name of [
  'valorae_sync_upsert_transactions',
  'valorae_sync_replace_transactions',
  'valorae_sync_upsert_snapshots',
  'valorae_sync_upsert_dividends',
]) {
  const declarations = sql.match(new RegExp(`create\\s+or\\s+replace\\s+function\\s+public\\.${name}\\s*\\(`, 'gi')) || [];
  assert.equal(declarations.length, 1, `${name} deve ser redefinida exatamente uma vez`);
}
assert.equal((sql.match(/\$\$/g) || []).length % 2, 0, 'blocos SQL dollar-quoted devem estar balanceados');
assert.doesNotMatch(sql, /excluded\.payload\s+excluded\.payload/i);
assert.match(sql, /is distinct from row\s*\(/i);
assert.match(sql, /not exists\s*\([\s\S]+jsonb_array_elements/i);
assert.doesNotMatch(sql, /insert\s+into\s+public\.valorae_sync_backups/i, 'RPCs atuais não devem duplicar payloads em backup');
assert.match(sql, /truncate table public\.valorae_monitor_events/i);
assert.match(sql, /truncate table public\.valorae_runtime_shared_state/i);
assert.match(sql, /where b\.ctid = r\.ctid and r\.rn > 3/i);
assert.match(sql, /analyze public\.valorae_transactions/i);
assert.match(diagnostics, /from pg_stat_statements/i);
assert.match(diagnostics, /n_dead_tup/i);
assert.match(diagnostics, /from pg_stat_activity/i);

assert.match(route, /VALORAE_FINANCIAL_SYNC_BACKUPS_ENABLED/);
assert.match(route, /return envEnabled\([^,]+, false\)/i);
assert.match(route, /p_backup: optionalBackup\(/i);
assert.match(route, /authCacheHits/);
assert.match(route, /diagnosticsCacheHits/);
assert.doesNotMatch(route, /select=\*&limit=1/);
assert.match(shared, /VALORAE_SHARED_STATE_REMOTE_ENABLED/);
assert.match(shared, /const raw = String\(process\.env\.VALORAE_SHARED_STATE_MODE \|\| 'memory'\)/);
assert.match(monitor, /const enabled = false/);
assert.match(monitor, /active: false/);

console.log('supabase resource optimization 2026-07-25 ok');
