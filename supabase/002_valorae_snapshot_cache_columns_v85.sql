-- Valorae Proxy v85 — correção de schema cache para snapshots.
-- Execute este arquivo no SQL Editor do Supabase se aparecer:
-- "Could not find the 'cache_scope' column of 'valorae_user_snapshots' in the schema cache".

alter table public.valorae_user_snapshots
  add column if not exists cache_scope text default 'user',
  add column if not exists cache_ttl_seconds integer,
  add column if not exists expires_at timestamptz,
  add column if not exists source_updated_at timestamptz,
  add column if not exists etag text,
  add column if not exists payload_size_bytes integer;

create index if not exists valorae_user_snapshots_expires_idx
  on public.valorae_user_snapshots (user_id, domain, expires_at);

comment on column public.valorae_user_snapshots.cache_scope is 'Escopo do cache: user, app, public ou device.';
comment on column public.valorae_user_snapshots.cache_ttl_seconds is 'Tempo de vida do snapshot em segundos.';
comment on column public.valorae_user_snapshots.expires_at is 'Data/hora em que o snapshot deixa de ser fresco para o APK.';
comment on column public.valorae_user_snapshots.source_updated_at is 'Data/hora declarada pela fonte original do payload.';
comment on column public.valorae_user_snapshots.etag is 'Assinatura ou versão lógica do payload.';
comment on column public.valorae_user_snapshots.payload_size_bytes is 'Tamanho aproximado do payload salvo.';

-- Pede ao PostgREST do Supabase para recarregar o schema cache.
-- Em projetos Supabase hospedados, isso costuma resolver o erro imediatamente após o ALTER TABLE.
notify pgrst, 'reload schema';
