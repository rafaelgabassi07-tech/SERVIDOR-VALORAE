# Valorae Proxy v88 — Cloud Primary Supabase

Pacote pronto para Vercel/AI Studio, com arquivos na raiz.

- Core: `21.12.0`
- Patch: `21.12.151-cloud-primary-supabase-v88`

Principais mudanças:

- `/api/sync` confirma uso de `valorae_transactions`, `valorae_dividend_events`, `valorae_user_snapshots`, `valorae_sync_clients` e `valorae_sync_backups`.
- Escritas confirmadas de Histórico, snapshots e proventos agora são espelhadas em `valorae_sync_backups`.
- Novas actions: `upsert_sync_backup` e `get_sync_backups`.
- Diagnóstico passa a testar também a tabela de backups.
- Incluído SQL `supabase/003_valorae_cloud_primary_tables_v88.sql` para preparar/ajustar todas as tabelas de nuvem.
