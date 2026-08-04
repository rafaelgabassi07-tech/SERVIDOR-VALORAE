-- VALORAE — 03/03 BLOQUEIO DE LEGADO E VERIFICAÇÃO
-- Execute por último. Instala download/status/exclusão, migra dados válidos, bloqueia RPCs/tabelas antigas e verifica o contrato mínimo.

create or replace function public.valorae_financial_download_v2(p_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_transactions jsonb;
  v_dividends jsonb;
  v_transactions_updated timestamptz;
  v_dividends_updated timestamptz;
begin
  if p_user_id is null then raise exception using errcode = '22023', message = 'INVALID_USER_ID'; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
      'clientTxId', t.client_tx_id,
      'date', to_char(t.transaction_date, 'YYYY-MM-DD'),
      'operation', t.operation,
      'symbol', t.symbol,
      'assetType', t.asset_type,
      'quantity', t.quantity,
      'price', t.price,
      'grossValue', t.gross_value,
      'source', t.source,
      'importedAt', case when t.imported_at is null then null else floor(extract(epoch from t.imported_at) * 1000)::bigint end
    ) order by t.transaction_date, t.client_tx_id), '[]'::jsonb), max(t.updated_at)
    into v_transactions, v_transactions_updated
    from public.valorae_financial_transactions t
   where t.user_id = p_user_id;

  select coalesce(jsonb_agg(jsonb_build_object(
      'eventId', d.event_id,
      'ticker', d.ticker,
      'dateCom', coalesce(to_char(d.date_com, 'YYYY-MM-DD'), ''),
      'exDate', coalesce(to_char(d.ex_date, 'YYYY-MM-DD'), ''),
      'inferredComDate', coalesce(to_char(d.inferred_com_date, 'YYYY-MM-DD'), ''),
      'eligibilityDateSource', coalesce(d.eligibility_date_source, ''),
      'paymentDate', coalesce(to_char(d.payment_date, 'YYYY-MM-DD'), ''),
      'valuePerShare', d.value_per_share,
      'quantity', d.quantity,
      'estimatedAmount', d.estimated_amount,
      'status', d.status,
      'source', d.source
    ) order by d.payment_date nulls last, d.ticker, d.event_id), '[]'::jsonb), max(d.updated_at)
    into v_dividends, v_dividends_updated
    from public.valorae_financial_dividends d
   where d.user_id = p_user_id;

  return jsonb_build_object(
    'ok', true,
    'contract', 'valorae-financial-sync-v2',
    'transactions', v_transactions,
    'dividends', v_dividends,
    'transactions_count', jsonb_array_length(v_transactions),
    'dividends_count', jsonb_array_length(v_dividends),
    'transactions_version', coalesce(floor(extract(epoch from v_transactions_updated) * 1000)::bigint, 0),
    'dividends_version', coalesce(floor(extract(epoch from v_dividends_updated) * 1000)::bigint, 0),
    'updated_at', greatest(v_transactions_updated, v_dividends_updated)
  );
end;
$$;

