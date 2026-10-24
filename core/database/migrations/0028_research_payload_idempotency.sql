-- Bind Research operations to immutable query identity before any handler can run.
-- Reuse the canonical operation resolver and payload_hash storage already used by
-- Space-Time; do not add another idempotency store or execution coordinator.
set lock_timeout = '5s';

-- Backfill older Research operations only when their tenant, identity, purpose, idempotency
-- key, payload reference, and persisted query agree. Unverifiable operations remain unhashed.
update operations.operations o
set payload_hash = encode(public.digest(convert_to(jsonb_build_object(
  'action', 'research.query',
  'organisationId', lower(q.organisation_id::text),
  'identityId', lower(q.identity_id::text),
  'purpose', q.purpose,
  'resourceId', null,
  'queryId', lower(q.id::text),
  'researchQuestionId', lower(q.research_question_id::text),
  'intent', q.intent,
  'text', q.query_text,
  'concepts', q.concepts,
  'filters', q.filters,
  'sort', q.sort,
  'pageSize', q.page_size,
  'cursor', q.cursor,
  'requestedFields', q.requested_fields,
  'openAccessRequired', q.open_access_required,
  'requesterIdentityId', lower(q.identity_id::text)
)::text, 'UTF8'), 'sha256'), 'hex')
from core.research_query_requests q
where o.action = 'research.query'
  and o.payload_hash is null
  and o.organisation_id = q.organisation_id
  and o.identity_id = q.identity_id
  and o.purpose = q.purpose
  and lower(btrim(o.idempotency_key)) = lower(q.id::text)
  and lower(btrim(o.payload_ref)) = lower(q.id::text);

-- Do not silently collapse pre-existing case/whitespace variants of the same key.
do $research_idempotency_key_guard$
begin
  if exists (
    select 1
    from operations.operations
    where action = 'research.query'
    group by organisation_id, lower(btrim(idempotency_key))
    having count(*) > 1
  ) then
    raise exception 'research_idempotency_key_normalization_collision_requires_manual_resolution';
  end if;
end
$research_idempotency_key_guard$;

create unique index if not exists operations_research_idempotency_normalized_uq
  on operations.operations (organisation_id, lower(btrim(idempotency_key)))
  where action = 'research.query';

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
  p_payload_identity jsonb
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
  v_payload_hash text;
  v_match_count integer;
