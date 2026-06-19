-- Valorae v88 — Nuvem como fonte principal
-- Execute no SQL Editor do Supabase e clique em RUN.
-- Garante que transactions, dividend_events, snapshots, clients e sync_backups existam
-- com colunas compatíveis com o Proxy v88.

create extension if not exists pgcrypto;

create table if not exists public.valorae_user_snapshots (
  user_id text not null,
  domain text not null,
  snapshot_key text not null,
  schema_version integer default 3,
  app_version text,
  device_id text,
  source text,
  cache_scope text default 'user',
  cache_ttl_seconds integer,
  expires_at timestamptz,
  source_updated_at timestamptz,
  etag text,
  payload_size_bytes integer,
  encrypted boolean default false,
  payload jsonb,
  payload_ciphertext text,
  updated_at timestamptz default now(),
  primary key (user_id, domain, snapshot_key)
);

alter table public.valorae_user_snapshots
  add column if not exists schema_version integer default 3,
  add column if not exists app_version text,
  add column if not exists device_id text,
  add column if not exists source text,
  add column if not exists cache_scope text default 'user',
  add column if not exists cache_ttl_seconds integer,
  add column if not exists expires_at timestamptz,
  add column if not exists source_updated_at timestamptz,
  add column if not exists etag text,
  add column if not exists payload_size_bytes integer,
  add column if not exists encrypted boolean default false,
  add column if not exists payload jsonb,
  add column if not exists payload_ciphertext text,
  add column if not exists updated_at timestamptz default now();

create table if not exists public.valorae_sync_clients (
  user_id text primary key,
  device_id text,
  client_secret_hash text,
  app_version text,
  source text,
  schema_version integer default 2,
  revoked boolean default false,
  last_seen_at timestamptz default now()
);

alter table public.valorae_sync_clients
  add column if not exists device_id text,
  add column if not exists client_secret_hash text,
  add column if not exists app_version text,
  add column if not exists source text,
  add column if not exists schema_version integer default 2,
  add column if not exists revoked boolean default false,
  add column if not exists last_seen_at timestamptz default now();

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

alter table public.valorae_transactions
  add column if not exists client_tx_id text,
  add column if not exists ticker text,
  add column if not exists name text,
  add column if not exists quantity numeric,
  add column if not exists purchase_price numeric,
  add column if not exists asset_type text,
  add column if not exists is_sell boolean default false,
  add column if not exists broker text,
  add column if not exists sector text,
  add column if not exists notes text,
  add column if not exists payload jsonb,
  add column if not exists updated_at timestamptz default now();

-- Se transaction_date existir como timestamptz em um projeto antigo, o Proxy v88 converte automaticamente.
-- O tipo recomendado para novas instalações é bigint em milissegundos Unix.

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

alter table public.valorae_dividend_events
  add column if not exists event_key text,
  add column if not exists ticker text,
  add column if not exists date_com text,
  add column if not exists payment_date text,
  add column if not exists value_per_share numeric,
  add column if not exists quantity numeric,
  add column if not exists estimated_amount numeric,
  add column if not exists status text,
  add column if not exists category text,
  add column if not exists source text,
  add column if not exists payload jsonb,
  add column if not exists updated_at timestamptz default now();

create table if not exists public.valorae_sync_backups (
  backup_id uuid primary key default gen_random_uuid(),
  user_id text not null,
  backup_kind text default 'sync_event',
  source text default 'valorae-proxy',
  payload jsonb default '{}'::jsonb,
  payload_size_bytes integer,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.valorae_sync_backups
  add column if not exists backup_id uuid default gen_random_uuid(),
  add column if not exists user_id text,
  add column if not exists backup_kind text default 'sync_event',
  add column if not exists source text default 'valorae-proxy',
  add column if not exists payload jsonb default '{}'::jsonb,
  add column if not exists payload_size_bytes integer,
  add column if not exists metadata jsonb default '{}'::jsonb,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

create unique index if not exists valorae_user_snapshots_identity_uidx
  on public.valorae_user_snapshots (user_id, domain, snapshot_key);
create index if not exists valorae_user_snapshots_user_idx
  on public.valorae_user_snapshots (user_id, updated_at desc);
create index if not exists valorae_user_snapshots_expires_idx
  on public.valorae_user_snapshots (user_id, domain, expires_at);
create unique index if not exists valorae_transactions_user_client_tx_uidx
  on public.valorae_transactions (user_id, client_tx_id);
create index if not exists valorae_transactions_user_date_idx
  on public.valorae_transactions (user_id, transaction_date desc);
create index if not exists valorae_transactions_user_ticker_idx
  on public.valorae_transactions (user_id, ticker);
create unique index if not exists valorae_dividend_events_user_event_uidx
  on public.valorae_dividend_events (user_id, event_key);
create index if not exists valorae_dividend_events_user_payment_idx
  on public.valorae_dividend_events (user_id, payment_date asc);
create index if not exists valorae_dividend_events_ticker_idx
  on public.valorae_dividend_events (ticker);
create index if not exists valorae_sync_backups_user_created_idx
  on public.valorae_sync_backups (user_id, created_at desc);
create index if not exists valorae_sync_backups_kind_idx
  on public.valorae_sync_backups (backup_kind, created_at desc);

alter table public.valorae_user_snapshots enable row level security;
alter table public.valorae_sync_clients enable row level security;
alter table public.valorae_transactions enable row level security;
alter table public.valorae_dividend_events enable row level security;
alter table public.valorae_sync_backups enable row level security;

comment on table public.valorae_transactions is 'Histórico de operações da carteira VALORAE salvo pela nuvem via Proxy.';
comment on table public.valorae_dividend_events is 'Eventos oficiais de proventos salvos pela nuvem via Proxy.';
comment on table public.valorae_sync_backups is 'Espelho/auditoria de payloads enviados pelo APK para a nuvem VALORAE.';

notify pgrst, 'reload schema';
