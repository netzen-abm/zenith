-- Atomic create-or-resolve by tenant-scoped idempotency key.
-- This is operation persistence, not authorization policy.
create or replace function operations.create_or_get(
  p_operation_id uuid,
  p_organisation_id uuid,
  p_idempotency_key text,
  p_action text,
  p_identity_id uuid,
  p_purpose text,
  p_expires_at timestamptz,
  p_payload_ref text default null
)
returns table (
  created boolean,
  operation_id uuid,
  organisation_id uuid,
  idempotency_key text,
  action text,
  identity_id uuid,
  purpose text,
  state text,
  created_at timestamptz,
  expires_at timestamptz,
  attempt_count integer,
  payload_ref text
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_operation operations.operations%rowtype;
begin
  if p_operation_id is null
     or p_idempotency_key is null or btrim(p_idempotency_key) = ''
     or p_action is null or btrim(p_action) = ''
     or p_purpose is null or btrim(p_purpose) = ''
     or p_expires_at is null or p_expires_at <= clock_timestamp()
     or p_identity_id is distinct from core.current_identity_id()
     or p_organisation_id is distinct from core.current_organisation_id()
     or core.current_organisation_id() is null then
    raise exception 'operation_create_invalid_context';
  end if;

  -- Serialize same-key creation even when no row exists yet.
  perform pg_advisory_xact_lock(hashtextextended(
    core.current_organisation_id()::text || ':' || p_idempotency_key, 0
  ));

  select * into v_operation
  from operations.operations o
  where o.organisation_id = core.current_organisation_id()
    and o.idempotency_key = p_idempotency_key
  for update;

  if found then
    if v_operation.action is distinct from p_action
       or v_operation.identity_id is distinct from p_identity_id
       or v_operation.purpose is distinct from p_purpose
       or v_operation.payload_ref is distinct from p_payload_ref then
      raise exception 'operation_idempotency_conflict';
    end if;
    return query select false, v_operation.id, v_operation.organisation_id, v_operation.idempotency_key,
      v_operation.action, v_operation.identity_id, v_operation.purpose,
      v_operation.state, v_operation.created_at, v_operation.expires_at,
      v_operation.attempt_count, v_operation.payload_ref;
    return;
  end if;

  insert into operations.operations(
    id, organisation_id, identity_id, idempotency_key, action, purpose,
    state, created_at, expires_at, attempt_count, payload_ref
  ) values (
    p_operation_id, p_organisation_id, p_identity_id,
    p_idempotency_key, p_action, p_purpose, 'created',
    clock_timestamp(), p_expires_at, 0, p_payload_ref
  ) returning * into v_operation;

  return query select true, v_operation.id, v_operation.organisation_id, v_operation.idempotency_key,
    v_operation.action, v_operation.identity_id, v_operation.purpose,
    v_operation.state, v_operation.created_at, v_operation.expires_at,
    v_operation.attempt_count, v_operation.payload_ref;
end;
$$;

revoke all on function operations.create_or_get(uuid,uuid,text,text,uuid,text,timestamptz,text) from public, authenticated;
grant execute on function operations.create_or_get(uuid,text,text,uuid,text,timestamptz,text) to authenticated;

comment on function operations.create_or_get(uuid,text,text,uuid,text,timestamptz,text) is
  'Atomically creates or resolves the canonical tenant-scoped operation identity after validating the supplied tenant against authenticated context. Reusing a key with different immutable request identity fails closed. Does not authorize or execute.';
