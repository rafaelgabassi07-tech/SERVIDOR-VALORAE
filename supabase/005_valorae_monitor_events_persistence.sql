-- VALORAE — persistência do histórico do Proxy Monitor
-- Execute uma vez no SQL Editor do mesmo projeto Supabase usado pelo Proxy.
-- O APK e o frontend nunca recebem a service_role; somente o Proxy acessa esta tabela.

begin;

create table if not exists public.valorae_monitor_events (
  event_key text primary key,
  scope text not null default 'production',
  instance_id text not null,
  event_seq bigint null,
  release_patch text not null default '',
  occurred_at timestamptz not null,
  route text not null,
  method text not null default 'GET',
  status integer null,
  latency_ms integer null,
  bytes_out bigint not null default 0,
  event jsonb not null,
  created_at timestamptz not null default now(),
  constraint valorae_monitor_events_key_length check (char_length(event_key) between 3 and 220),
  constraint valorae_monitor_events_scope_check check (scope ~ '^[a-z0-9][a-z0-9._-]{0,63}$'),
  constraint valorae_monitor_events_method_check check (char_length(method) between 1 and 12),
  constraint valorae_monitor_events_status_check check (status is null or status between 0 and 599),
  constraint valorae_monitor_events_latency_check check (latency_ms is null or latency_ms >= 0),
  constraint valorae_monitor_events_bytes_check check (bytes_out >= 0)
);

create index if not exists valorae_monitor_events_scope_time_idx
  on public.valorae_monitor_events (scope, occurred_at desc);

create index if not exists valorae_monitor_events_scope_route_time_idx
  on public.valorae_monitor_events (scope, route, occurred_at desc);

create index if not exists valorae_monitor_events_scope_status_time_idx
  on public.valorae_monitor_events (scope, status, occurred_at desc);

alter table public.valorae_monitor_events enable row level security;
revoke all on table public.valorae_monitor_events from public, anon, authenticated;
grant select, insert, update, delete on table public.valorae_monitor_events to service_role;

-- Limpeza manual opcional. Nada é apagado automaticamente.
create or replace function public.valorae_monitor_purge_events(
  p_scope text default 'production',
  p_before timestamptz default now() - interval '90 days',
  p_limit integer default 5000
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted integer := 0;
begin
  with targets as (
    select event_key
      from public.valorae_monitor_events
     where scope = p_scope
       and occurred_at < p_before
     order by occurred_at asc
     limit greatest(1, least(coalesce(p_limit, 5000), 50000))
  )
  delete from public.valorae_monitor_events events
   using targets
   where events.event_key = targets.event_key;

  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke all on function public.valorae_monitor_purge_events(text, timestamptz, integer) from public, anon, authenticated;
grant execute on function public.valorae_monitor_purge_events(text, timestamptz, integer) to service_role;

notify pgrst, 'reload schema';
commit;
