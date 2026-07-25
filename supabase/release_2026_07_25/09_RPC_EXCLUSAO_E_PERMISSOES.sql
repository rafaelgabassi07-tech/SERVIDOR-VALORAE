-- VALORAE 2026-07-25 — parte 09/11
-- Exclusão controlada, RLS e permissões exclusivamente para service_role.

create or replace function public.valorae_sync_delete_user_data(
  p_user_id text,
  p_expected_revision bigint,
  p_expected_deletion_generation bigint,
  p_expected_tombstone boolean,
  p_reason text default 'portfolio_cleared'
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_state public.valorae_sync_user_state%rowtype;
  v_snapshots integer := 0;
  v_transactions integer := 0;
  v_dividends integer := 0;
  v_backups integer := 0;
begin
  v_state := public.valorae_sync_assert_state(
    p_user_id, p_expected_revision, p_expected_deletion_generation,
    p_expected_tombstone, false, null
  );

  delete from public.valorae_user_snapshots where user_id = p_user_id;
  get diagnostics v_snapshots = row_count;
  delete from public.valorae_transactions where user_id = p_user_id;
  get diagnostics v_transactions = row_count;
  delete from public.valorae_dividend_events where user_id = p_user_id;
  get diagnostics v_dividends = row_count;
  delete from public.valorae_sync_backups where user_id = p_user_id;
  get diagnostics v_backups = row_count;

  update public.valorae_sync_user_state
     set revision = revision + 1,
         deletion_generation = deletion_generation + 1,
         tombstone = true,
         deleted_at = now(),
         updated_at = now()
   where user_id = p_user_id
   returning * into v_state;

  return jsonb_build_object(
    'ok', true, 'deleted', true, 'reason', p_reason,
    'deleted_counts', jsonb_build_object(
      'snapshots', v_snapshots,
      'transactions', v_transactions,
      'dividends', v_dividends,
      'backups', v_backups
    ),
    'revision', v_state.revision,
    'deletion_generation', v_state.deletion_generation,
    'tombstone', v_state.tombstone,
    'deleted_at', v_state.deleted_at
  );
end;
$$;

alter table public.valorae_user_snapshots enable row level security;
alter table public.valorae_sync_clients enable row level security;
alter table public.valorae_transactions enable row level security;
alter table public.valorae_dividend_events enable row level security;
alter table public.valorae_sync_backups enable row level security;
alter table public.valorae_sync_user_state enable row level security;

revoke all on table public.valorae_user_snapshots from public, anon, authenticated;
revoke all on table public.valorae_sync_clients from public, anon, authenticated;
revoke all on table public.valorae_transactions from public, anon, authenticated;
revoke all on table public.valorae_dividend_events from public, anon, authenticated;
revoke all on table public.valorae_sync_backups from public, anon, authenticated;
revoke all on table public.valorae_sync_user_state from public, anon, authenticated;

grant select, insert, update, delete on table public.valorae_user_snapshots to service_role;
grant select, insert, update, delete on table public.valorae_sync_clients to service_role;
grant select, insert, update, delete on table public.valorae_transactions to service_role;
grant select, insert, update, delete on table public.valorae_dividend_events to service_role;
grant select, insert, update, delete on table public.valorae_sync_backups to service_role;
grant select, insert, update, delete on table public.valorae_sync_user_state to service_role;

revoke all on function public.valorae_normalize_client_tx_id(text,text) from public, anon, authenticated;
revoke all on function public.valorae_sync_get_state(text) from public, anon, authenticated;
revoke all on function public.valorae_sync_assert_state(text,bigint,bigint,boolean,boolean,timestamptz) from public, anon, authenticated;
revoke all on function public.valorae_sync_upsert_transactions(text,jsonb,bigint,bigint,boolean,timestamptz,boolean,jsonb) from public, anon, authenticated;
revoke all on function public.valorae_sync_replace_transactions(text,text[],jsonb,bigint,bigint,boolean,timestamptz,boolean,text,jsonb) from public, anon, authenticated;
revoke all on function public.valorae_sync_upsert_snapshots(text,jsonb,bigint,bigint,boolean,timestamptz,boolean,jsonb) from public, anon, authenticated;
revoke all on function public.valorae_sync_upsert_dividends(text,jsonb,bigint,bigint,boolean,timestamptz,boolean,jsonb) from public, anon, authenticated;
revoke all on function public.valorae_sync_delete_user_data(text,bigint,bigint,boolean,text) from public, anon, authenticated;

grant execute on function public.valorae_sync_get_state(text) to service_role;
grant execute on function public.valorae_sync_upsert_transactions(text,jsonb,bigint,bigint,boolean,timestamptz,boolean,jsonb) to service_role;
grant execute on function public.valorae_sync_replace_transactions(text,text[],jsonb,bigint,bigint,boolean,timestamptz,boolean,text,jsonb) to service_role;
grant execute on function public.valorae_sync_upsert_snapshots(text,jsonb,bigint,bigint,boolean,timestamptz,boolean,jsonb) to service_role;
grant execute on function public.valorae_sync_upsert_dividends(text,jsonb,bigint,bigint,boolean,timestamptz,boolean,jsonb) to service_role;
grant execute on function public.valorae_sync_delete_user_data(text,bigint,bigint,boolean,text) to service_role;