create or replace function public.valorae_financial_status_v2(p_user_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with tx as (
    select count(*)::bigint n, max(updated_at) u
      from public.valorae_financial_transactions
     where user_id = p_user_id
  ), dv as (
    select count(*)::bigint n, max(updated_at) u
      from public.valorae_financial_dividends
     where user_id = p_user_id
  )
  select jsonb_build_object(
    'ok', true,
    'contract', 'valorae-financial-sync-v2',
    'transactions_count', tx.n,
    'dividends_count', dv.n,
    'transactions_version', coalesce(floor(extract(epoch from tx.u) * 1000)::bigint, 0),
    'dividends_version', coalesce(floor(extract(epoch from dv.u) * 1000)::bigint, 0),
    'updated_at', greatest(tx.u, dv.u)
  ) from tx cross join dv;
$$;

create or replace function public.valorae_financial_delete_v2(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_transactions integer := 0;
  v_dividends integer := 0;
begin
  if p_user_id is null then raise exception using errcode = '22023', message = 'INVALID_USER_ID'; end if;
  delete from public.valorae_financial_transactions where user_id = p_user_id;
  get diagnostics v_transactions = row_count;
  delete from public.valorae_financial_dividends where user_id = p_user_id;
  get diagnostics v_dividends = row_count;
  return jsonb_build_object(
    'ok', true,
    'contract', 'valorae-financial-sync-v2',
    'transactions_deleted', v_transactions,
    'dividends_deleted', v_dividends,
    'count', v_transactions + v_dividends,
    'transactions_version', 0,
    'dividends_version', 0,
    'updated_at', now()
  );
end;
$$;

revoke all on function public.valorae_financial_download_v2(uuid) from public, anon, authenticated;
revoke all on function public.valorae_financial_status_v2(uuid) from public, anon, authenticated;
revoke all on function public.valorae_financial_delete_v2(uuid) from public, anon, authenticated;
grant execute on function public.valorae_financial_download_v2(uuid) to service_role;
grant execute on function public.valorae_financial_status_v2(uuid) to service_role;
grant execute on function public.valorae_financial_delete_v2(uuid) to service_role;

-- Migração única do legado. A leitura usa to_jsonb(row), portanto tolera versões antigas
-- com colunas diferentes sem abortar a instalação inteira. O UUID atual é aceito
-- diretamente; uma identidade antiga por e-mail é associada ao auth.users.id.
do $$
begin
  if to_regclass('public.valorae_transactions') is not null then
    execute $migrate_transactions$
      with raw as (
        select to_jsonb(t) as r
        from public.valorae_transactions t
      ), resolved as (
        select
          r,
          nullif(trim(r->>'user_id'), '') as legacy_identity,
          coalesce(u_uuid.id, u_email.id) as resolved_user_id
        from raw
        left join auth.users u_email
          on lower(u_email.email) = lower(nullif(trim(raw.r->>'user_id'), ''))
        left join auth.users u_uuid
          on u_uuid.id = case
            when nullif(trim(raw.r->>'user_id'), '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
              then (raw.r->>'user_id')::uuid
            else null
          end
      ), normalized as (
        select
          resolved_user_id as user_id,
          public.valorae_financial_normalize_id_v2(
            coalesce(r->>'client_tx_id', r->>'clientTxId', r->>'id'),
            concat_ws('|', legacy_identity, r->>'ticker', r->>'symbol', r->>'transaction_date', (r->'payload')->>'date', r->>'quantity', r->>'purchase_price')
          ) as client_tx_id,
          public.valorae_financial_safe_date_v2(coalesce((r->'payload')->>'date', r->>'transaction_date')) as transaction_date,
          upper(coalesce(
            nullif((r->'payload')->>'operation', ''),
            nullif(r->>'operation', ''),
            case when lower(coalesce(r->>'is_sell', 'false')) in ('true','t','1','yes') then 'VENDA' else 'COMPRA' end
          )) as operation,
          upper(coalesce(nullif((r->'payload')->>'symbol', ''), nullif(r->>'symbol', ''), nullif(r->>'ticker', ''))) as symbol,
          coalesce(nullif((r->'payload')->>'asset_type', ''), nullif((r->'payload')->>'assetType', ''), nullif(r->>'asset_type', ''), 'Outro') as asset_type,
          greatest(public.valorae_financial_safe_numeric_v2(coalesce((r->'payload')->>'quantity', r->>'quantity'), 0), 0) as quantity,
          greatest(public.valorae_financial_safe_numeric_v2(coalesce((r->'payload')->>'price', r->>'purchase_price', r->>'price'), 0), 0) as price,
          greatest(public.valorae_financial_safe_numeric_v2(coalesce((r->'payload')->>'gross_value', (r->'payload')->>'grossValue', r->>'gross_value'), 0), 0) as gross_value,
          coalesce(nullif((r->'payload')->>'source', ''), nullif(r->>'source', ''), 'Migração legado') as source,
          coalesce(
            public.valorae_financial_safe_timestamp_v2(coalesce((r->'payload')->>'imported_at', (r->'payload')->>'importedAt', r->>'imported_at')),
            public.valorae_financial_safe_timestamp_v2(r->>'updated_at')
          ) as imported_at,
          coalesce(public.valorae_financial_safe_timestamp_v2(r->>'updated_at'), now()) as updated_at
        from resolved
        where resolved_user_id is not null
      )
      insert into public.valorae_financial_transactions(
        user_id, client_tx_id, transaction_date, operation, symbol, asset_type,
        quantity, price, gross_value, source, imported_at, updated_at
      )
      select
        user_id, client_tx_id, transaction_date, operation, symbol, asset_type,
        quantity, price,
        case when gross_value > 0 then gross_value else quantity * price end,
        source, imported_at, updated_at
      from normalized
      where transaction_date is not null
        and nullif(symbol, '') is not null
        and (quantity > 0 or gross_value > 0 or quantity * price > 0)
      on conflict (user_id, client_tx_id) do update set
        transaction_date = excluded.transaction_date,
        operation = excluded.operation,
        symbol = excluded.symbol,
        asset_type = excluded.asset_type,
        quantity = excluded.quantity,
        price = excluded.price,
        gross_value = excluded.gross_value,
        source = excluded.source,
        imported_at = excluded.imported_at,
        updated_at = greatest(public.valorae_financial_transactions.updated_at, excluded.updated_at)
      where excluded.updated_at >= public.valorae_financial_transactions.updated_at
    $migrate_transactions$;
  end if;
end $$;

do $$
begin
  if to_regclass('public.valorae_dividend_events') is not null then
    execute $migrate_dividends$
      with raw as (
        select to_jsonb(d) as r
        from public.valorae_dividend_events d
      ), resolved as (
        select
          r,
          nullif(trim(r->>'user_id'), '') as legacy_identity,
          coalesce(u_uuid.id, u_email.id) as resolved_user_id
        from raw
        left join auth.users u_email
          on lower(u_email.email) = lower(nullif(trim(raw.r->>'user_id'), ''))
        left join auth.users u_uuid
          on u_uuid.id = case
            when nullif(trim(raw.r->>'user_id'), '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
              then (raw.r->>'user_id')::uuid
            else null
          end
      ), normalized as (
        select
          resolved_user_id as user_id,
          public.valorae_financial_normalize_id_v2(
            coalesce(r->>'event_id', r->>'event_key', r->>'eventId', r->>'id'),
            concat_ws('|', legacy_identity, r->>'ticker', (r->'payload')->>'ticker', r->>'date_com', r->>'payment_date', r->>'source')
          ) as event_id,
          upper(coalesce(nullif((r->'payload')->>'ticker', ''), nullif((r->'payload')->>'symbol', ''), nullif(r->>'ticker', ''))) as ticker,
          public.valorae_financial_safe_date_v2(coalesce((r->'payload')->>'dateCom', (r->'payload')->>'date_com', r->>'date_com')) as date_com,
          public.valorae_financial_safe_date_v2(coalesce((r->'payload')->>'exDate', (r->'payload')->>'ex_date', r->>'ex_date')) as ex_date,
          public.valorae_financial_safe_date_v2(coalesce((r->'payload')->>'inferredComDate', (r->'payload')->>'inferred_com_date', r->>'inferred_com_date')) as inferred_com_date,
          coalesce((r->'payload')->>'eligibilityDateSource', (r->'payload')->>'eligibility_date_source', r->>'eligibility_date_source') as eligibility_date_source,
          public.valorae_financial_safe_date_v2(coalesce((r->'payload')->>'paymentDate', (r->'payload')->>'payment_date', r->>'payment_date')) as payment_date,
          greatest(public.valorae_financial_safe_numeric_v2(coalesce((r->'payload')->>'valuePerShare', (r->'payload')->>'value_per_share', r->>'value_per_share'), 0), 0) as value_per_share,
          greatest(public.valorae_financial_safe_numeric_v2(coalesce((r->'payload')->>'quantity', r->>'quantity'), 0), 0) as quantity,
          greatest(public.valorae_financial_safe_numeric_v2(coalesce((r->'payload')->>'estimatedAmount', (r->'payload')->>'estimated_amount', r->>'estimated_amount'), 0), 0) as estimated_amount,
          coalesce(nullif((r->'payload')->>'status', ''), nullif(r->>'status', ''), 'oficial') as status,
          coalesce(nullif((r->'payload')->>'source', ''), nullif(r->>'source', ''), 'Migração legado') as source,
          coalesce(public.valorae_financial_safe_timestamp_v2(r->>'updated_at'), now()) as updated_at
        from resolved
        where resolved_user_id is not null
      )
      insert into public.valorae_financial_dividends(
        user_id, event_id, ticker, date_com, ex_date, inferred_com_date,
        eligibility_date_source, payment_date, value_per_share, quantity,
        estimated_amount, status, source, updated_at
      )
      select
        user_id, event_id, ticker, date_com, ex_date, inferred_com_date,
        eligibility_date_source, payment_date, value_per_share, quantity,
        estimated_amount, status, source, updated_at
      from normalized
      where nullif(ticker, '') is not null
        and coalesce(date_com, ex_date, inferred_com_date, payment_date) is not null
      on conflict (user_id, event_id) do update set
        ticker = excluded.ticker,
        date_com = excluded.date_com,
        ex_date = excluded.ex_date,
        inferred_com_date = excluded.inferred_com_date,
        eligibility_date_source = excluded.eligibility_date_source,
        payment_date = excluded.payment_date,
        value_per_share = excluded.value_per_share,
        quantity = excluded.quantity,
        estimated_amount = excluded.estimated_amount,
        status = excluded.status,
        source = excluded.source,
        updated_at = greatest(public.valorae_financial_dividends.updated_at, excluded.updated_at)
      where excluded.updated_at >= public.valorae_financial_dividends.updated_at
    $migrate_dividends$;
  end if;
end $$;


-- Bloqueia toda execução das RPCs do fluxo antigo. As tabelas legadas permanecem somente para
-- conferência e rollback durante a transição.
do $$
declare
  fn regprocedure;
begin
  for fn in
    select p.oid::regprocedure
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname like 'valorae_sync_%'
  loop
    execute format('revoke execute on function %s from public, anon, authenticated, service_role', fn);
  end loop;
end $$;

-- Remove acesso operacional às tabelas do contrato antigo. Os dados permanecem no banco
-- como backup de transição, mas nenhum deployment antigo deve continuar consultando-os.
do $$
declare
  legacy_table text;
begin
  foreach legacy_table in array array[
    'valorae_transactions',
    'valorae_dividend_events',
    'valorae_sync_user_state',
    'valorae_user_snapshots',
    'valorae_sync_backups',
    'valorae_sync_clients',
    'valorae_monitor_events',
    'valorae_runtime_shared_state',
    'valorae_financial_state'
  ]
  loop
    if to_regclass('public.' || legacy_table) is not null then
      execute format('revoke all on table public.%I from public, anon, authenticated, service_role', legacy_table);
    end if;
  end loop;
end $$;

comment on table public.valorae_financial_transactions is 'Histórico financeiro mínimo do VALORAE. Sem payload JSON duplicado.';
comment on table public.valorae_financial_dividends is 'Histórico e agenda mínima de dividendos do VALORAE.';
comment on function public.valorae_financial_download_v2(uuid) is 'Baixa transações e dividendos em uma única consulta indexada, sem paginação entre APK e Proxy.';

notify pgrst, 'reload schema';

-- Confirmação visível no SQL Editor.
select
  'valorae-financial-sync-v2'::text as contract,
  (select count(*) from public.valorae_financial_transactions) as transactions_migrated,
  (select count(*) from public.valorae_financial_dividends) as dividends_migrated,
  (select count(distinct user_id) from (
    select user_id from public.valorae_financial_transactions
    union all
    select user_id from public.valorae_financial_dividends
  ) financial_users) as users_with_financial_data;
