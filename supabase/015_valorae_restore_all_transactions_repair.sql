-- VALORAE — reparo de integridade do Histórico financeiro v2
-- Execute depois da migration 013 e antes de publicar o Proxy/APK pareados desta entrega.
-- Não apaga transações nem dividendos. Reimporta o legado preservando compras, vendas,
-- quantidades assinadas e operações repetidas que antes podiam compartilhar o mesmo ID.

begin;

create or replace function public.valorae_financial_upload_transactions_v2(
  p_user_id uuid,
  p_rows jsonb,
  p_replace_symbols text[] default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_upserted integer := 0;
  v_deleted integer := 0;
begin
  if p_user_id is null then raise exception using errcode = '22023', message = 'INVALID_USER_ID'; end if;
  if jsonb_typeof(coalesce(p_rows, '[]'::jsonb)) <> 'array' then
    raise exception using errcode = '22023', message = 'INVALID_TRANSACTIONS_PAYLOAD';
  end if;

  if coalesce(array_length(p_replace_symbols, 1), 0) > 0 then
    with incoming as (
      select public.valorae_financial_normalize_id_v2(
               coalesce(r->>'clientTxId', r->>'client_tx_id', r->>'id'),
               concat_ws('|', p_user_id::text, r->>'symbol', r->>'ticker', r->>'date',
                         r->>'operation', r->>'quantity', r->>'price', r->>'gross_value',
                         r->>'grossValue', r->>'source', r->>'imported_at', r->>'importedAt')
             ) as client_tx_id
      from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) r
    ), symbols as (
      select distinct upper(trim(value)) as symbol
      from unnest(p_replace_symbols) value
      where nullif(trim(value), '') is not null
    )
    delete from public.valorae_financial_transactions t
     where t.user_id = p_user_id
       and t.symbol in (select symbol from symbols)
       and not exists (select 1 from incoming i where i.client_tx_id = t.client_tx_id);
    get diagnostics v_deleted = row_count;
  end if;

  with normalized as (
    select
      public.valorae_financial_normalize_id_v2(
        coalesce(r->>'clientTxId', r->>'client_tx_id', r->>'id'),
        concat_ws('|', p_user_id::text, r->>'symbol', r->>'ticker', r->>'date',
                  r->>'operation', r->>'quantity', r->>'price', r->>'gross_value',
                  r->>'grossValue', r->>'source', r->>'imported_at', r->>'importedAt')
      ) as client_tx_id,
      public.valorae_financial_safe_date_v2(coalesce(r->>'date', r->>'transaction_date')) as transaction_date,
      case
        when nullif(trim(coalesce(r->>'operation', r->>'side')), '') is not null
          then upper(trim(coalesce(r->>'operation', r->>'side')))
        when lower(coalesce(r->>'isSell', r->>'is_sell', 'false')) in ('true','t','1','yes')
          or public.valorae_financial_safe_numeric_v2(r->>'quantity', 0) < 0
          or public.valorae_financial_safe_numeric_v2(coalesce(r->>'grossValue', r->>'gross_value'), 0) < 0
          then 'VENDA'
        else 'MOVIMENTAÇÃO'
      end as operation,
      upper(coalesce(nullif(trim(r->>'symbol'), ''), nullif(trim(r->>'ticker'), ''))) as symbol,
      coalesce(nullif(trim(coalesce(r->>'assetType', r->>'asset_type')), ''), 'Outro') as asset_type,
      abs(public.valorae_financial_safe_numeric_v2(r->>'quantity', 0)) as quantity,
      abs(public.valorae_financial_safe_numeric_v2(coalesce(r->>'price', r->>'purchase_price'), 0)) as price,
      abs(public.valorae_financial_safe_numeric_v2(coalesce(r->>'grossValue', r->>'gross_value'), 0)) as gross_value,
      coalesce(nullif(trim(r->>'source'), ''), 'VALORAE') as source,
      public.valorae_financial_safe_timestamp_v2(coalesce(r->>'importedAt', r->>'imported_at')) as imported_at
    from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) r
  ), valid as (
    select * from normalized
    where transaction_date is not null
      and nullif(symbol, '') is not null
      and nullif(operation, '') is not null
  )
  insert into public.valorae_financial_transactions(
    user_id, client_tx_id, transaction_date, operation, symbol, asset_type,
    quantity, price, gross_value, source, imported_at, updated_at
  )
  select p_user_id, client_tx_id, transaction_date, operation, symbol, asset_type,
         quantity, price,
         case when gross_value > 0 then gross_value else quantity * price end,
         source, imported_at, now()
  from valid
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
    updated_at = now()
  where (public.valorae_financial_transactions.transaction_date,
         public.valorae_financial_transactions.operation,
         public.valorae_financial_transactions.symbol,
         public.valorae_financial_transactions.asset_type,
         public.valorae_financial_transactions.quantity,
         public.valorae_financial_transactions.price,
         public.valorae_financial_transactions.gross_value,
         public.valorae_financial_transactions.source,
         public.valorae_financial_transactions.imported_at)
        is distinct from
        (excluded.transaction_date, excluded.operation, excluded.symbol, excluded.asset_type,
         excluded.quantity, excluded.price, excluded.gross_value, excluded.source, excluded.imported_at);
  get diagnostics v_upserted = row_count;

  return jsonb_build_object(
    'ok', true,
    'contract', 'valorae-financial-sync-v2',
    'count', v_upserted,
    'deleted', v_deleted,
    'transactions_version', 0
  );
end;
$$;

