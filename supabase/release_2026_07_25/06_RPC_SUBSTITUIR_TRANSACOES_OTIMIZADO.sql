-- VALORAE 2026-07-25 — parte 06/11
-- Substituição diferencial: remove somente o que saiu e atualiza somente o que mudou.

create or replace function public.valorae_sync_replace_transactions(
  p_user_id text,
  p_symbols text[],
  p_rows jsonb,
  p_expected_revision bigint,
  p_expected_deletion_generation bigint,
  p_expected_tombstone boolean,
  p_action_created_at timestamptz default null,
  p_clear_tombstone boolean default false,
  p_reason text default 'replace_transactions_for_symbols',
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
  v_deleted integer := 0;
  v_state_changed boolean := false;
begin
  v_state := public.valorae_sync_assert_state(
    p_user_id, p_expected_revision, p_expected_deletion_generation,
    p_expected_tombstone, p_clear_tombstone, p_action_created_at
  );

  delete from public.valorae_transactions t
   where t.user_id = p_user_id
     and t.ticker = any(coalesce(p_symbols, array[]::text[]))
     and not exists (
       select 1
         from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) r
        where r->>'ticker' = any(coalesce(p_symbols, array[]::text[]))
          and public.valorae_normalize_client_tx_id(
                r->>'client_tx_id',
                concat_ws('|', p_user_id, r->>'ticker', r->>'transaction_date', r->>'quantity', r->>'purchase_price')
              ) = t.client_tx_id
     );
  get diagnostics v_deleted = row_count;

  insert into public.valorae_transactions(
    user_id, client_tx_id, ticker, name, quantity, purchase_price, transaction_date,
    asset_type, is_sell, broker, sector, notes, payload, updated_at
  )
  select p_user_id,
         public.valorae_normalize_client_tx_id(
           r->>'client_tx_id',
           concat_ws('|', p_user_id, r->>'ticker', r->>'transaction_date', r->>'quantity', r->>'purchase_price')
         ),
         r->>'ticker', r->>'name',
         coalesce((r->>'quantity')::numeric, 0),
         coalesce((r->>'purchase_price')::numeric, 0),
         nullif(r->>'transaction_date', '')::timestamptz,
         r->>'asset_type', coalesce((r->>'is_sell')::boolean, false),
         r->>'broker', r->>'sector', r->>'notes',
         coalesce(r->'payload', '{}'::jsonb), now()
    from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) r
   where r->>'ticker' = any(coalesce(p_symbols, array[]::text[]))
  on conflict (user_id, client_tx_id) do update set
    ticker = excluded.ticker,
    name = excluded.name,
    quantity = excluded.quantity,
    purchase_price = excluded.purchase_price,
    transaction_date = excluded.transaction_date,
    asset_type = excluded.asset_type,
    is_sell = excluded.is_sell,
    broker = excluded.broker,
    sector = excluded.sector,
    notes = excluded.notes,
    payload = excluded.payload,
    updated_at = now()
  where row(
    valorae_transactions.ticker, valorae_transactions.name,
    valorae_transactions.quantity, valorae_transactions.purchase_price,
    valorae_transactions.transaction_date, valorae_transactions.asset_type,
    valorae_transactions.is_sell, valorae_transactions.broker,
    valorae_transactions.sector, valorae_transactions.notes,
    valorae_transactions.payload
  ) is distinct from row(
    excluded.ticker, excluded.name, excluded.quantity, excluded.purchase_price,
    excluded.transaction_date, excluded.asset_type, excluded.is_sell,
    excluded.broker, excluded.sector, excluded.notes, excluded.payload
  );
  get diagnostics v_count = row_count;

  v_state_changed := (v_count + v_deleted) > 0 or (p_clear_tombstone and v_state.tombstone);
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
    'ok', true, 'count', v_count, 'deleted', v_deleted,
    'changed', v_state_changed, 'reason', p_reason,
    'revision', v_state.revision,
    'deletion_generation', v_state.deletion_generation,
    'tombstone', v_state.tombstone,
    'backup_ignored', p_backup is not null
  );
end;
$$;
