-- VALORAE — SQL CANÔNICA 02/02 — DIVIDENDOS E RESTAURAÇÃO COMPLETA
-- Envio/restauração de dividendos e RPCs unificadas. Execute depois do arquivo 1.
-- Contrato valorae-financial-sync-v2 — Proxy 21.12.401+ / APK 2026.08.05.01+.

begin;

do $$
begin
  if to_regclass('public.valorae_financial_transactions') is null
     or to_regprocedure('public.valorae_financial_download_transactions_v2(uuid)') is null then
    raise exception using errcode = '55000', message = 'VALORAE_SQL_01_REQUIRED',
      detail = 'Execute primeiro o arquivo 01_transactions.sql completo.';
  end if;
end $$;
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
  gross_value_per_share numeric(24,8) not null default 0,
  net_value_per_share numeric(24,8) not null default 0,
  tax_rate numeric(12,8) not null default 0,
  tax_withheld_per_share numeric(24,8) not null default 0,
  gross_amount numeric(24,8) not null default 0,
  net_amount numeric(24,8) not null default 0,
  tax_withheld_amount numeric(24,8) not null default 0,
  tax_rule text not null default '',
  status text not null default 'oficial',
  source text not null default 'VALORAE',
  updated_at timestamptz not null default now(),
  primary key (user_id, event_id),
  constraint valorae_financial_dividends_event_id_chk check (length(event_id) between 1 and 96),
  constraint valorae_financial_dividends_ticker_chk check (length(ticker) between 1 and 24)
);

alter table public.valorae_financial_dividends
  add column if not exists gross_value_per_share numeric(24,8) not null default 0,
  add column if not exists net_value_per_share numeric(24,8) not null default 0,
  add column if not exists tax_rate numeric(12,8) not null default 0,
  add column if not exists tax_withheld_per_share numeric(24,8) not null default 0,
  add column if not exists gross_amount numeric(24,8) not null default 0,
  add column if not exists net_amount numeric(24,8) not null default 0,
  add column if not exists tax_withheld_amount numeric(24,8) not null default 0,
  add column if not exists tax_rule text not null default '';

create index if not exists valorae_financial_dividends_user_payment_idx
  on public.valorae_financial_dividends (user_id, payment_date desc nulls last, event_id);
create index if not exists valorae_financial_dividends_user_ticker_idx
  on public.valorae_financial_dividends (user_id, ticker);

alter table public.valorae_financial_dividends enable row level security;
revoke all on table public.valorae_financial_dividends from public, anon, authenticated;
grant select, insert, update, delete on table public.valorae_financial_dividends to service_role;

