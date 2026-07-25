-- VALORAE 2026-07-25 — parte 02/11
-- Tabelas financeiras, backup compatível e revisão por usuário.

create table if not exists public.valorae_transactions (
  user_id text not null,
  client_tx_id text not null,
  ticker text,
  name text,
  quantity numeric,
  purchase_price numeric,
  transaction_date timestamptz,
  asset_type text,
  is_sell boolean not null default false,
  broker text,
  sector text,
  notes text,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, client_tx_id)
);

alter table public.valorae_transactions
  add column if not exists client_tx_id text,
  add column if not exists ticker text,
  add column if not exists name text,
  add column if not exists quantity numeric,
  add column if not exists purchase_price numeric,
  add column if not exists transaction_date timestamptz,
  add column if not exists asset_type text,
  add column if not exists is_sell boolean default false,
  add column if not exists broker text,
  add column if not exists sector text,
  add column if not exists notes text,
  add column if not exists payload jsonb default '{}'::jsonb,
  add column if not exists updated_at timestamptz default now();

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
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
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
  add column if not exists payload jsonb default '{}'::jsonb,
  add column if not exists updated_at timestamptz default now();

create table if not exists public.valorae_sync_backups (
  backup_id uuid primary key default gen_random_uuid(),
  user_id text not null,
  backup_kind text not null default 'sync_event',
  source text not null default 'valorae-proxy',
  payload jsonb not null default '{}'::jsonb,
  payload_size_bytes integer,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
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

create table if not exists public.valorae_sync_user_state (
  user_id text primary key,
  revision bigint not null default 0 check (revision >= 0),
  deletion_generation bigint not null default 0 check (deletion_generation >= 0),
  tombstone boolean not null default false,
  deleted_at timestamptz,
  updated_at timestamptz not null default now()
);

create unique index if not exists valorae_transactions_user_client_tx_uidx
  on public.valorae_transactions (user_id, client_tx_id);
create unique index if not exists valorae_dividend_events_user_event_uidx
  on public.valorae_dividend_events (user_id, event_key);
create unique index if not exists valorae_sync_backups_backup_uidx
  on public.valorae_sync_backups (backup_id);
