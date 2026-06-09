# VALORAE Proxy v21.12.78 — Supabase Auth + Full Sync

Implementado:

- `/api/sync` aceita JWT do Supabase Auth no header `Authorization: Bearer`.
- O Proxy valida o usuário em `/auth/v1/user`.
- O `user_id` do Supabase passa a isolar snapshots, transações e proventos.
- Novas ações:
  - `upsert_transactions`
  - `get_transactions`
  - `upsert_dividend_events`
  - `get_dividend_events`
- Mantida compatibilidade com `register_client` antigo.
- `delete_user_data` remove snapshots, transações e proventos do usuário.

Variáveis no Vercel do Proxy:

```env
SUPABASE_URL=https://SEU-PROJETO.supabase.co
SUPABASE_SERVICE_ROLE_KEY=SUA_CHAVE_SECRETA
VALORAE_SUPABASE_SNAPSHOT_TABLE=valorae_user_snapshots
VALORAE_SUPABASE_CLIENTS_TABLE=valorae_sync_clients
VALORAE_SUPABASE_TRANSACTIONS_TABLE=valorae_transactions
VALORAE_SUPABASE_DIVIDENDS_TABLE=valorae_dividend_events
```

Executar no Supabase:

```text
supabase/001_valorae_snapshots.sql
```
