-- VALORAE 2026-07-25 — parte 04/11
-- Estado revisionado e proteção contra concorrência/tombstone.

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
  select * into v_state
    from public.valorae_sync_user_state
   where user_id = p_user_id;
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
  if nullif(trim(p_user_id), '') is null then
    raise exception using errcode = '22023', message = 'INVALID_SYNC_IDENTITY';
  end if;

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
    if p_action_created_at is null
       or v_state.deleted_at is null
       or p_action_created_at <= v_state.deleted_at then
      raise exception using errcode = '40001', message = 'SYNC_STALE_AFTER_DELETE';
    end if;
  end if;
  return v_state;
end;
$$;
