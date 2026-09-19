-- Durable execution outcome + audit/outbox boundary.
-- Execution outcomes are server-written; authenticated clients do not receive
-- direct INSERT/UPDATE privileges. The transaction below atomically records
-- the handler outcome, advances the operation lifecycle, and creates an
-- auditable outbox event.
create table if not exists operations.execution_outcomes (
  id uuid primary key default gen_random_uuid(),
  operation_id uuid not null references operations.operations(id) on delete restrict,
  attempt_count integer not null check (attempt_count >= 1),
  outcome text not null check (outcome in ('acknowledged','completed','retry_wait','conflict','rejected')),
  error_code text,
  result_ref text,
  result_hash text,
  occurred_at timestamptz not null default clock_timestamp(),
  recorded_at timestamptz not null default clock_timestamp(),
  unique (operation_id, attempt_count),
  check (error_code is null or length(error_code) between 1 and 128),
  check (result_ref is null or length(result_ref) between 1 and 1024),
  check (result_hash is null or length(result_hash) between 1 and 256)
);

create table if not exists operations.execution_outbox (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references core.organisations(id) on delete restrict,
  operation_id uuid not null references operations.operations(id) on delete restrict,
  outcome_id uuid not null references operations.execution_outcomes(id) on delete restrict,
  event_type text not null check (event_type in ('execution_outcome_recorded')),
  event_version integer not null default 1 check (event_version > 0),
  aggregate_hash text not null,
  payload_ref text,
  created_at timestamptz not null default clock_timestamp(),
  published_at timestamptz,
  unique (outcome_id),
  check (length(aggregate_hash) between 1 and 256),
  check (payload_ref is null or length(payload_ref) between 1 and 1024)
);

alter table operations.execution_outcomes enable row level security;
alter table operations.execution_outcomes force row level security;
alter table operations.execution_outbox enable row level security;
alter table operations.execution_outbox force row level security;

create policy execution_outcomes_tenant_select
on operations.execution_outcomes
for select
to authenticated
using (
  exists (
    select 1 from operations.operations o
    where o.id = execution_outcomes.operation_id
      and o.organisation_id = core.current_organisation_id()
  )
);

create policy execution_outbox_tenant_select
on operations.execution_outbox
for select
to authenticated
using (organisation_id = core.current_organisation_id());

revoke all on operations.execution_outcomes from public, authenticated;
revoke all on operations.execution_outbox from public, authenticated;
grant select on operations.execution_outcomes to authenticated;
grant select on operations.execution_outbox to authenticated;

create or replace function operations.record_execution_outcome(
  p_operation_id uuid,
  p_attempt_count integer,
  p_outcome text,
  p_error_code text default null,
  p_result_ref text default null,
  p_result_hash text default null,
  p_occurred_at timestamptz default clock_timestamp()
)
returns table (
  recorded boolean,
  decision text,
  operation_id uuid,
  outcome_id uuid,
  state text,
  attempt_count integer
)
language plpgsql
security invoker
volatile
set search_path = ''
as $$
declare
  v_operation operations.operations%rowtype;
  v_outcome_id uuid;
  v_hash text;
  v_new_state text;
begin
  select * into v_operation
  from operations.operations
  where id = p_operation_id
    and organisation_id = core.current_organisation_id()
  for update;

  if not found then
    return query select false, 'operation_not_found'::text, p_operation_id, null::uuid, null::text, null::integer;
    return;
  end if;

  if v_operation.state <> 'in_flight' then
    return query select false, 'operation_not_in_flight'::text, v_operation.id, null::uuid, v_operation.state, v_operation.attempt_count;
    return;
  end if;

  if v_operation.attempt_count <> p_attempt_count then
    return query select false, 'attempt_conflict'::text, v_operation.id, null::uuid, v_operation.state, v_operation.attempt_count;
    return;
  end if;

  v_new_state := case p_outcome
    when 'acknowledged' then 'acknowledged'
    when 'completed' then 'completed'
    when 'retry_wait' then 'retry_wait'
    when 'conflict' then 'conflict'
    when 'rejected' then 'rejected'
    else null
  end;

  if v_new_state is null then
    return query select false, 'invalid_outcome'::text, v_operation.id, null::uuid, v_operation.state, v_operation.attempt_count;
    return;
  end if;

  if exists (
    select 1 from operations.execution_outcomes eo
    where eo.operation_id = v_operation.id
      and eo.attempt_count = p_attempt_count
  ) then
    return query select false, 'duplicate_outcome'::text, v_operation.id, null::uuid, v_operation.state, v_operation.attempt_count;
    return;
  end if;

  insert into operations.execution_outcomes(
    operation_id, attempt_count, outcome, error_code, result_ref, result_hash, occurred_at
  ) values (
    v_operation.id, p_attempt_count, p_outcome, p_error_code, p_result_ref, p_result_hash, p_occurred_at
  )
  returning id into v_outcome_id;

  v_hash := md5(
    v_operation.id::text || '|' ||
    p_attempt_count::text || '|' ||
    p_outcome || '|' ||
    coalesce(p_error_code,'') || '|' ||
    coalesce(p_result_hash,'')
  );

  update operations.operations
  set state = v_new_state, updated_at = clock_timestamp()
  where id = v_operation.id
    and state = 'in_flight'
    and attempt_count = p_attempt_count;

  if not found then
    raise exception 'operation_outcome_transition_conflict';
  end if;

  insert into operations.execution_outbox(
    organisation_id, operation_id, outcome_id, event_type, aggregate_hash, payload_ref
  ) values (
    v_operation.organisation_id, v_operation.id, v_outcome_id,
    'execution_outcome_recorded', v_hash, p_result_ref
  );

  return query select true, 'recorded'::text, v_operation.id, v_outcome_id, v_new_state, p_attempt_count;
exception
  when unique_violation then
    return query select false, 'duplicate_outcome'::text, p_operation_id, null::uuid, v_operation.state, v_operation.attempt_count;
end;
$$;

revoke all on function operations.record_execution_outcome(uuid,integer,text,text,text,text,timestamptz) from public, authenticated;
