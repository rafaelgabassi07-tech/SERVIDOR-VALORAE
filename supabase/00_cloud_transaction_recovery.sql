-- VALORAE — RECUPERAÇÃO COMPLETA DA SINCRONIZAÇÃO FINANCEIRA v2
-- Execute este arquivo uma única vez no SQL Editor do Supabase.
-- É idempotente e reúne, na ordem correta, tabelas, RPCs, migração do legado e verificações.
-- Gerado para Proxy 21.12.401 / APK 2026.08.05.01.

-- Todas as alterações estruturais são aplicadas atomicamente; qualquer erro desfaz o lote.
begin;

-- VALORAE — 01/03 TRANSAÇÕES
-- Execute primeiro. Cria somente a tabela/RPC de transações e helpers compartilhados.


create extension if not exists pgcrypto;

create table if not exists public.valorae_financial_transactions (
  user_id uuid not null references auth.users(id) on delete cascade,
  client_tx_id text not null,
  transaction_date date not null,
  operation text not null,
  symbol text not null,
  asset_type text not null default 'Outro',
  quantity numeric(24,8) not null default 0,
  price numeric(24,8) not null default 0,
  gross_value numeric(24,8) not null default 0,
  source text not null default 'VALORAE',
  imported_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, client_tx_id),
  constraint valorae_financial_transactions_client_id_chk check (length(client_tx_id) between 1 and 96),
  constraint valorae_financial_transactions_symbol_chk check (length(symbol) between 1 and 24)
);

create index if not exists valorae_financial_transactions_user_date_idx
  on public.valorae_financial_transactions (user_id, transaction_date desc, client_tx_id);
create index if not exists valorae_financial_transactions_user_symbol_idx
  on public.valorae_financial_transactions (user_id, symbol, transaction_date desc);

alter table public.valorae_financial_transactions enable row level security;
revoke all on table public.valorae_financial_transactions from public, anon, authenticated;
grant select, insert, update, delete on table public.valorae_financial_transactions to service_role;

create or replace function public.valorae_financial_safe_numeric_v2(p_value text, p_default numeric default 0)
returns numeric
language plpgsql
immutable
set search_path = public, pg_temp
as $$
begin
  if nullif(trim(coalesce(p_value, '')), '') is null then return p_default; end if;
  return replace(trim(p_value), ',', '.')::numeric;
exception when others then
  return p_default;
end;
$$;

create or replace function public.valorae_financial_safe_date_v2(p_value text)
returns date
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v text := trim(coalesce(p_value, ''));
  n numeric;
  d date;
  parts text[];
begin
  if v = '' then return null; end if;

  if v ~ '^[0-9]{10,13}$' then
    n := v::numeric;
    if length(v) >= 13 then n := n / 1000.0; end if;
    return (to_timestamp(n) at time zone 'UTC')::date;
  end if;

  if v ~ '^[0-9]{1,2}/[0-9]{1,2}/[0-9]{4}$' then
    parts := string_to_array(v, '/');
    begin
      d := make_date(parts[3]::integer, parts[2]::integer, parts[1]::integer);
      return d;
    exception when others then
      return null;
    end;
  end if;

  if v ~ '^[0-9]{1,2}-[0-9]{1,2}-[0-9]{4}$' then
    parts := string_to_array(v, '-');
    begin
      d := make_date(parts[3]::integer, parts[2]::integer, parts[1]::integer);
      return d;
    exception when others then
      return null;
    end;
  end if;

  if v ~ '^[0-9]{4}[/-][0-9]{1,2}[/-][0-9]{1,2}$' then
    parts := string_to_array(replace(v, '/', '-'), '-');
    begin
      d := make_date(parts[1]::integer, parts[2]::integer, parts[3]::integer);
      return d;
    exception when others then
      return null;
    end;
  end if;

  begin
    return (v::timestamptz at time zone 'UTC')::date;
  exception when others then
    return null;
  end;
end;
$$;

create or replace function public.valorae_financial_safe_timestamp_v2(p_value text)
returns timestamptz
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v text := trim(coalesce(p_value, ''));
  n numeric;
begin
  if v = '' then return null; end if;
  if v ~ '^[0-9]{10,13}$' then
    n := v::numeric;
    if length(v) >= 13 then n := n / 1000.0; end if;
    return to_timestamp(n);
  end if;
  return v::timestamptz;
exception when others then
  return null;
end;
$$;

