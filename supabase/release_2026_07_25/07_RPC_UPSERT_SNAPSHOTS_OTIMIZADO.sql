-- VALORAE 2026-07-25 — parte 07/11
-- Snapshots: não reescreve payload idêntico nem duplica backup.

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
  v_state_changed boolean := false;
begin
  v_state := public.valorae_sync_assert_state(
    p_user_id, p_expected_revision, p_expected_deletion_generation,
    p_expected_tombstone, p_clear_tombstone, p_action_created_at
  );

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
   where nullif(r->>'domain', '') is not null
     and nullif(r->>'snapshot_key', '') is not null
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
    updated_at = now()
  where row(
    valorae_user_snapshots.schema_version, valorae_user_snapshots.app_version,
    valorae_user_snapshots.device_id, valorae_user_snapshots.source,
    valorae_user_snapshots.cache_scope, valorae_user_snapshots.cache_ttl_seconds,
    valorae_user_snapshots.expires_at, valorae_user_snapshots.source_updated_at,
    valorae_user_snapshots.etag, valorae_user_snapshots.payload_size_bytes,
    valorae_user_snapshots.encrypted, valorae_user_snapshots.payload,
    valorae_user_snapshots.payload_ciphertext
  ) is distinct from row(
    excluded.schema_version, excluded.app_version, excluded.device_id, excluded.source,
    excluded.cache_scope, excluded.cache_ttl_seconds, excluded.expires_at,
    excluded.source_updated_at, excluded.etag, excluded.payload_size_bytes,
    excluded.encrypted, excluded.payload, excluded.payload_ciphertext
  );
  get diagnostics v_count = row_count;

  v_state_changed := v_count > 0 or (p_clear_tombstone and v_state.tombstone);
  if v_state_changed then
    update public.valorae_sync_user_state
       set revision = revision + 1,
           tombstone = case when p_clear_tombstone then false else tombstone end,
           deleted_at = case when p_clear_tombstone then null else deleted_at end,
           updated_at = now()
     where user_id = p_user_id
     returning * into v_state;
  end if;

  return jsonb_build_object(
    'ok', true, 'count', v_count, 'changed', v_state_changed,
    'revision', v_state.revision,
    'deletion_generation', v_state.deletion_generation,
    'tombstone', v_state.tombstone,
    'backup_ignored', p_backup is not null
  );
end;
$$;
