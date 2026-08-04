-- VALORAE — SQL CANÔNICA 01/02 — TRANSAÇÕES
-- Envio e restauração de transações. Execute primeiro.
-- Contrato valorae-financial-sync-v2 — Proxy 21.12.400+ / APK 2026.08.04.01+.

begin;
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

drop function if exists public.valorae_financial_upload_transactions_v2(uuid, jsonb, text[]);
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


-- Restauração de transações em formato aceito pelo APK.
drop function if exists public.valorae_financial_download_transactions_v2(uuid);
create function public.valorae_financial_download_transactions_v2(p_user_id uuid)
returns jsonb
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  v_rows jsonb;
  v_updated timestamptz;
begin
  if p_user_id is null then
    raise exception using errcode = '22023', message = 'INVALID_USER_ID';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
      'clientTxId', client_tx_id,
      'date', to_char(transaction_date, 'YYYY-MM-DD'),
      'operation', operation,
      'symbol', symbol,
      'assetType', asset_type,
      'quantity', quantity,
      'price', price,
      'grossValue', gross_value,
      'source', source,
      'importedAt', case when imported_at is null then null
        else floor(extract(epoch from imported_at) * 1000)::bigint end
    ) order by transaction_date, client_tx_id), '[]'::jsonb), max(updated_at)
    into v_rows, v_updated
    from public.valorae_financial_transactions
   where user_id = p_user_id;
  return jsonb_build_object(
    'ok', true,
    'contract', 'valorae-financial-sync-v2',
    'transactions', v_rows,
    'transactions_count', jsonb_array_length(v_rows),
    'transactions_version', coalesce(floor(extract(epoch from v_updated) * 1000)::bigint, 0),
    'updated_at', v_updated
  );
end;
$$;

revoke all on function public.valorae_financial_download_transactions_v2(uuid) from public, anon, authenticated;
grant execute on function public.valorae_financial_download_transactions_v2(uuid) to service_role;
notify pgrst, 'reload schema';

commit;

select
  'valorae-financial-sync-v2' as contract,
  to_regclass('public.valorae_financial_transactions') is not null as tabela_transacoes,
  to_regprocedure('public.valorae_financial_upload_transactions_v2(uuid,jsonb,text[])') is not null as envio_transacoes,
  to_regprocedure('public.valorae_financial_download_transactions_v2(uuid)') is not null as restauracao_transacoes;