create or replace function public.valorae_financial_normalize_id_v2(p_value text, p_seed text)
returns text
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v text;
begin
  v := regexp_replace(trim(coalesce(p_value, '')), '[^A-Za-z0-9:_-]', '', 'g');
  if v = '' then v := 'valorae-' || encode(digest(coalesce(p_seed, ''), 'sha256'), 'hex'); end if;
  if length(v) <= 96 then return v; end if;
  return left(v, 71) || '-' || left(encode(digest(v, 'sha256'), 'hex'), 24);
end;
$$;

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
  v_received integer := 0;
  v_valid integer := 0;
  v_transactions_updated timestamptz;
begin
  if p_user_id is null then raise exception using errcode = '22023', message = 'INVALID_USER_ID'; end if;
  if jsonb_typeof(coalesce(p_rows, '[]'::jsonb)) <> 'array' then
    raise exception using errcode = '22023', message = 'INVALID_TRANSACTIONS_PAYLOAD';
  end if;

  select count(*), count(*) filter (
    where public.valorae_financial_safe_date_v2(coalesce(r->>'date', r->>'transaction_date')) is not null
      and upper(coalesce(nullif(trim(r->>'symbol'), ''), nullif(trim(r->>'ticker'), ''))) <> ''
      and (
        greatest(public.valorae_financial_safe_numeric_v2(r->>'quantity', 0), 0) > 0
        or greatest(public.valorae_financial_safe_numeric_v2(coalesce(r->>'grossValue', r->>'gross_value'), 0), 0) > 0
      )
  )
  into v_received, v_valid
  from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) r;

  if v_received <> v_valid then
    raise exception using
      errcode = '22023',
      message = 'INVALID_TRANSACTION_ROWS',
      detail = format('received=%s valid=%s rejected=%s', v_received, v_valid, v_received - v_valid);
  end if;

  if coalesce(array_length(p_replace_symbols, 1), 0) > 0 then
    with incoming as (
      select public.valorae_financial_normalize_id_v2(
               coalesce(r->>'clientTxId', r->>'client_tx_id', r->>'id'),
               concat_ws('|', p_user_id::text, r->>'symbol', r->>'ticker', r->>'date', r->>'operation', r->>'quantity', r->>'price', r->>'gross_value')
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
        concat_ws('|', p_user_id::text, r->>'symbol', r->>'ticker', r->>'date', r->>'operation', r->>'quantity', r->>'price', r->>'gross_value')
      ) as client_tx_id,
      public.valorae_financial_safe_date_v2(coalesce(r->>'date', r->>'transaction_date')) as transaction_date,
      upper(coalesce(nullif(trim(r->>'operation'), ''), nullif(trim(r->>'side'), ''), 'MOVIMENTAÇÃO')) as operation,
      upper(coalesce(nullif(trim(r->>'symbol'), ''), nullif(trim(r->>'ticker'), ''))) as symbol,
      coalesce(nullif(trim(coalesce(r->>'assetType', r->>'asset_type')), ''), 'Outro') as asset_type,
      greatest(public.valorae_financial_safe_numeric_v2(r->>'quantity', 0), 0) as quantity,
      greatest(public.valorae_financial_safe_numeric_v2(coalesce(r->>'price', r->>'purchase_price'), 0), 0) as price,
      greatest(public.valorae_financial_safe_numeric_v2(coalesce(r->>'grossValue', r->>'gross_value'), 0), 0) as gross_value,
      coalesce(nullif(trim(r->>'source'), ''), 'VALORAE') as source,
      public.valorae_financial_safe_timestamp_v2(coalesce(r->>'importedAt', r->>'imported_at')) as imported_at
    from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) r
  ), valid as (
    select * from normalized
    where transaction_date is not null
      and symbol <> ''
      and (quantity > 0 or gross_value > 0)
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

  select max(updated_at) into v_transactions_updated
    from public.valorae_financial_transactions
   where user_id = p_user_id;

  return jsonb_build_object(
    'ok', true,
    'contract', 'valorae-financial-sync-v2',
    'count', v_upserted,
    'deleted', v_deleted,
    'transactions_version', coalesce(floor(extract(epoch from v_transactions_updated) * 1000)::bigint, 0)
  );
end;
$$;

revoke all on function public.valorae_financial_upload_transactions_v2(uuid, jsonb, text[]) from public, anon, authenticated;
grant execute on function public.valorae_financial_upload_transactions_v2(uuid, jsonb, text[]) to service_role;
comment on table public.valorae_financial_transactions is 'Histórico financeiro mínimo do VALORAE. Sem payload JSON duplicado.';

-- VALORAE — 02/03 DIVIDENDOS
-- Execute depois de 01_transactions.sql. Cria somente a tabela/RPC de dividendos.

create table if not exists public.valorae_financial_dividends (
  user_id uuid not null references auth.users(id) on delete cascade,
  event_id text not null,
  ticker text not null,
  date_com date,
  ex_date date,
  inferred_com_date date,
  eligibility_date_source text,
  payment_date date,
  value_per_share numeric(24,8) not null default 0,
  quantity numeric(24,8) not null default 0,
  estimated_amount numeric(24,8) not null default 0,
  status text not null default 'oficial',
  source text not null default 'VALORAE',
  updated_at timestamptz not null default now(),
  primary key (user_id, event_id),
  constraint valorae_financial_dividends_event_id_chk check (length(event_id) between 1 and 96),
  constraint valorae_financial_dividends_ticker_chk check (length(ticker) between 1 and 24)
);

create index if not exists valorae_financial_dividends_user_payment_idx
  on public.valorae_financial_dividends (user_id, payment_date desc nulls last, event_id);
create index if not exists valorae_financial_dividends_user_ticker_idx
  on public.valorae_financial_dividends (user_id, ticker);

alter table public.valorae_financial_dividends enable row level security;
revoke all on table public.valorae_financial_dividends from public, anon, authenticated;
grant select, insert, update, delete on table public.valorae_financial_dividends to service_role;

create or replace function public.valorae_financial_upload_dividends_v2(
  p_user_id uuid,
  p_rows jsonb,
  p_replace_all boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_upserted integer := 0;
  v_deleted integer := 0;
  v_received integer := 0;
  v_valid integer := 0;
  v_dividends_updated timestamptz;
begin
  if p_user_id is null then raise exception using errcode = '22023', message = 'INVALID_USER_ID'; end if;
  if jsonb_typeof(coalesce(p_rows, '[]'::jsonb)) <> 'array' then
    raise exception using errcode = '22023', message = 'INVALID_DIVIDENDS_PAYLOAD';
  end if;

  select count(*), count(*) filter (
    where upper(coalesce(nullif(trim(r->>'ticker'), ''), nullif(trim(r->>'symbol'), ''))) <> ''
      and coalesce(
        public.valorae_financial_safe_date_v2(coalesce(r->>'dateCom', r->>'date_com')),
        public.valorae_financial_safe_date_v2(coalesce(r->>'exDate', r->>'ex_date')),
        public.valorae_financial_safe_date_v2(coalesce(r->>'inferredComDate', r->>'inferred_com_date')),
        public.valorae_financial_safe_date_v2(coalesce(r->>'paymentDate', r->>'payment_date'))
      ) is not null
  )
  into v_received, v_valid
  from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) r;

  if v_received <> v_valid then
    raise exception using
      errcode = '22023',
      message = 'INVALID_DIVIDEND_ROWS',
      detail = format('received=%s valid=%s rejected=%s', v_received, v_valid, v_received - v_valid);
  end if;

  if p_replace_all then
    with incoming as (
      select public.valorae_financial_normalize_id_v2(
               coalesce(r->>'eventId', r->>'event_id', r->>'eventKey', r->>'event_key', r->>'id'),
               concat_ws('|', p_user_id::text, coalesce(nullif(trim(r->>'ticker'), ''), nullif(trim(r->>'symbol'), '')), coalesce(nullif(trim(r->>'dateCom'), ''), nullif(trim(r->>'date_com'), ''), nullif(trim(r->>'inferredComDate'), ''), nullif(trim(r->>'inferred_com_date'), ''), nullif(trim(r->>'exDate'), ''), nullif(trim(r->>'ex_date'), ''), nullif(trim(r->>'paymentDate'), ''), nullif(trim(r->>'payment_date'), '')), upper(coalesce(r->>'kind', r->>'dividendType', r->>'status', 'PROVENTO')))
             ) as event_id
      from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) r
    )
    delete from public.valorae_financial_dividends d
     where d.user_id = p_user_id
       and not exists (select 1 from incoming i where i.event_id = d.event_id);
    get diagnostics v_deleted = row_count;
  end if;

  with normalized as (
    select
      public.valorae_financial_normalize_id_v2(
        coalesce(r->>'eventId', r->>'event_id', r->>'eventKey', r->>'event_key', r->>'id'),
        concat_ws('|', p_user_id::text, coalesce(nullif(trim(r->>'ticker'), ''), nullif(trim(r->>'symbol'), '')), coalesce(nullif(trim(r->>'dateCom'), ''), nullif(trim(r->>'date_com'), ''), nullif(trim(r->>'inferredComDate'), ''), nullif(trim(r->>'inferred_com_date'), ''), nullif(trim(r->>'exDate'), ''), nullif(trim(r->>'ex_date'), ''), nullif(trim(r->>'paymentDate'), ''), nullif(trim(r->>'payment_date'), '')), upper(coalesce(r->>'kind', r->>'dividendType', r->>'status', 'PROVENTO')))
      ) as event_id,
      upper(coalesce(nullif(trim(r->>'ticker'), ''), nullif(trim(r->>'symbol'), ''))) as ticker,
      public.valorae_financial_safe_date_v2(coalesce(r->>'dateCom', r->>'date_com')) as date_com,
      public.valorae_financial_safe_date_v2(coalesce(r->>'exDate', r->>'ex_date')) as ex_date,
      public.valorae_financial_safe_date_v2(coalesce(r->>'inferredComDate', r->>'inferred_com_date')) as inferred_com_date,
      nullif(trim(coalesce(r->>'eligibilityDateSource', r->>'eligibility_date_source')), '') as eligibility_date_source,
      public.valorae_financial_safe_date_v2(coalesce(r->>'paymentDate', r->>'payment_date')) as payment_date,
      greatest(public.valorae_financial_safe_numeric_v2(coalesce(r->>'valuePerShare', r->>'value_per_share'), 0), 0) as value_per_share,
      greatest(public.valorae_financial_safe_numeric_v2(r->>'quantity', 0), 0) as quantity,
      greatest(public.valorae_financial_safe_numeric_v2(coalesce(r->>'estimatedAmount', r->>'estimated_amount'), 0), 0) as estimated_amount,
      coalesce(nullif(trim(r->>'status'), ''), 'oficial') as status,
      coalesce(nullif(trim(r->>'source'), ''), 'VALORAE') as source
    from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) r
  ), valid as (
    select * from normalized
    where ticker <> ''
      and coalesce(date_com, ex_date, inferred_com_date, payment_date) is not null
  )
  insert into public.valorae_financial_dividends(
    user_id, event_id, ticker, date_com, ex_date, inferred_com_date,
    eligibility_date_source, payment_date, value_per_share, quantity,
    estimated_amount, status, source, updated_at
  )
  select p_user_id, event_id, ticker, date_com, ex_date, inferred_com_date,
         eligibility_date_source, payment_date, value_per_share, quantity,
         estimated_amount, status, source, now()
  from valid
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
    updated_at = now()
  where (public.valorae_financial_dividends.ticker,
         public.valorae_financial_dividends.date_com,
         public.valorae_financial_dividends.ex_date,
         public.valorae_financial_dividends.inferred_com_date,
         public.valorae_financial_dividends.eligibility_date_source,
         public.valorae_financial_dividends.payment_date,
         public.valorae_financial_dividends.value_per_share,
         public.valorae_financial_dividends.quantity,
         public.valorae_financial_dividends.estimated_amount,
         public.valorae_financial_dividends.status,
         public.valorae_financial_dividends.source)
        is distinct from
        (excluded.ticker, excluded.date_com, excluded.ex_date, excluded.inferred_com_date,
         excluded.eligibility_date_source, excluded.payment_date, excluded.value_per_share,
         excluded.quantity, excluded.estimated_amount, excluded.status, excluded.source);
  get diagnostics v_upserted = row_count;

  select max(updated_at) into v_dividends_updated
    from public.valorae_financial_dividends
   where user_id = p_user_id;

  return jsonb_build_object(
    'ok', true,
    'contract', 'valorae-financial-sync-v2',
    'count', v_upserted,
    'deleted', v_deleted,
    'dividends_version', coalesce(floor(extract(epoch from v_dividends_updated) * 1000)::bigint, 0)
  );
end;
$$;

revoke all on function public.valorae_financial_upload_dividends_v2(uuid, jsonb, boolean) from public, anon, authenticated;
grant execute on function public.valorae_financial_upload_dividends_v2(uuid, jsonb, boolean) to service_role;
comment on table public.valorae_financial_dividends is 'Histórico e agenda mínima de dividendos do VALORAE.';

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

commit;
