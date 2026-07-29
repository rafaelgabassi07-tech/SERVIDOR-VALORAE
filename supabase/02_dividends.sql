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

  return jsonb_build_object(
    'ok', true,
    'contract', 'valorae-financial-sync-v2',
    'count', v_upserted,
    'deleted', v_deleted,
    'dividends_version', 0
  );
end;
$$;

revoke all on function public.valorae_financial_upload_dividends_v2(uuid, jsonb, boolean) from public, anon, authenticated;
grant execute on function public.valorae_financial_upload_dividends_v2(uuid, jsonb, boolean) to service_role;
comment on table public.valorae_financial_dividends is 'Histórico e agenda mínima de dividendos do VALORAE.';
