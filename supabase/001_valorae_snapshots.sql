-- VALORAE Supabase Snapshots v1
-- Execute no SQL Editor do Supabase antes de usar /api/sync ou o APK com Supabase direto.

create extension if not exists pgcrypto;

create table if not exists public.valorae_user_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  domain text not null,
  snapshot_key text not null,
  schema_version integer not null default 1,
  app_version text,
  device_id text,
  source text,
  encrypted boolean not null default false,
  payload jsonb,
  payload_ciphertext text,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint valorae_user_snapshots_unique unique (user_id, domain, snapshot_key),
  constraint valorae_user_snapshots_payload_check check (
    (encrypted = false and payload is not null) or
    (encrypted = true and payload_ciphertext is not null)
  )
);

create index if not exists idx_valorae_snapshots_user_domain on public.valorae_user_snapshots (user_id, domain);
create index if not exists idx_valorae_snapshots_updated_at on public.valorae_user_snapshots (updated_at desc);
create index if not exists idx_valorae_snapshots_payload_gin on public.valorae_user_snapshots using gin (payload);

alter table public.valorae_user_snapshots enable row level security;

-- Recomendado para uso via VALORAE Proxy:
-- O Proxy usa SUPABASE_SERVICE_ROLE_KEY no backend e ignora RLS com segurança do lado servidor.
-- Nesse modo, não crie políticas públicas de leitura/escrita.

-- Opcional para uso direto pelo APK com Supabase Auth futuramente:
-- 1) use auth.uid() como user_id no app;
-- 2) habilite as políticas abaixo somente quando houver login Supabase Auth.
--
-- create policy "valorae_select_own_snapshots"
-- on public.valorae_user_snapshots
-- for select
-- using (auth.uid()::text = user_id);
--
-- create policy "valorae_insert_own_snapshots"
-- on public.valorae_user_snapshots
-- for insert
-- with check (auth.uid()::text = user_id);
--
-- create policy "valorae_update_own_snapshots"
-- on public.valorae_user_snapshots
-- for update
-- using (auth.uid()::text = user_id)
-- with check (auth.uid()::text = user_id);
