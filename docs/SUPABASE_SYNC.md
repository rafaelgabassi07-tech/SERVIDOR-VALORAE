# Supabase Sync — Valorae Proxy

Esta integração é opcional e roda somente no Proxy/Vercel. O APK nunca deve receber `SUPABASE_SERVICE_ROLE_KEY`.

## Variáveis mínimas no Vercel

```text
SUPABASE_URL=https://SEU-PROJETO.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sb_secret_...
```

Variáveis opcionais para nomes de tabelas:

```text
VALORAE_SUPABASE_SNAPSHOT_TABLE=valorae_user_snapshots
VALORAE_SUPABASE_CLIENTS_TABLE=valorae_sync_clients
VALORAE_SUPABASE_TRANSACTIONS_TABLE=valorae_transactions
VALORAE_SUPABASE_DIVIDENDS_TABLE=valorae_dividend_events
VALORAE_SUPABASE_CLIENT_SECRET_PEPPER=uma-string-longa
VALORAE_SUPABASE_SYNC_TOKEN=token-admin-opcional
```

## Teste real

```text
GET /api/sync?action=diagnostics
```

Resultado esperado:

```json
{
  "ok": true,
  "supabase": {
    "configured": true,
    "tables": [
      { "table": "valorae_user_snapshots", "accessible": true }
    ]
  }
}
```

## Esquema SQL sugerido

Arquivo pronto: `supabase/001_valorae_snapshots.sql`. Execute esse arquivo no SQL Editor do Supabase antes de testar `diagnostics`.

```sql
create table if not exists public.valorae_user_snapshots (
  user_id text not null,
  domain text not null,
  snapshot_key text not null,
  schema_version integer default 3,
  app_version text,
  device_id text,
  source text,
  encrypted boolean default false,
  payload jsonb,
  payload_ciphertext text,
  updated_at timestamptz default now(),
  primary key (user_id, domain, snapshot_key)
);

create table if not exists public.valorae_sync_clients (
  user_id text primary key,
  device_id text,
  client_secret_hash text not null,
  app_version text,
  source text,
  schema_version integer default 2,
  revoked boolean default false,
  last_seen_at timestamptz default now()
);

create table if not exists public.valorae_transactions (
  user_id text not null,
  client_tx_id text not null,
  ticker text,
  name text,
  quantity numeric,
  purchase_price numeric,
  transaction_date bigint,
  asset_type text,
  is_sell boolean default false,
  broker text,
  sector text,
  notes text,
  payload jsonb,
  updated_at timestamptz default now(),
  primary key (user_id, client_tx_id)
);

create table if not exists public.valorae_dividend_events (
  user_id text not null,
  event_key text not null,
  ticker text,
  date_com text,
  payment_date text,
  value_per_share numeric,
  quantity numeric,
  estimated_amount numeric,
  status text,
  category text,
  source text,
  payload jsonb,
  updated_at timestamptz default now(),
  primary key (user_id, event_key)
);
```

## Ações

- `health`: verifica variáveis detectadas.
- `diagnostics`: verifica conexão real e tabelas.
- `register_client`: registra dispositivo local.
- `upsert_snapshot` / `get_snapshot`: salva e busca um snapshot.
- `upsert_snapshots` / `get_snapshots`: salva e busca snapshots em lote, contrato preferido pelo APK.
- `upsert_transactions` / `get_transactions`: salva e busca transações.
- `upsert_dividend_events` / `get_dividend_events`: salva e busca proventos reais.
- `delete_user_data`: remove dados do usuário autenticado.


## Alinhamento APK 2026-06-13

O Proxy agora publica `capabilities` em `/api/sync?action=health` e `/api/sync?action=diagnostics`.

Capacidades anunciadas:

```text
health
diagnostics
register_client
upsert_snapshot
get_snapshot
upsert_snapshots
get_snapshots
upsert_transactions
get_transactions
upsert_dividend_events
get_dividend_events
delete_user_data
```

A tabela `valorae_user_snapshots` recebeu metadados opcionais de cache para o APK saber se um snapshot ainda está fresco:

```sql
cache_scope text default 'user'
cache_ttl_seconds integer
expires_at timestamptz
source_updated_at timestamptz
etag text
payload_size_bytes integer
```
