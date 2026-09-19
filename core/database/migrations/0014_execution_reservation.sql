-- ZENITH persistent execution reservation boundary.
-- This is a reservation gate, not a second authorization authority.
-- Current policy remains delegated to core.authorize_capability(...).

create or replace function operations.reserve_execution(
  p_operation_id uuid
)
returns table (
  allowed boolean,
  decision text,
  operation_id uuid,
  state text,
  attempt_count integer
)
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_operation operations.operations;
  v_auth record;
begin
  select * into v_operation
  from operations.operations o
  where o.id = p_operation_id
    and o.organisation_id = core.current_organisation_id()
  for update;

  if v_operation.id is null then
    return query select false, 'deny_missing', p_operation_id, null::text, null::integer;
    return;
  end if;

  if v_operation.state <> 'queued' then
    return query select false, 'deny_state', v_operation.id, v_operation.state, v_operation.attempt_count;
    return;
  end if;

  if v_operation.expires_at <= clock_timestamp() then
    return query select false, 'expired', v_operation.id, v_operation.state, v_operation.attempt_count;
    return;
  end if;

  if v_operation.not_before is not null and v_operation.not_before > clock_timestamp() then
    return query select false, 'not_ready', v_operation.id, v_operation.state, v_operation.attempt_count;
    return;
  end if;

  select * into v_auth
  from core.authorize_capability(v_operation.action, v_operation.resource_id, v_operation.purpose);

  if not coalesce(v_auth.allowed, false) then
    return query select false, coalesce(v_auth.decision, 'deny_policy'), v_operation.id, v_operation.state, v_operation.attempt_count;
    return;
  end if;

  update operations.operations o
     set state = 'in_flight',
         attempt_count = o.attempt_count + 1,
         updated_at = clock_timestamp()
   where o.id = v_operation.id
     and o.organisation_id = core.current_organisation_id()
     and o.state = 'queued'
     and o.expires_at > clock_timestamp()
     and (o.not_before is null or o.not_before <= clock_timestamp())
  returning o.id, o.state, o.attempt_count into operation_id, state, attempt_count;

  if operation_id is null then
    return query select false, 'operation_transition_conflict', v_operation.id, v_operation.state, v_operation.attempt_count;
    return;
  end if;

  return query select true, 'allow', operation_id, state, attempt_count;
end;
$$;

revoke execute on function operations.reserve_execution(uuid) from public;
grant execute on function operations.reserve_execution(uuid) to authenticated;

comment on function operations.reserve_execution(uuid) is 'Atomic execution reservation after current canonical authorization; not an authorization authority and not a lease store.';
