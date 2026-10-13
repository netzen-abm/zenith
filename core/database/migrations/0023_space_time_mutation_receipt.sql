-- Persist the spatial mutation result on its request so a process interruption
-- after mutation commit but before outcome recording can be reconciled safely.
set lock_timeout = '5s';

alter table core.space_time_representation_requests
  add column if not exists representation_id uuid
  references core.spatial_representations(id) on delete restrict;

create or replace function core_private.consume_space_time_representation_request(
  p_request_id uuid
)
returns table (
  representation_id uuid,
  decision text
)
language plpgsql
volatile
security definer
set search_path = ''
as $space_time_consume$
declare
  v_request core.space_time_representation_requests%rowtype;
  v_id uuid;
begin
  select *
    into v_request
    from core.space_time_representation_requests
   where id = p_request_id
     and organisation_id = core.current_organisation_id()
     and identity_id = core.current_identity_id()
   for update;

  if v_request.id is null then
    return query select null::uuid, 'request_not_found';
    return;
  end if;

  -- A consumed request is a durable receipt for the mutation. Return the
  -- original representation; never execute the INSERT a second time.
  if v_request.status = 'consumed' then
    if v_request.representation_id is null then
      raise exception 'space_time_consumed_request_missing_representation';
    end if;
    return query select v_request.representation_id, 'already_consumed';
    return;
  end if;

  if v_request.status <> 'pending' then
    return query select null::uuid, 'request_not_pending';
    return;
  end if;

  if not core.can_write_resource(v_request.resource_id) then
    return query select null::uuid, 'deny_policy';
    return;
  end if;

  if v_request.source_evidence_id is not null
     and not exists (
       select 1 from core.evidence e
        where e.id = v_request.source_evidence_id
          and e.resource_id = v_request.resource_id
     ) then
    return query select null::uuid, 'evidence_scope_mismatch';
    return;
  end if;

  insert into core.spatial_representations(
    resource_id, representation_type, geom, precision_level,
    coordinate_confidence, source_evidence_id
  ) values (
    v_request.resource_id, v_request.representation_type, v_request.geom,
    v_request.precision_level, v_request.coordinate_confidence,
    v_request.source_evidence_id
  )
  returning id into v_id;

  update core.space_time_representation_requests
     set status = 'consumed',
         representation_id = v_id,
         consumed_at = clock_timestamp()
   where id = v_request.id;

  return query select v_id, 'created';
end
$space_time_consume$;

revoke execute on function core_private.consume_space_time_representation_request(uuid) from public;
revoke execute on function core_private.consume_space_time_representation_request(uuid) from anon;
grant execute on function core_private.consume_space_time_representation_request(uuid) to authenticated;

comment on column core.space_time_representation_requests.representation_id is
  'Durable receipt for the created spatial representation, enabling safe recovery if outcome recording is interrupted.';
