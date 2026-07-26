-- VALORAE Proxy v363 / APK v547
-- Restauração atômica do Histórico usando a mesma tabela canônica das RPCs de escrita.
-- Evita divergência entre tabela configurada no Proxy, paginação REST e tipo UUID/text da identidade.

create or replace function public.valorae_sync_restore_transactions(
  p_user_id text,
  p_legacy_user_id text default null,
  p_limit integer default 10000,
  p_offset integer default 0,
  p_read_fence timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 10000), 1), 10000);
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_read_fence timestamptz := coalesce(p_read_fence, clock_timestamp());
  v_rows jsonb := '[]'::jsonb;
  v_total bigint := 0;
  v_primary_count bigint := 0;
  v_legacy_count bigint := 0;
  v_state jsonb := jsonb_build_object(
    'revision', 0,
    'deletion_generation', 0,
    'tombstone', false,
    'deleted_at', null,
    'updated_at', null
  );
begin
  if nullif(trim(p_user_id), '') is null then
    raise exception using errcode = '22023', message = 'INVALID_SYNC_IDENTITY';
  end if;

  select jsonb_build_object(
    'revision', coalesce(s.revision, 0),
    'deletion_generation', coalesce(s.deletion_generation, 0),
    'tombstone', coalesce(s.tombstone, false),
    'deleted_at', s.deleted_at,
    'updated_at', s.updated_at
  )
  into v_state
  from public.valorae_sync_user_state s
  where s.user_id::text = p_user_id
  limit 1;

  v_state := coalesce(v_state, jsonb_build_object(
    'revision', 0,
    'deletion_generation', 0,
    'tombstone', false,
    'deleted_at', null,
    'updated_at', null
  ));

  if coalesce((v_state->>'tombstone')::boolean, false) then
    return jsonb_build_object(
      'ok', true,
      'transactions', '[]'::jsonb,
      'count', 0,
      'total_count', 0,
      'has_more', false,
      'next_offset', null,
      'read_fence', v_read_fence,
      'identity_source', 'supabase_user_id',
      'primary_count', 0,
      'legacy_count', 0,
      'sync_state', v_state,
      'restore_contract', 'history-restore-atomic-v1'
    );
  end if;

  with candidates as (
    select
      t.*,
      case when t.user_id::text = p_user_id then 0 else 1 end as identity_priority
    from public.valorae_transactions t
    where (
      t.user_id::text = p_user_id
      or (
        nullif(trim(coalesce(p_legacy_user_id, '')), '') is not null
        and t.user_id::text = trim(p_legacy_user_id)
      )
    )
    and coalesce(t.updated_at, '-infinity'::timestamptz) <= v_read_fence
  ), ranked as (
    select
      c.*,
      row_number() over (
        partition by coalesce(nullif(c.client_tx_id, ''), md5(concat_ws('|', c.user_id::text, c.ticker, c.transaction_date::text, c.quantity::text, c.purchase_price::text)))
        order by c.identity_priority asc, c.updated_at desc nulls last
      ) as identity_rank
    from candidates c
  ), canonical as (
    select * from ranked where identity_rank = 1
  ), page as (
    select *
    from canonical
    order by transaction_date desc nulls last, client_tx_id asc
    limit v_limit offset v_offset
  )
  select
    (select count(*) from canonical),
    (select count(*) from candidates where identity_priority = 0),
    (select count(*) from candidates where identity_priority = 1),
    coalesce(
      (select jsonb_agg(to_jsonb(p) - 'identity_priority' - 'identity_rank' order by p.transaction_date desc nulls last, p.client_tx_id asc) from page p),
      '[]'::jsonb
    )
  into v_total, v_primary_count, v_legacy_count, v_rows;

  return jsonb_build_object(
    'ok', true,
    'transactions', v_rows,
    'count', jsonb_array_length(v_rows),
    'total_count', v_total,
    'has_more', (v_offset + jsonb_array_length(v_rows)) < v_total,
    'next_offset', case when (v_offset + jsonb_array_length(v_rows)) < v_total then v_offset + jsonb_array_length(v_rows) else null end,
    'read_fence', v_read_fence,
    'identity_source', case
      when v_primary_count > 0 and v_legacy_count > 0 then 'supabase_user_id+legacy_verified_email'
      when v_primary_count > 0 then 'supabase_user_id'
      when v_legacy_count > 0 then 'legacy_verified_email'
      else 'supabase_user_id'
    end,
    'primary_count', v_primary_count,
    'legacy_count', v_legacy_count,
    'sync_state', v_state,
    'restore_contract', 'history-restore-atomic-v1'
  );
end;
$$;

revoke all on function public.valorae_sync_restore_transactions(text, text, integer, integer, timestamptz) from public, anon, authenticated;
grant execute on function public.valorae_sync_restore_transactions(text, text, integer, integer, timestamptz) to service_role;

comment on function public.valorae_sync_restore_transactions(text, text, integer, integer, timestamptz)
is 'Restaura o Histórico canônico de uma conta em uma leitura estável, conciliando UUID e e-mail legado sem depender da paginação REST do cliente.';
