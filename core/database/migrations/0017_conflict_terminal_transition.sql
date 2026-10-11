-- Conflict is terminal in the ordinary lifecycle. Reconciliation creates a
-- new derived operation; it does not silently resurrect the conflicted operation.
-- Keep the database transition gate aligned with the canonical TypeScript graph.
create or replace function operations.transition(
  p_operation_id uuid,
  p_expected_state text,
  p_next_state text
)
returns operations.operations
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_row operations.operations;
begin
  if p_expected_state is null or p_next_state is null then
    raise exception 'invalid_operation_transition:missing_state';
  end if;

  if p_next_state = 'expired' then
    if clock_timestamp() < (select o.expires_at from operations.operations o where o.id = p_operation_id) then
      raise exception 'operation_not_expired';
    end if;
  elsif exists (
    select 1 from operations.operations o
    where o.id = p_operation_id
      and o.expires_at <= clock_timestamp()
      and o.state <> 'expired'
  ) then
    raise exception 'operation_expired';
  end if;

  if not (
    (p_expected_state='created' and p_next_state in ('authorized','rejected','cancelled')) or
    (p_expected_state='authorized' and p_next_state in ('queued','rejected','cancelled','expired')) or
    (p_expected_state='queued' and p_next_state in ('in_flight','cancelled','expired','blocked')) or
    (p_expected_state='in_flight' and p_next_state in ('acknowledged','retry_wait','conflict','blocked','expired','rejected')) or
    (p_expected_state='acknowledged' and p_next_state='completed') or
    (p_expected_state='retry_wait' and p_next_state in ('queued','expired','blocked','cancelled')) or
    (p_expected_state='blocked' and p_next_state in ('queued','cancelled','expired','rejected')) or
    (p_expected_state='conflict' and p_next_state in ('cancelled','rejected'))
  ) then
    raise exception 'invalid_operation_transition:%->%', p_expected_state, p_next_state;
  end if;

  update operations.operations
     set state = p_next_state,
         attempt_count = case when p_next_state = 'in_flight' then attempt_count + 1 else attempt_count end,
         updated_at = now()
   where id = p_operation_id
     and organisation_id = core.current_organisation_id()
     and state = p_expected_state
     and (
       p_next_state = 'expired'
       or expires_at > clock_timestamp()
     )
  returning * into v_row;

  if v_row.id is null then
    raise exception 'operation_transition_conflict';
  end if;

  return v_row;
end;
$$;

revoke execute on function operations.transition(uuid,text,text) from public;
grant execute on function operations.transition(uuid,text,text) to authenticated;

comment on function operations.transition(uuid,text,text) is
  'Tenant-scoped compare-and-set lifecycle transition. Conflict cannot return to queued; reconciliation must create a new derived operation.';
