set lock_timeout = '5s';

create table if not exists core.space_time_representation_requests (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references core.organisations(id) on delete restrict,
  identity_id uuid not null references core.identities(id) on delete restrict,
  resource_id uuid not null references core.resources(id) on delete restrict,
  representation_type text not null,
  geom geometry(Geometry,4326),
  precision_level text not null,
  coordinate_confidence numeric,
  source_evidence_id uuid references core.evidence(id) on delete set null,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  consumed_at timestamptz,
  constraint st_request_precision_check check (precision_level = any (array['exact','generalized','regional','unknown'])),
  constraint st_request_confidence_check check (coordinate_confidence is null or (coordinate_confidence >= 0 and coordinate_confidence <= 1)),
  constraint st_request_status_check check (status in ('pending','consumed','rejected'))
);

create index if not exists st_request_actor_idx
  on core.space_time_representation_requests(organisation_id, identity_id, status);

alter table core.space_time_representation_requests enable row level security;
alter table core.space_time_representation_requests force row level security;

drop policy if exists st_request_select on core.space_time_representation_requests;
drop policy if exists st_request_insert on core.space_time_representation_requests;

create policy st_request_select
  on core.space_time_representation_requests for select to authenticated
  using (
    organisation_id = core.current_organisation_id()
    and identity_id = core.current_identity_id()
  );

create policy st_request_insert
  on core.space_time_representation_requests for insert to authenticated
  with check (
    organisation_id = core.current_organisation_id()
    and identity_id = core.current_identity_id()
    and core.can_write_resource(resource_id)
  );

grant select, insert on core.space_time_representation_requests to authenticated;

revoke insert, update, delete on core.spatial_representations from authenticated;

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
as $$
declare
  v_request core.space_time_representation_requests;
  v_id uuid;
begin
  select *
    into v_request
    from core.space_time_representation_requests
   where id = p_request_id
     and organisation_id = core.current_organisation_id()
     and identity_id = core.current_identity_id()
     and status = 'pending'
   for update;

  if v_request.id is null then
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
     set status = 'consumed', consumed_at = clock_timestamp()
   where id = v_request.id;

  return query select v_id, 'created';
end;
$$;

revoke execute on function core_private.consume_space_time_representation_request(uuid) from public;
revoke execute on function core_private.consume_space_time_representation_request(uuid) from anon;
grant execute on function core_private.consume_space_time_representation_request(uuid) to authenticated;

comment on table core.space_time_representation_requests is
  'Durable Space-Time mutation request. Exact geometry is protected by the normal resource authorization boundary.';
comment on function core_private.consume_space_time_representation_request(uuid) is
  'Canonical protected spatial mutation boundary; capability policy remains external.';