drop function if exists public.valorae_financial_upload_dividends_v2(uuid, jsonb, boolean);
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
      greatest(public.valorae_financial_safe_numeric_v2(coalesce(r->>'grossValuePerShare', r->>'gross_value_per_share'), 0), 0) as gross_value_per_share,
      greatest(public.valorae_financial_safe_numeric_v2(coalesce(r->>'netValuePerShare', r->>'net_value_per_share'), 0), 0) as net_value_per_share,
      greatest(public.valorae_financial_safe_numeric_v2(coalesce(r->>'taxRate', r->>'tax_rate'), 0), 0) as tax_rate,
      greatest(public.valorae_financial_safe_numeric_v2(coalesce(r->>'taxWithheldPerShare', r->>'tax_withheld_per_share'), 0), 0) as tax_withheld_per_share,
      greatest(public.valorae_financial_safe_numeric_v2(coalesce(r->>'grossAmount', r->>'gross_amount'), 0), 0) as gross_amount,
      greatest(public.valorae_financial_safe_numeric_v2(coalesce(r->>'netAmount', r->>'net_amount'), 0), 0) as net_amount,
      greatest(public.valorae_financial_safe_numeric_v2(coalesce(r->>'taxWithheldAmount', r->>'tax_withheld_amount'), 0), 0) as tax_withheld_amount,
      coalesce(nullif(trim(coalesce(r->>'taxRule', r->>'tax_rule')), ''), '') as tax_rule,
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
    estimated_amount, gross_value_per_share, net_value_per_share, tax_rate,
    tax_withheld_per_share, gross_amount, net_amount, tax_withheld_amount, tax_rule,
    status, source, updated_at
  )
  select p_user_id, event_id, ticker, date_com, ex_date, inferred_com_date,
         eligibility_date_source, payment_date, value_per_share, quantity,
         estimated_amount, gross_value_per_share, net_value_per_share, tax_rate,
         tax_withheld_per_share, gross_amount, net_amount, tax_withheld_amount, tax_rule,
         status, source, now()
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
    gross_value_per_share = excluded.gross_value_per_share,
    net_value_per_share = excluded.net_value_per_share,
    tax_rate = excluded.tax_rate,
    tax_withheld_per_share = excluded.tax_withheld_per_share,
    gross_amount = excluded.gross_amount,
    net_amount = excluded.net_amount,
    tax_withheld_amount = excluded.tax_withheld_amount,
    tax_rule = excluded.tax_rule,
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
         public.valorae_financial_dividends.gross_value_per_share,
         public.valorae_financial_dividends.net_value_per_share,
         public.valorae_financial_dividends.tax_rate,
         public.valorae_financial_dividends.tax_withheld_per_share,
         public.valorae_financial_dividends.gross_amount,
         public.valorae_financial_dividends.net_amount,
         public.valorae_financial_dividends.tax_withheld_amount,
         public.valorae_financial_dividends.tax_rule,
         public.valorae_financial_dividends.status,
         public.valorae_financial_dividends.source)
        is distinct from
        (excluded.ticker, excluded.date_com, excluded.ex_date, excluded.inferred_com_date,
         excluded.eligibility_date_source, excluded.payment_date, excluded.value_per_share,
         excluded.quantity, excluded.estimated_amount, excluded.gross_value_per_share,
         excluded.net_value_per_share, excluded.tax_rate, excluded.tax_withheld_per_share,
         excluded.gross_amount, excluded.net_amount, excluded.tax_withheld_amount, excluded.tax_rule,
         excluded.status, excluded.source);
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


-- Restauração de dividendos em formato aceito pelo APK.
drop function if exists public.valorae_financial_download_dividends_v2(uuid);
create function public.valorae_financial_download_dividends_v2(p_user_id uuid)
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
      'eventId', event_id,
      'ticker', ticker,
      'dateCom', coalesce(to_char(date_com, 'YYYY-MM-DD'), ''),
      'exDate', coalesce(to_char(ex_date, 'YYYY-MM-DD'), ''),
      'inferredComDate', coalesce(to_char(inferred_com_date, 'YYYY-MM-DD'), ''),
      'eligibilityDateSource', coalesce(eligibility_date_source, ''),
      'paymentDate', coalesce(to_char(payment_date, 'YYYY-MM-DD'), ''),
      'valuePerShare', value_per_share,
      'quantity', quantity,
      'estimatedAmount', estimated_amount,
      'grossValuePerShare', gross_value_per_share,
      'netValuePerShare', net_value_per_share,
      'taxRate', tax_rate,
      'taxWithheldPerShare', tax_withheld_per_share,
      'grossAmount', gross_amount,
      'netAmount', net_amount,
      'taxWithheldAmount', tax_withheld_amount,
      'taxRule', tax_rule,
      'status', status,
      'source', source
    ) order by payment_date nulls last, ticker, event_id), '[]'::jsonb), max(updated_at)
    into v_rows, v_updated
    from public.valorae_financial_dividends
   where user_id = p_user_id;
  return jsonb_build_object(
    'ok', true,
    'contract', 'valorae-financial-sync-v2',
    'dividends', v_rows,
    'events', v_rows,
    'dividends_count', jsonb_array_length(v_rows),
    'dividends_version', coalesce(floor(extract(epoch from v_updated) * 1000)::bigint, 0),
    'updated_at', v_updated
  );
end;
$$;

