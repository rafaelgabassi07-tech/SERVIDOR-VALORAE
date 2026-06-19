# Valorae Proxy v88 — Cloud Primary Supabase

## Diagnóstico confirmado

As tabelas `valorae_transactions`, `valorae_dividend_events`, `valorae_sync_backups`, `valorae_sync_clients` e `valorae_user_snapshots` existem, mas o Proxy anterior não espelhava tudo:

- Transações eram gravadas por `upsert_transactions`/`replace_transactions_for_symbols`, com fallback de data desde v86/v87.
- Proventos tinham actions no Proxy, mas o APK ainda não acionava essa gravação.
- Backups não eram preenchidos automaticamente.

## Ajustes no Proxy

- Patch: `21.12.151-cloud-primary-supabase-v88`.
- Adicionado `BACKUPS_TABLE = valorae_sync_backups`.
- Diagnóstico agora testa também `valorae_sync_backups`.
- Health anuncia `backupsTable` e `cloudMode = cloud_primary_local_cache`.
- Escritas confirmadas de snapshots, transações e proventos são espelhadas em `valorae_sync_backups`.
- Novas actions: `upsert_sync_backup` e `get_sync_backups`.
- Incluído SQL `supabase/003_valorae_cloud_primary_tables_v88.sql`.

## Validação

- `node scripts/check-syntax.js`: OK.
- `npm test`: OK, 65 arquivos de teste, 0 falhas.