begin
  if p_operation_id is null
     or p_idempotency_key is null or btrim(p_idempotency_key) = ''
     or p_action is null or btrim(p_action) = ''
     or p_purpose is null or btrim(p_purpose) = ''
     or p_expires_at is null or p_expires_at <= clock_timestamp()
     or p_identity_id is distinct from core.current_identity_id()
     or p_organisation_id is distinct from core.current_organisation_id()
     or core.current_organisation_id() is null
     or p_payload_ref is null or btrim(p_payload_ref) = ''
     or p_payload_identity is null or jsonb_typeof(p_payload_identity) <> 'object'
     or p_payload_identity->>'action' is distinct from p_action
     or p_payload_identity->>'organisationId' is distinct from p_organisation_id::text
     or p_payload_identity->>'identityId' is distinct from p_identity_id::text
     or p_payload_identity->>'purpose' is distinct from p_purpose
     or p_payload_identity->>'resourceId' is distinct from p_resource_id::text then
    raise exception 'operation_create_invalid_context';
  end if;

  if p_action = 'research.query' then
    if p_resource_id is not null
       or lower(btrim(p_idempotency_key)) is distinct from lower(btrim(p_payload_ref))
       or p_payload_identity->>'queryId' is distinct from lower(btrim(p_payload_ref)) then
      raise exception 'research_payload_identity_invalid';
    end if;
  elsif p_action = 'space_time.spatial_representation_create' then
    if p_resource_id is null then
      raise exception 'operation_payload_identity_requires_resource_id';
    end if;
  else
    raise exception 'operation_action_not_supported';
  end if;

  v_payload_hash := encode(public.digest(convert_to(p_payload_identity::text, 'UTF8'), 'sha256'), 'hex');

  perform pg_advisory_xact_lock(hashtextextended(
    core.current_organisation_id()::text || ':' ||
      (case when p_action = 'research.query' then lower(btrim(p_idempotency_key)) else p_idempotency_key end),
    0
  ));

  if p_action = 'research.query' then
    select count(*) into v_match_count
      from operations.operations o
     where o.organisation_id = core.current_organisation_id()
       and lower(btrim(o.idempotency_key)) = lower(btrim(p_idempotency_key));
    if v_match_count > 1 then
      raise exception 'operation_idempotency_conflict_multiple_matches';
    end if;
  end if;

  select * into v_operation
  from operations.operations o
  where o.organisation_id = core.current_organisation_id()
    and (
      (p_action = 'research.query' and lower(btrim(o.idempotency_key)) = lower(btrim(p_idempotency_key)))
      or (p_action <> 'research.query' and o.idempotency_key = p_idempotency_key)
    )
  for update;

  if found then
    if p_action = 'research.query'
       and v_operation.action = p_action
       and v_operation.payload_hash is null
       and v_operation.state = 'created'
       and v_operation.attempt_count = 0
       and lower(btrim(coalesce(v_operation.payload_ref, ''))) = lower(btrim(p_payload_ref))
       and not exists (
         select 1 from core.research_query_requests q
          where lower(q.id::text) = lower(btrim(p_payload_ref))
       )
       and not exists (
         select 1 from operations.execution_outcomes eo
          where eo.operation_id = v_operation.id
       )
       and not exists (
         select 1 from operations.execution_outbox ob
          where ob.operation_id = v_operation.id
       ) then
      -- The old code could persist the operation before its query row. Bind a hash only
      -- for this provably unexecuted state; never bless an attempted/ambiguous operation.
      update operations.operations
         set payload_hash = v_payload_hash,
             payload_ref = lower(btrim(payload_ref))
       where id = v_operation.id
      returning * into v_operation;
    end if;

    if v_operation.action is distinct from p_action
       or v_operation.identity_id is distinct from p_identity_id
       or v_operation.purpose is distinct from p_purpose
       or v_operation.resource_id is distinct from p_resource_id
       or v_operation.payload_hash is distinct from v_payload_hash then
      raise exception 'operation_idempotency_conflict';
    end if;
    return query select false, v_operation.id, v_operation.organisation_id,
      v_operation.idempotency_key, v_operation.action, v_operation.identity_id,
      v_operation.purpose, v_operation.state, v_operation.created_at,
      v_operation.expires_at, v_operation.attempt_count, v_operation.payload_ref,
      v_operation.payload_hash;
    return;
  end if;

  insert into operations.operations(
    id, organisation_id, identity_id, idempotency_key, action, resource_id,
    purpose, state, created_at, expires_at, attempt_count, payload_ref, payload_hash
  ) values (
    p_operation_id, p_organisation_id, p_identity_id, p_idempotency_key, p_action,
    p_resource_id, p_purpose, 'created', clock_timestamp(), p_expires_at, 0,
    p_payload_ref, v_payload_hash
  ) returning * into v_operation;

  return query select true, v_operation.id, v_operation.organisation_id,
    v_operation.idempotency_key, v_operation.action, v_operation.identity_id,
    v_operation.purpose, v_operation.state, v_operation.created_at,
    v_operation.expires_at, v_operation.attempt_count, v_operation.payload_ref,
    v_operation.payload_hash;
end
$function$;

revoke all on function operations.create_or_get_with_payload_hash(uuid,uuid,text,text,uuid,text,timestamptz,uuid,text,jsonb) from public, anon;
grant execute on function operations.create_or_get_with_payload_hash(uuid,uuid,text,text,uuid,text,timestamptz,uuid,text,jsonb) to authenticated;

comment on function operations.create_or_get_with_payload_hash(uuid,uuid,text,text,uuid,text,timestamptz,uuid,text,jsonb) is
  'Canonical tenant-scoped operation resolver for Space-Time and Research. Computes SHA-256 from JSONB payload identity inside PostgreSQL, serializes idempotency-key creation, and rejects changed immutable payloads.';
