-- Valorae Proxy Supabase sync tables.
-- Execute este arquivo no SQL Editor do Supabase antes de usar /api/sync.
-- O Proxy usa a service role key somente no Vercel/servidor; nunca coloque essa chave no APK.

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
  add column if not exists cache_scope text default 'user',
  add column if not exists cache_ttl_seconds integer,
  add column if not exists expires_at timestamptz,
  add column if not exists source_updated_at timestamptz,
  add column if not exists etag text,
  add column if not exists payload_size_bytes integer;


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

create index if not exists valorae_user_snapshots_user_idx
  on public.valorae_user_snapshots (user_id, updated_at desc);


create index if not exists valorae_user_snapshots_expires_idx
  on public.valorae_user_snapshots (user_id, domain, expires_at);

create index if not exists valorae_transactions_user_date_idx
  on public.valorae_transactions (user_id, transaction_date desc);

create index if not exists valorae_dividend_events_user_payment_idx
  on public.valorae_dividend_events (user_id, payment_date asc);

create index if not exists valorae_dividend_events_ticker_idx
  on public.valorae_dividend_events (ticker);

alter table public.valorae_user_snapshots enable row level security;
alter table public.valorae_sync_clients enable row level security;
alter table public.valorae_transactions enable row level security;
alter table public.valorae_dividend_events enable row level security;

comment on table public.valorae_user_snapshots is 'Snapshots sincronizados pelo Valorae Proxy.';
comment on table public.valorae_sync_clients is 'Dispositivos/clientes autorizados para sync via Proxy.';
comment on table public.valorae_transactions is 'Transações da carteira sincronizadas pelo Proxy.';
comment on table public.valorae_dividend_events is 'Eventos reais de proventos sincronizados pelo Proxy.';


comment on column public.valorae_user_snapshots.cache_scope is 'Escopo do cache: user, app, public ou device.';
comment on column public.valorae_user_snapshots.cache_ttl_seconds is 'Tempo de vida do snapshot em segundos.';
comment on column public.valorae_user_snapshots.expires_at is 'Data/hora em que o snapshot deixa de ser fresco para o APK.';
comment on column public.valorae_user_snapshots.source_updated_at is 'Data/hora declarada pela fonte original do payload.';
comment on column public.valorae_user_snapshots.etag is 'Assinatura ou versão lógica do payload.';
comment on column public.valorae_user_snapshots.payload_size_bytes is 'Tamanho aproximado do payload salvo.';
