-- VALORAE Checkpoint 114 — estado operacional compartilhado
-- Execute uma vez no SQL Editor do mesmo projeto Supabase usado pelo Proxy.
-- A tabela é exclusiva do service_role do Proxy; o APK nunca recebe acesso direto.

begin;

create table if not exists public.valorae_runtime_shared_state (
  scope text not null,
  namespace text not null,
  state_key text not null,
  value jsonb not null default '{}'::jsonb,
  version bigint not null default 1,
  checksum text not null default '',
  owner text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null,
  primary key (scope, namespace, state_key),
  constraint valorae_runtime_shared_state_scope_check check (scope ~ '^[a-z0-9][a-z0-9._-]{0,63}$'),
  constraint valorae_runtime_shared_state_namespace_check check (namespace ~ '^[a-z0-9][a-z0-9._-]{0,79}$'),
  constraint valorae_runtime_shared_state_key_check check (char_length(state_key) between 1 and 240)
);

create index if not exists valorae_runtime_shared_state_expires_idx
  on public.valorae_runtime_shared_state (expires_at);

create index if not exists valorae_runtime_shared_state_namespace_updated_idx
  on public.valorae_runtime_shared_state (scope, namespace, updated_at desc);

alter table public.valorae_runtime_shared_state enable row level security;
revoke all on table public.valorae_runtime_shared_state from public, anon, authenticated;
grant select, insert, update, delete on table public.valorae_runtime_shared_state to service_role;

create or replace function public.valorae_shared_state_put(
  p_scope text,
  p_namespace text,
  p_state_key text,
  p_value jsonb,
  p_version bigint,
  p_checksum text,
  p_owner text,
  p_created_at timestamptz,
  p_updated_at timestamptz,
  p_expires_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_affected integer := 0;
  v_result jsonb;
begin
  insert into public.valorae_runtime_shared_state as current_state (
    scope, namespace, state_key, value, version, checksum, owner, created_at, updated_at, expires_at
  ) values (
    p_scope,
    p_namespace,
    p_state_key,
    coalesce(p_value, 'null'::jsonb),
    greatest(1, p_version),
    coalesce(p_checksum, ''),
    nullif(p_owner, ''),
    coalesce(p_created_at, now()),
    coalesce(p_updated_at, now()),
    p_expires_at
  )
  on conflict (scope, namespace, state_key) do update
    set value = excluded.value,
        version = excluded.version,
        checksum = excluded.checksum,
        owner = excluded.owner,
        updated_at = excluded.updated_at,
        expires_at = excluded.expires_at
    where current_state.version < excluded.version
       or (current_state.version = excluded.version and current_state.checksum = excluded.checksum);

  get diagnostics v_affected = row_count;

  select jsonb_build_object(
    'stored', v_affected > 0,
    'scope', state.scope,
    'namespace', state.namespace,
    'state_key', state.state_key,
    'value', state.value,
    'version', state.version,
    'checksum', state.checksum,
    'owner', state.owner,
    'created_at', state.created_at,
    'updated_at', state.updated_at,
    'expires_at', state.expires_at
  ) into v_result
  from public.valorae_runtime_shared_state state
  where state.scope = p_scope
    and state.namespace = p_namespace
    and state.state_key = p_state_key;

  return v_result;
end;
$$;

create or replace function public.valorae_shared_state_acquire_lease(
  p_scope text,
  p_namespace text,
  p_state_key text,
  p_owner text,
  p_ttl_seconds integer default 30
)
returns table(acquired boolean, owner text, expires_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_expires_at timestamptz := now() + make_interval(secs => greatest(1, least(coalesce(p_ttl_seconds, 30), 900)));
begin
  insert into public.valorae_runtime_shared_state (
    scope, namespace, state_key, value, version, checksum, owner, created_at, updated_at, expires_at
  ) values (
    p_scope,
    p_namespace,
    p_state_key,
    jsonb_build_object('lease', true),
    1,
    '',
    p_owner,
    now(),
    now(),
    v_expires_at
  )
  on conflict (scope, namespace, state_key) do update
    set owner = excluded.owner,
        value = excluded.value,
        version = public.valorae_runtime_shared_state.version + 1,
        updated_at = now(),
        expires_at = excluded.expires_at
    where public.valorae_runtime_shared_state.expires_at <= now()
       or public.valorae_runtime_shared_state.owner = excluded.owner;

  return query
  select
    (s.owner = p_owner and s.expires_at > now()) as acquired,
    s.owner,
    s.expires_at
  from public.valorae_runtime_shared_state s
  where s.scope = p_scope
    and s.namespace = p_namespace
    and s.state_key = p_state_key;
end;
$$;

create or replace function public.valorae_shared_state_release_lease(
  p_scope text,
  p_namespace text,
  p_state_key text,
  p_owner text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted integer := 0;
begin
  delete from public.valorae_runtime_shared_state
   where scope = p_scope
     and namespace = p_namespace
     and state_key = p_state_key
     and owner = p_owner;
  get diagnostics v_deleted = row_count;
  return v_deleted > 0;
end;
$$;

create or replace function public.valorae_shared_state_purge_expired(p_limit integer default 500)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted integer := 0;
begin
  with expired as (
    select scope, namespace, state_key
      from public.valorae_runtime_shared_state
     where expires_at <= now()
     order by expires_at asc
     limit greatest(1, least(coalesce(p_limit, 500), 5000))
  )
  delete from public.valorae_runtime_shared_state s
   using expired e
   where s.scope = e.scope
     and s.namespace = e.namespace
     and s.state_key = e.state_key;
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke all on function public.valorae_shared_state_put(text, text, text, jsonb, bigint, text, text, timestamptz, timestamptz, timestamptz) from public, anon, authenticated;
revoke all on function public.valorae_shared_state_acquire_lease(text, text, text, text, integer) from public, anon, authenticated;
revoke all on function public.valorae_shared_state_release_lease(text, text, text, text) from public, anon, authenticated;
revoke all on function public.valorae_shared_state_purge_expired(integer) from public, anon, authenticated;
grant execute on function public.valorae_shared_state_put(text, text, text, jsonb, bigint, text, text, timestamptz, timestamptz, timestamptz) to service_role;
grant execute on function public.valorae_shared_state_acquire_lease(text, text, text, text, integer) to service_role;
grant execute on function public.valorae_shared_state_release_lease(text, text, text, text) to service_role;
grant execute on function public.valorae_shared_state_purge_expired(integer) to service_role;

commit;
