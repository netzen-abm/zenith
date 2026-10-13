-- Space-Time idempotency: resolve immutable operation identity by a canonical
-- SHA-256 request hash. Historical migrations remain unchanged.
set lock_timeout = '5s';

alter table operations.operations
  add column if not exists payload_hash text;

alter table core.space_time_representation_requests
  add column if not exists payload_hash text;

do $operations_hash_constraint$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'operations.operations'::regclass
      and conname = 'operations_payload_hash_sha256_check'
  ) then
    alter table operations.operations
      add constraint operations_payload_hash_sha256_check
      check (payload_hash is null or payload_hash ~ '^[0-9a-f]{64}$');
  end if;
end
$operations_hash_constraint$;

do $request_hash_constraint$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'core.space_time_representation_requests'::regclass
      and conname = 'space_time_request_payload_hash_check'
  ) then
    alter table core.space_time_representation_requests
      add constraint space_time_request_payload_hash_check
      check (payload_hash is null or payload_hash ~ '^[0-9a-f]{64}$');
  end if;
end
$request_hash_constraint$;

create or replace function operations.create_or_get_with_payload_hash(
  p_operation_id uuid,
  p_organisation_id uuid,
  p_idempotency_key text,
  p_action text,
  p_identity_id uuid,
  p_purpose text,
  p_expires_at timestamptz,
  p_resource_id uuid,
  p_payload_ref text,
  p_payload_hash text
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
  payload_ref text,
  payload_hash text
)
language plpgsql
volatile
security definer
set search_path = ''
as $function$
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
     or core.current_organisation_id() is null
     or p_payload_hash is null or p_payload_hash !~ '^[0-9a-f]{64}$'
     or p_resource_id is null
     or p_payload_ref is null or btrim(p_payload_ref) = '' then
    raise exception 'operation_create_invalid_context';
  end if;

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
       or v_operation.resource_id is distinct from p_resource_id
       or v_operation.payload_hash is distinct from p_payload_hash then
      raise exception 'operation_idempotency_conflict';
    end if;
    return query select false, v_operation.id, v_operation.organisation_id,
      v_operation.idempotency_key, v_operation.action, v_operation.identity_id,
      v_operation.purpose, v_operation.state, v_operation.created_at,
      v_operation.expires_at, v_operation.attempt_count, v_operation.payload_ref,
      v_operation.payload_hash;
    return;
  end if;

  if p_action <> 'space_time.spatial_representation_create' then
    raise exception 'operation_action_not_supported';
  end if;

  insert into operations.operations(
    id, organisation_id, identity_id, idempotency_key, action, resource_id,
    purpose, state, created_at, expires_at, attempt_count, payload_ref, payload_hash
  ) values (
    p_operation_id, p_organisation_id, p_identity_id, p_idempotency_key, p_action,
    p_resource_id, p_purpose, 'created', clock_timestamp(), p_expires_at, 0,
    p_payload_ref, p_payload_hash
  ) returning * into v_operation;

  return query select true, v_operation.id, v_operation.organisation_id,
    v_operation.idempotency_key, v_operation.action, v_operation.identity_id,
    v_operation.purpose, v_operation.state, v_operation.created_at,
    v_operation.expires_at, v_operation.attempt_count, v_operation.payload_ref,
    v_operation.payload_hash;
end
$function$;

revoke all on function operations.create_or_get_with_payload_hash(uuid,uuid,text,text,uuid,text,timestamptz,uuid,text,text) from public, anon;
grant execute on function operations.create_or_get_with_payload_hash(uuid,uuid,text,text,uuid,text,timestamptz,uuid,text,text) to authenticated;

comment on function operations.create_or_get_with_payload_hash(uuid,uuid,text,text,uuid,text,timestamptz,uuid,text,text) is
  'Canonical tenant-scoped Space-Time operation resolver. Serializes idempotency-key creation and rejects reuse with a different resource or SHA-256 payload identity.';