-- Reimporta a tabela legada sem colapsar operações distintas ou repetidas.
do $$
begin
  if to_regclass('public.valorae_transactions') is not null then
    execute $repair$
      with raw as (
        select to_jsonb(t) as r, t.ctid::text as row_locator
        from public.valorae_transactions t
      ), resolved as (
        select
          r,
          row_locator,
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
      ), parsed as (
        select
          resolved_user_id as user_id,
          row_locator,
          coalesce(r->>'client_tx_id', r->>'clientTxId', r->>'id') as supplied_id,
          public.valorae_financial_safe_date_v2(coalesce(
            (r->'payload')->>'date', (r->'payload')->>'transactionDate',
            r->>'transaction_date', r->>'date'
          )) as transaction_date,
          case
            when nullif(trim(coalesce((r->'payload')->>'operation', r->>'operation', (r->'payload')->>'side', r->>'side')), '') is not null
              then upper(trim(coalesce((r->'payload')->>'operation', r->>'operation', (r->'payload')->>'side', r->>'side')))
            when lower(coalesce(r->>'is_sell', (r->'payload')->>'isSell', (r->'payload')->>'is_sell', 'false')) in ('true','t','1','yes')
              or public.valorae_financial_safe_numeric_v2(coalesce((r->'payload')->>'quantity', r->>'quantity'), 0) < 0
              or public.valorae_financial_safe_numeric_v2(coalesce((r->'payload')->>'grossValue', (r->'payload')->>'gross_value', r->>'gross_value'), 0) < 0
              then 'VENDA'
            else 'COMPRA'
          end as operation,
          upper(coalesce(nullif((r->'payload')->>'symbol', ''), nullif((r->'payload')->>'ticker', ''), nullif(r->>'symbol', ''), nullif(r->>'ticker', ''))) as symbol,
          coalesce(nullif((r->'payload')->>'asset_type', ''), nullif((r->'payload')->>'assetType', ''), nullif(r->>'asset_type', ''), 'Outro') as asset_type,
          abs(public.valorae_financial_safe_numeric_v2(coalesce((r->'payload')->>'quantity', r->>'quantity'), 0)) as quantity,
          abs(public.valorae_financial_safe_numeric_v2(coalesce((r->'payload')->>'price', r->>'purchase_price', r->>'price'), 0)) as price,
          abs(public.valorae_financial_safe_numeric_v2(coalesce((r->'payload')->>'grossValue', (r->'payload')->>'gross_value', r->>'gross_value'), 0)) as gross_value,
          coalesce(nullif((r->'payload')->>'source', ''), nullif(r->>'source', ''), 'Migração legado') as source,
          coalesce(
            public.valorae_financial_safe_timestamp_v2(coalesce((r->'payload')->>'importedAt', (r->'payload')->>'imported_at', r->>'imported_at')),
            public.valorae_financial_safe_timestamp_v2(r->>'updated_at')
          ) as imported_at,
          coalesce(public.valorae_financial_safe_timestamp_v2(r->>'updated_at'), now()) as updated_at,
          legacy_identity
        from resolved
        where resolved_user_id is not null
      ), identified as (
        select
          *,
          public.valorae_financial_normalize_id_v2(
            supplied_id,
            concat_ws('|', user_id::text, legacy_identity, transaction_date::text, operation, symbol,
                      quantity::text, price::text, gross_value::text, source,
                      coalesce(imported_at::text, ''))
          ) as base_client_tx_id
        from parsed
        where transaction_date is not null
          and nullif(symbol, '') is not null
          and nullif(operation, '') is not null
      ), ranked as (
        select *, row_number() over (
          partition by user_id, base_client_tx_id
          order by transaction_date, operation, symbol, quantity, price, gross_value, source, coalesce(imported_at, updated_at), row_locator
        ) as duplicate_ordinal
        from identified
      ), final_rows as (
        select
          user_id,
          case when duplicate_ordinal = 1 then base_client_tx_id else
            public.valorae_financial_normalize_id_v2(
              '', concat_ws('|', base_client_tx_id, duplicate_ordinal::text,
                            transaction_date::text, operation, symbol, quantity::text,
                            price::text, gross_value::text, source, coalesce(imported_at::text, ''))
            )
          end as client_tx_id,
          transaction_date, operation, symbol, asset_type, quantity, price,
          case when gross_value > 0 then gross_value else quantity * price end as gross_value,
          source, imported_at, updated_at
        from ranked
      )
      insert into public.valorae_financial_transactions(
        user_id, client_tx_id, transaction_date, operation, symbol, asset_type,
        quantity, price, gross_value, source, imported_at, updated_at
      )
      select user_id, client_tx_id, transaction_date, operation, symbol, asset_type,
             quantity, price, gross_value, source, imported_at, updated_at
      from final_rows
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
    $repair$;
  end if;
end $$;

revoke all on function public.valorae_financial_upload_transactions_v2(uuid, jsonb, text[]) from public, anon, authenticated;
grant execute on function public.valorae_financial_upload_transactions_v2(uuid, jsonb, text[]) to service_role;

commit;

-- Resultado de conferência: compare compras e vendas por usuário.
select
  user_id,
  count(*) as total_transactions,
  count(*) filter (where upper(operation) like '%VENDA%' or upper(operation) like '%SAÍDA%' or upper(operation) like '%SAIDA%') as sales,
  count(*) filter (where upper(operation) like '%COMPRA%' or upper(operation) like '%ENTRADA%') as purchases,
  count(distinct symbol) as symbols,
  min(transaction_date) as first_transaction,
  max(transaction_date) as last_transaction
from public.valorae_financial_transactions
group by user_id
order by total_transactions desc;
