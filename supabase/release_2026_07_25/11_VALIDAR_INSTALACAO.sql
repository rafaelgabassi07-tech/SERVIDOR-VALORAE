-- VALORAE 2026-07-25 — parte 11/11
-- Validação final. Não altera dados financeiros.

do $$
declare
  v_missing text[] := array[]::text[];
  v_name text;
  v_date_type text;
begin
  foreach v_name in array array[
    'public.valorae_user_snapshots',
    'public.valorae_sync_clients',
    'public.valorae_transactions',
    'public.valorae_dividend_events',
    'public.valorae_sync_backups',
    'public.valorae_sync_user_state'
  ] loop
    if to_regclass(v_name) is null then
      v_missing := array_append(v_missing, v_name);
    end if;
  end loop;

  foreach v_name in array array[
    'public.valorae_normalize_client_tx_id(text,text)',
    'public.valorae_sync_get_state(text)',
    'public.valorae_sync_assert_state(text,bigint,bigint,boolean,boolean,timestamp with time zone)',
    'public.valorae_sync_upsert_transactions(text,jsonb,bigint,bigint,boolean,timestamp with time zone,boolean,jsonb)',
    'public.valorae_sync_replace_transactions(text,text[],jsonb,bigint,bigint,boolean,timestamp with time zone,boolean,text,jsonb)',
    'public.valorae_sync_upsert_snapshots(text,jsonb,bigint,bigint,boolean,timestamp with time zone,boolean,jsonb)',
    'public.valorae_sync_upsert_dividends(text,jsonb,bigint,bigint,boolean,timestamp with time zone,boolean,jsonb)',
    'public.valorae_sync_delete_user_data(text,bigint,bigint,boolean,text)'
  ] loop
    if to_regprocedure(v_name) is null then
      v_missing := array_append(v_missing, v_name);
    end if;
  end loop;

  select data_type into v_date_type
    from information_schema.columns
   where table_schema = 'public'
     and table_name = 'valorae_transactions'
     and column_name = 'transaction_date';
  if v_date_type is distinct from 'timestamp with time zone' then
    v_missing := array_append(v_missing, 'valorae_transactions.transaction_date:timestamptz');
  end if;

  if cardinality(v_missing) > 0 then
    raise exception 'VALORAE_SCHEMA_INCOMPLETO: %', array_to_string(v_missing, ', ');
  end if;

  raise notice 'VALORAE_SCHEMA_OK_2026_07_25';
end $$;

select
  'VALORAE_SCHEMA_OK_2026_07_25' as status,
  current_database() as database_name,
  now() as checked_at,
  (select count(*) from public.valorae_user_snapshots) as snapshots,
  (select count(*) from public.valorae_transactions) as transactions,
  (select count(*) from public.valorae_dividend_events) as dividend_events,
  (select count(*) from public.valorae_sync_backups) as retained_backups,
  (to_regclass('public.valorae_monitor_events') is not null) as monitor_table_present,
  (to_regclass('public.valorae_runtime_shared_state') is not null) as shared_state_table_present;
