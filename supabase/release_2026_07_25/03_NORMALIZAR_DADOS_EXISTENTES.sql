-- VALORAE 2026-07-25 — parte 03/11
-- Normaliza datas/chaves e remove somente duplicatas técnicas.

-- Converte transaction_date legado para timestamptz.
do $$
declare
  v_type text;
begin
  select data_type into v_type
    from information_schema.columns
   where table_schema = 'public'
     and table_name = 'valorae_transactions'
     and column_name = 'transaction_date';

  if v_type in ('bigint', 'integer', 'numeric', 'double precision', 'real') then
    execute 'alter table public.valorae_transactions alter column transaction_date type timestamptz using case when transaction_date is null then null else to_timestamp(transaction_date::double precision / 1000.0) end';
  elsif v_type = 'timestamp without time zone' then
    execute 'alter table public.valorae_transactions alter column transaction_date type timestamptz using transaction_date at time zone ''UTC''';
  end if;
end $$;

create or replace function public.valorae_normalize_client_tx_id(
  p_value text,
  p_fallback_seed text default ''
)
returns text
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v_safe text;
begin
  v_safe := regexp_replace(trim(coalesce(p_value, '')), '[^A-Za-z0-9:_-]', '', 'g');
  if v_safe = '' then
    v_safe := 'valorae-' || encode(digest(trim(coalesce(p_fallback_seed, '')), 'sha256'), 'hex');
  end if;
  if length(v_safe) <= 96 then return v_safe; end if;
  return left(v_safe, 71) || '-' || left(encode(digest(v_safe, 'sha256'), 'hex'), 24);
end;
$$;

with normalized as (
  select ctid, user_id, updated_at,
         public.valorae_normalize_client_tx_id(
           client_tx_id,
           concat_ws('|', user_id, ticker, transaction_date::text, quantity::text, purchase_price::text)
         ) as normalized_id
    from public.valorae_transactions
), ranked as (
  select ctid,
         row_number() over (
           partition by user_id, normalized_id
           order by updated_at desc nulls last, ctid desc
         ) as rn
    from normalized
)
delete from public.valorae_transactions t
 using ranked r
 where t.ctid = r.ctid and r.rn > 1;

update public.valorae_transactions t
   set client_tx_id = public.valorae_normalize_client_tx_id(
     t.client_tx_id,
     concat_ws('|', t.user_id, t.ticker, t.transaction_date::text, t.quantity::text, t.purchase_price::text)
   )
 where t.client_tx_id is distinct from public.valorae_normalize_client_tx_id(
   t.client_tx_id,
   concat_ws('|', t.user_id, t.ticker, t.transaction_date::text, t.quantity::text, t.purchase_price::text)
 );

alter table public.valorae_transactions
  drop constraint if exists valorae_transactions_client_tx_id_length_chk;
alter table public.valorae_transactions
  add constraint valorae_transactions_client_tx_id_length_chk
  check (length(client_tx_id) between 1 and 96);

-- Consolida proventos legados que representam o mesmo evento econômico.
with ranked as (
  select ctid,
         row_number() over (
           partition by user_id,
                        upper(coalesce(ticker, '')),
                        upper(coalesce(payload->>'type', payload->>'eventType', payload->>'event_type', payload->>'kind', 'DIVIDEND')),
                        coalesce(nullif(date_com, ''), payload->>'exDate', payload->>'ex_date', ''),
                        coalesce(payment_date, ''),
                        coalesce(payload->>'sourceId', payload->>'source_id', payload->>'externalId', payload->>'external_id', payload->>'id', source, 'VALORAE')
           order by updated_at desc nulls last, ctid desc
         ) as rn
    from public.valorae_dividend_events
)
delete from public.valorae_dividend_events d
 using ranked r
 where d.ctid = r.ctid and r.rn > 1;

update public.valorae_dividend_events d
   set event_key = encode(digest(concat_ws('|',
       d.user_id,
       upper(coalesce(d.ticker, '')),
       upper(coalesce(d.payload->>'type', d.payload->>'eventType', d.payload->>'event_type', d.payload->>'kind', 'DIVIDEND')),
       coalesce(nullif(d.date_com, ''), d.payload->>'exDate', d.payload->>'ex_date', ''),
       coalesce(d.payment_date, ''),
       coalesce(d.payload->>'sourceId', d.payload->>'source_id', d.payload->>'externalId', d.payload->>'external_id', d.payload->>'id', d.source, 'VALORAE')
   ), 'sha256'), 'hex')
 where d.event_key is distinct from encode(digest(concat_ws('|',
       d.user_id,
       upper(coalesce(d.ticker, '')),
       upper(coalesce(d.payload->>'type', d.payload->>'eventType', d.payload->>'event_type', d.payload->>'kind', 'DIVIDEND')),
       coalesce(nullif(d.date_com, ''), d.payload->>'exDate', d.payload->>'ex_date', ''),
       coalesce(d.payment_date, ''),
       coalesce(d.payload->>'sourceId', d.payload->>'source_id', d.payload->>'externalId', d.payload->>'external_id', d.payload->>'id', d.source, 'VALORAE')
   ), 'sha256'), 'hex');
