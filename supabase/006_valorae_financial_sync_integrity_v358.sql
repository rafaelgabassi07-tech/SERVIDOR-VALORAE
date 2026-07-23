-- VALORAE v358 — integridade financeira e sincronização revisionada
-- Obrigatória para o Proxy financial-sync-integrity-v358.
-- Todas as mutações críticas passam por RPCs SECURITY DEFINER e uma revisão global por usuário.

create extension if not exists pgcrypto;

create table if not exists public.valorae_sync_user_state (
  user_id text primary key,
  revision bigint not null default 0 check (revision >= 0),
  deletion_generation bigint not null default 0 check (deletion_generation >= 0),
  tombstone boolean not null default false,
  deleted_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.valorae_sync_user_state enable row level security;
revoke all on public.valorae_sync_user_state from anon, authenticated;

-- Unifica transaction_date como timestamptz para eliminar a bifurcação bigint/ISO.
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

-- Normalização compartilhada de client_tx_id em 96 caracteres.
-- Mantém exatamente o mesmo alfabeto e algoritmo usados pelo APK e pelo Proxy.
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
  if length(v_safe) <= 96 then
    return v_safe;
  end if;
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
         row_number() over (partition by user_id, normalized_id order by updated_at desc nulls last, ctid desc) as rn
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

-- Consolida eventos antigos cuja única diferença era status/valor mutável.
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

update public.valorae_dividend_events
   set event_key = encode(digest(concat_ws('|',
       user_id,
       upper(coalesce(ticker, '')),
       upper(coalesce(payload->>'type', payload->>'eventType', payload->>'event_type', payload->>'kind', 'DIVIDEND')),
       coalesce(nullif(date_com, ''), payload->>'exDate', payload->>'ex_date', ''),
       coalesce(payment_date, ''),
       coalesce(payload->>'sourceId', payload->>'source_id', payload->>'externalId', payload->>'external_id', payload->>'id', source, 'VALORAE')
   ), 'sha256'), 'hex');

create unique index if not exists valorae_dividend_events_user_event_uidx
  on public.valorae_dividend_events (user_id, event_key);

create or replace function public.valorae_sync_get_state(p_user_id text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_state public.valorae_sync_user_state%rowtype;
begin
  if nullif(trim(p_user_id), '') is null then
    raise exception using errcode = '22023', message = 'INVALID_SYNC_IDENTITY';
  end if;
  insert into public.valorae_sync_user_state(user_id) values (p_user_id)
  on conflict (user_id) do nothing;
  select * into v_state from public.valorae_sync_user_state where user_id = p_user_id;
  return jsonb_build_object(
    'user_id', v_state.user_id,
    'revision', v_state.revision,
    'deletion_generation', v_state.deletion_generation,
    'tombstone', v_state.tombstone,
    'deleted_at', v_state.deleted_at,
    'updated_at', v_state.updated_at
  );
end;
$$;

create or replace function public.valorae_sync_assert_state(
  p_user_id text,
  p_expected_revision bigint,
  p_expected_deletion_generation bigint,
  p_expected_tombstone boolean,
  p_clear_tombstone boolean default false,
  p_action_created_at timestamptz default null
)
returns public.valorae_sync_user_state
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_state public.valorae_sync_user_state%rowtype;
begin
  insert into public.valorae_sync_user_state(user_id) values (p_user_id)
  on conflict (user_id) do nothing;
  select * into v_state
    from public.valorae_sync_user_state
   where user_id = p_user_id
   for update;

  if p_expected_revision is null
     or p_expected_deletion_generation is null
     or p_expected_tombstone is null then
    raise exception using errcode = '40001', message = 'SYNC_STATE_REQUIRED';
  end if;

  if v_state.revision <> p_expected_revision
     or v_state.deletion_generation <> p_expected_deletion_generation
     or v_state.tombstone <> p_expected_tombstone then
    raise exception using errcode = '40001', message = 'SYNC_REVISION_CONFLICT';
  end if;

  if v_state.tombstone then
    if not p_clear_tombstone then
      raise exception using errcode = '40001', message = 'SYNC_TOMBSTONE_ACTIVE';
    end if;
    if p_action_created_at is null or v_state.deleted_at is null or p_action_created_at <= v_state.deleted_at then
      raise exception using errcode = '40001', message = 'SYNC_STALE_AFTER_DELETE';
    end if;
  end if;
  return v_state;
end;
$$;

create or replace function public.valorae_sync_upsert_transactions(
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
begin
  v_state := public.valorae_sync_assert_state(p_user_id, p_expected_revision, p_expected_deletion_generation, p_expected_tombstone, p_clear_tombstone, p_action_created_at);

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
    updated_at = now();
  get diagnostics v_count = row_count;

  if p_backup is not null then
    insert into public.valorae_sync_backups(user_id, backup_kind, source, payload, payload_size_bytes, metadata, created_at, updated_at)
    values (p_user_id, 'transactions', 'valorae-proxy-rpc', p_backup, octet_length(p_backup::text), jsonb_build_object('count', v_count), now(), now());
  end if;

  update public.valorae_sync_user_state
     set revision = revision + 1,
         tombstone = case when p_clear_tombstone then false else tombstone end,
         deleted_at = case when p_clear_tombstone then null else deleted_at end,
         updated_at = now()
   where user_id = p_user_id
   returning * into v_state;

  return jsonb_build_object('ok', true, 'count', v_count, 'revision', v_state.revision,
    'deletion_generation', v_state.deletion_generation, 'tombstone', v_state.tombstone);
end;
$$;

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
begin
  v_state := public.valorae_sync_assert_state(p_user_id, p_expected_revision, p_expected_deletion_generation, p_expected_tombstone, p_clear_tombstone, p_action_created_at);

  delete from public.valorae_transactions
   where user_id = p_user_id and ticker = any(coalesce(p_symbols, array[]::text[]));
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
     and r->>'ticker' = any(coalesce(p_symbols, array[]::text[]))
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
    updated_at = now();
  get diagnostics v_count = row_count;

  if p_backup is not null then
    insert into public.valorae_sync_backups(user_id, backup_kind, source, payload, payload_size_bytes, metadata, created_at, updated_at)
    values (p_user_id, 'transactions_replace', 'valorae-proxy-rpc', p_backup, octet_length(p_backup::text),
      jsonb_build_object('count', v_count, 'deleted', v_deleted, 'reason', p_reason, 'symbols', p_symbols), now(), now());
  end if;

  update public.valorae_sync_user_state
     set revision = revision + 1,
         tombstone = case when p_clear_tombstone then false else tombstone end,
         deleted_at = case when p_clear_tombstone then null else deleted_at end,
         updated_at = now()
   where user_id = p_user_id
   returning * into v_state;

  return jsonb_build_object('ok', true, 'count', v_count, 'deleted', v_deleted,
    'revision', v_state.revision, 'deletion_generation', v_state.deletion_generation, 'tombstone', v_state.tombstone);
end;
$$;

create or replace function public.valorae_sync_upsert_snapshots(
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
begin
  v_state := public.valorae_sync_assert_state(p_user_id, p_expected_revision, p_expected_deletion_generation, p_expected_tombstone, p_clear_tombstone, p_action_created_at);

  insert into public.valorae_user_snapshots(
    user_id, domain, snapshot_key, schema_version, app_version, device_id, source,
    cache_scope, cache_ttl_seconds, expires_at, source_updated_at, etag,
    payload_size_bytes, encrypted, payload, payload_ciphertext, updated_at
  )
  select p_user_id, r->>'domain', r->>'snapshot_key',
         coalesce((r->>'schema_version')::integer, 3), r->>'app_version', r->>'device_id', r->>'source',
         coalesce(r->>'cache_scope', 'user'), nullif(r->>'cache_ttl_seconds', '')::integer,
         nullif(r->>'expires_at', '')::timestamptz, nullif(r->>'source_updated_at', '')::timestamptz,
         r->>'etag', nullif(r->>'payload_size_bytes', '')::integer,
         coalesce((r->>'encrypted')::boolean, false), r->'payload', r->>'payload_ciphertext', now()
    from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) r
   where nullif(r->>'domain', '') is not null and nullif(r->>'snapshot_key', '') is not null
  on conflict (user_id, domain, snapshot_key) do update set
    schema_version = excluded.schema_version,
    app_version = excluded.app_version,
    device_id = excluded.device_id,
    source = excluded.source,
    cache_scope = excluded.cache_scope,
    cache_ttl_seconds = excluded.cache_ttl_seconds,
    expires_at = excluded.expires_at,
    source_updated_at = excluded.source_updated_at,
    etag = excluded.etag,
    payload_size_bytes = excluded.payload_size_bytes,
    encrypted = excluded.encrypted,
    payload = excluded.payload,
    payload_ciphertext = excluded.payload_ciphertext,
    updated_at = now();
  get diagnostics v_count = row_count;

  if p_backup is not null then
    insert into public.valorae_sync_backups(user_id, backup_kind, source, payload, payload_size_bytes, metadata, created_at, updated_at)
    values (p_user_id, 'snapshots_batch', 'valorae-proxy-rpc', p_backup, octet_length(p_backup::text), jsonb_build_object('count', v_count), now(), now());
  end if;

  update public.valorae_sync_user_state
     set revision = revision + 1,
         tombstone = case when p_clear_tombstone then false else tombstone end,
         deleted_at = case when p_clear_tombstone then null else deleted_at end,
         updated_at = now()
   where user_id = p_user_id
   returning * into v_state;

  return jsonb_build_object('ok', true, 'count', v_count, 'revision', v_state.revision,
    'deletion_generation', v_state.deletion_generation, 'tombstone', v_state.tombstone);
end;
$$;

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
begin
  v_state := public.valorae_sync_assert_state(p_user_id, p_expected_revision, p_expected_deletion_generation, p_expected_tombstone, p_clear_tombstone, p_action_created_at);

  insert into public.valorae_dividend_events(
    user_id, event_key, ticker, date_com, payment_date, value_per_share,
    quantity, estimated_amount, status, category, source, payload, updated_at
  )
  select p_user_id, r->>'event_key', r->>'ticker', r->>'date_com', r->>'payment_date',
         coalesce((r->>'value_per_share')::numeric, 0), coalesce((r->>'quantity')::numeric, 0),
         coalesce((r->>'estimated_amount')::numeric, 0), r->>'status', r->>'category', r->>'source',
         coalesce(r->'payload', '{}'::jsonb), now()
    from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) r
   where nullif(r->>'event_key', '') is not null and nullif(r->>'ticker', '') is not null
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
    updated_at = now();
  get diagnostics v_count = row_count;

  if p_backup is not null then
    insert into public.valorae_sync_backups(user_id, backup_kind, source, payload, payload_size_bytes, metadata, created_at, updated_at)
    values (p_user_id, 'dividend_events', 'valorae-proxy-rpc', p_backup, octet_length(p_backup::text), jsonb_build_object('count', v_count), now(), now());
  end if;

  update public.valorae_sync_user_state
     set revision = revision + 1,
         tombstone = case when p_clear_tombstone then false else tombstone end,
         deleted_at = case when p_clear_tombstone then null else deleted_at end,
         updated_at = now()
   where user_id = p_user_id
   returning * into v_state;

  return jsonb_build_object('ok', true, 'count', v_count, 'revision', v_state.revision,
    'deletion_generation', v_state.deletion_generation, 'tombstone', v_state.tombstone);
end;
$$;

create or replace function public.valorae_sync_delete_user_data(
  p_user_id text,
  p_expected_revision bigint,
  p_expected_deletion_generation bigint,
  p_expected_tombstone boolean,
  p_reason text default 'portfolio_cleared'
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_state public.valorae_sync_user_state%rowtype;
  v_snapshots integer := 0;
  v_transactions integer := 0;
  v_dividends integer := 0;
  v_backups integer := 0;
begin
  v_state := public.valorae_sync_assert_state(p_user_id, p_expected_revision, p_expected_deletion_generation, p_expected_tombstone, false, null);

  delete from public.valorae_user_snapshots where user_id = p_user_id;
  get diagnostics v_snapshots = row_count;
  delete from public.valorae_transactions where user_id = p_user_id;
  get diagnostics v_transactions = row_count;
  delete from public.valorae_dividend_events where user_id = p_user_id;
  get diagnostics v_dividends = row_count;
  delete from public.valorae_sync_backups where user_id = p_user_id;
  get diagnostics v_backups = row_count;

  update public.valorae_sync_user_state
     set revision = revision + 1,
         deletion_generation = deletion_generation + 1,
         tombstone = true,
         deleted_at = now(),
         updated_at = now()
   where user_id = p_user_id
   returning * into v_state;

  return jsonb_build_object(
    'ok', true,
    'deleted', true,
    'reason', p_reason,
    'deleted_counts', jsonb_build_object(
      'snapshots', v_snapshots,
      'transactions', v_transactions,
      'dividends', v_dividends,
      'backups', v_backups
    ),
    'revision', v_state.revision,
    'deletion_generation', v_state.deletion_generation,
    'tombstone', v_state.tombstone,
    'deleted_at', v_state.deleted_at
  );
end;
$$;

revoke all on function public.valorae_sync_get_state(text) from public, anon, authenticated;
revoke all on function public.valorae_sync_assert_state(text,bigint,bigint,boolean,boolean,timestamptz) from public, anon, authenticated;
revoke all on function public.valorae_sync_upsert_transactions(text,jsonb,bigint,bigint,boolean,timestamptz,boolean,jsonb) from public, anon, authenticated;
revoke all on function public.valorae_sync_replace_transactions(text,text[],jsonb,bigint,bigint,boolean,timestamptz,boolean,text,jsonb) from public, anon, authenticated;
revoke all on function public.valorae_sync_upsert_snapshots(text,jsonb,bigint,bigint,boolean,timestamptz,boolean,jsonb) from public, anon, authenticated;
revoke all on function public.valorae_sync_upsert_dividends(text,jsonb,bigint,bigint,boolean,timestamptz,boolean,jsonb) from public, anon, authenticated;
revoke all on function public.valorae_sync_delete_user_data(text,bigint,bigint,boolean,text) from public, anon, authenticated;

grant execute on function public.valorae_sync_get_state(text) to service_role;
grant execute on function public.valorae_sync_upsert_transactions(text,jsonb,bigint,bigint,boolean,timestamptz,boolean,jsonb) to service_role;
grant execute on function public.valorae_sync_replace_transactions(text,text[],jsonb,bigint,bigint,boolean,timestamptz,boolean,text,jsonb) to service_role;
grant execute on function public.valorae_sync_upsert_snapshots(text,jsonb,bigint,bigint,boolean,timestamptz,boolean,jsonb) to service_role;
grant execute on function public.valorae_sync_upsert_dividends(text,jsonb,bigint,bigint,boolean,timestamptz,boolean,jsonb) to service_role;
grant execute on function public.valorae_sync_delete_user_data(text,bigint,bigint,boolean,text) to service_role;

comment on table public.valorae_sync_user_state is 'Revisão global, geração de exclusão e tombstone por usuário VALORAE.';
notify pgrst, 'reload schema';
