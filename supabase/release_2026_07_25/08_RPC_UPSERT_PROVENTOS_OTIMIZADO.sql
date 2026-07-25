-- VALORAE 2026-07-25 — parte 08/11
-- Proventos: atualização somente quando algum campo realmente mudou.

create or replace function public.valorae_sync_upsert_dividends(
  p_user_id text,
  p_rows jsonb,
  p_expected_revision bigint,
  p_expected_deletion_generation bigint,
  p_expected_tombstone boolean,
  p_action_created_at timestamptz default null,
  p_clear_tombstone boolean default false,
  p_backup jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_state public.valorae_sync_user_state%rowtype;
  v_count integer := 0;
  v_state_changed boolean := false;
begin
  v_state := public.valorae_sync_assert_state(
    p_user_id, p_expected_revision, p_expected_deletion_generation,
    p_expected_tombstone, p_clear_tombstone, p_action_created_at
  );

  insert into public.valorae_dividend_events(
    user_id, event_key, ticker, date_com, payment_date, value_per_share,
    quantity, estimated_amount, status, category, source, payload, updated_at
  )
  select p_user_id, r->>'event_key', r->>'ticker', r->>'date_com', r->>'payment_date',
         coalesce((r->>'value_per_share')::numeric, 0),
         coalesce((r->>'quantity')::numeric, 0),
         coalesce((r->>'estimated_amount')::numeric, 0),
         r->>'status', r->>'category', r->>'source',
         coalesce(r->'payload', '{}'::jsonb), now()
    from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) r
   where nullif(r->>'event_key', '') is not null
     and nullif(r->>'ticker', '') is not null
  on conflict (user_id, event_key) do update set
    ticker = excluded.ticker,
    date_com = excluded.date_com,
    payment_date = excluded.payment_date,
    value_per_share = excluded.value_per_share,
    quantity = excluded.quantity,
    estimated_amount = excluded.estimated_amount,
    status = excluded.status,
    category = excluded.category,
    source = excluded.source,
    payload = excluded.payload,
    updated_at = now()
  where row(
    valorae_dividend_events.ticker, valorae_dividend_events.date_com,
    valorae_dividend_events.payment_date, valorae_dividend_events.value_per_share,
    valorae_dividend_events.quantity, valorae_dividend_events.estimated_amount,
    valorae_dividend_events.status, valorae_dividend_events.category,
    valorae_dividend_events.source, valorae_dividend_events.payload
  ) is distinct from row(
    excluded.ticker, excluded.date_com, excluded.payment_date,
    excluded.value_per_share, excluded.quantity, excluded.estimated_amount,
    excluded.status, excluded.category, excluded.source, excluded.payload
  );
  get diagnostics v_count = row_count;

  v_state_changed := v_count > 0 or (p_clear_tombstone and v_state.tombstone);
  if v_state_changed then
    update public.valorae_sync_user_state
       set revision = revision + 1,
           tombstone = case when p_clear_tombstone then false else tombstone end,
           deleted_at = case when p_clear_tombstone then null else deleted_at end,
           updated_at = now()
     where user_id = p_user_id
     returning * into v_state;
  end if;

  return jsonb_build_object(
    'ok', true, 'count', v_count, 'changed', v_state_changed,
    'revision', v_state.revision,
    'deletion_generation', v_state.deletion_generation,
    'tombstone', v_state.tombstone,
    'backup_ignored', p_backup is not null
  );
end;
$$;