-- Restauração única usada pelo Proxy e pelo APK.
drop function if exists public.valorae_financial_download_v2(uuid);
create function public.valorae_financial_download_v2(p_user_id uuid)
returns jsonb
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  v_tx jsonb := public.valorae_financial_download_transactions_v2(p_user_id);
  v_div jsonb := public.valorae_financial_download_dividends_v2(p_user_id);
begin
  return jsonb_build_object(
    'ok', true,
    'contract', 'valorae-financial-sync-v2',
    'transactions', coalesce(v_tx->'transactions', '[]'::jsonb),
    'dividends', coalesce(v_div->'dividends', '[]'::jsonb),
    'transactions_count', coalesce((v_tx->>'transactions_count')::integer, 0),
    'dividends_count', coalesce((v_div->>'dividends_count')::integer, 0),
    'transactions_version', coalesce((v_tx->>'transactions_version')::bigint, 0),
    'dividends_version', coalesce((v_div->>'dividends_version')::bigint, 0),
    'updated_at', greatest(
      nullif(v_tx->>'updated_at', '')::timestamptz,
      nullif(v_div->>'updated_at', '')::timestamptz
    )
  );
end;
$$;

-- Status sem transferir os históricos completos.
drop function if exists public.valorae_financial_status_v2(uuid);
create function public.valorae_financial_status_v2(p_user_id uuid)
returns jsonb
language sql stable security definer
set search_path = public, pg_temp
as $$
  with tx as (
    select count(*)::bigint n, max(updated_at) u from public.valorae_financial_transactions where user_id = p_user_id
  ), dv as (
    select count(*)::bigint n, max(updated_at) u from public.valorae_financial_dividends where user_id = p_user_id
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

-- Exclusão completa solicitada pelo APK.
drop function if exists public.valorae_financial_delete_v2(uuid);
create function public.valorae_financial_delete_v2(p_user_id uuid)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_tx integer := 0;
  v_div integer := 0;
begin
  if p_user_id is null then
    raise exception using errcode = '22023', message = 'INVALID_USER_ID';
  end if;
  delete from public.valorae_financial_transactions where user_id = p_user_id;
  get diagnostics v_tx = row_count;
  delete from public.valorae_financial_dividends where user_id = p_user_id;
  get diagnostics v_div = row_count;
  return jsonb_build_object(
    'ok', true,
    'contract', 'valorae-financial-sync-v2',
    'transactions_deleted', v_tx,
    'dividends_deleted', v_div,
    'count', v_tx + v_div,
    'transactions_version', 0,
    'dividends_version', 0,
    'updated_at', now()
  );
end;
$$;

revoke all on function public.valorae_financial_download_dividends_v2(uuid) from public, anon, authenticated;
revoke all on function public.valorae_financial_download_v2(uuid) from public, anon, authenticated;
revoke all on function public.valorae_financial_status_v2(uuid) from public, anon, authenticated;
revoke all on function public.valorae_financial_delete_v2(uuid) from public, anon, authenticated;
grant execute on function public.valorae_financial_download_dividends_v2(uuid) to service_role;
grant execute on function public.valorae_financial_download_v2(uuid) to service_role;
grant execute on function public.valorae_financial_status_v2(uuid) to service_role;
grant execute on function public.valorae_financial_delete_v2(uuid) to service_role;
notify pgrst, 'reload schema';

commit;

select
  'valorae-financial-sync-v2' as contract,
  to_regclass('public.valorae_financial_dividends') is not null as tabela_dividendos,
  to_regprocedure('public.valorae_financial_upload_dividends_v2(uuid,jsonb,boolean)') is not null as envio_dividendos,
  to_regprocedure('public.valorae_financial_download_v2(uuid)') is not null as restauracao_completa,
  to_regprocedure('public.valorae_financial_status_v2(uuid)') is not null as status_completo,
  to_regprocedure('public.valorae_financial_delete_v2(uuid)') is not null as exclusao_completa,
  true as postgrest_schema_reload_requested;
