-- VALORAE 2026-07-25 — parte 01/11
-- Extensão, snapshots e clientes de sincronização.

create extension if not exists pgcrypto;

create table if not exists public.valorae_user_snapshots (
  user_id text not null,
  domain text not null,
  snapshot_key text not null,
  schema_version integer not null default 3,
  app_version text,
  device_id text,
  source text,
  cache_scope text not null default 'user',
  cache_ttl_seconds integer,
  expires_at timestamptz,
  source_updated_at timestamptz,
  etag text,
  payload_size_bytes integer,
  encrypted boolean not null default false,
  payload jsonb,
  payload_ciphertext text,
  updated_at timestamptz not null default now(),
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

create unique index if not exists valorae_user_snapshots_identity_uidx
  on public.valorae_user_snapshots (user_id, domain, snapshot_key);
create index if not exists valorae_user_snapshots_user_updated_idx
  on public.valorae_user_snapshots (user_id, updated_at desc);
create index if not exists valorae_user_snapshots_user_domain_expires_idx
  on public.valorae_user_snapshots (user_id, domain, expires_at);

create table if not exists public.valorae_sync_clients (
  user_id text primary key,
  device_id text,
  client_secret_hash text,
  app_version text,
  source text,
  schema_version integer not null default 3,
  revoked boolean not null default false,
  last_seen_at timestamptz not null default now()
);

alter table public.valorae_sync_clients
  add column if not exists device_id text,
  add column if not exists client_secret_hash text,
  add column if not exists app_version text,
  add column if not exists source text,
  add column if not exists schema_version integer default 3,
  add column if not exists revoked boolean default false,
  add column if not exists last_seen_at timestamptz default now();

create unique index if not exists valorae_sync_clients_user_uidx
  on public.valorae_sync_clients (user_id);
create index if not exists valorae_sync_clients_last_seen_idx
  on public.valorae_sync_clients (last_seen_at desc);
