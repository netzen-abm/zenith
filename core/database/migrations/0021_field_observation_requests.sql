set lock_timeout = '5s';

create table if not exists core.field_observation_requests (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references core.organisations(id) on delete restrict,
  identity_id uuid not null references core.identities(id) on delete restrict,
  evidence_id uuid not null references core.evidence(id) on delete restrict,
  observation_type text not null,
  value jsonb not null,
  method jsonb not null default '{}'::jsonb,
  observed_at timestamptz,
  uncertainty jsonb not null default '{}'::jsonb,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  consumed_at timestamptz,
  constraint field_request_status_check check (status in ('pending','consumed','rejected'))
);

create index if not exists field_request_actor_idx
  on core.field_observation_requests(organisation_id, identity_id, status);

alter table core.field_observation_requests enable row level security;
alter table core.field_observation_requests force row level security;

drop policy if exists field_request_select on core.field_observation_requests;
drop policy if exists field_request_insert on core.field_observation_requests;

create policy field_request_select
  on core.field_observation_requests for select to authenticated
  using (
    organisation_id = core.current_organisation_id()
    and identity_id = core.current_identity_id()
  );

create policy field_request_insert
  on core.field_observation_requests for insert to authenticated
  with check (
    organisation_id = core.current_organisation_id()
    and identity_id = core.current_identity_id()
    and exists (
      select 1 from core.evidence e
      where e.id = evidence_id
        and (e.sensitivity = 'public' or core.can_read_resource(e.resource_id))
    )
  );

grant select, insert on core.field_observation_requests to authenticated;

revoke insert, update, delete on core.observations from authenticated;

create or replace function core_private.consume_field_observation_request(
  p_request_id uuid
)
returns table (
  observation_id uuid,
  decision text
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_request core.field_observation_requests;
  v_evidence core.evidence;
  v_id uuid;
begin
  select * into v_request
    from core.field_observation_requests
   where id = p_request_id
     and organisation_id = core.current_organisation_id()
     and identity_id = core.current_identity_id()
     and status = 'pending'
   for update;

  if v_request.id is null then
    return query select null::uuid, 'request_not_pending';
    return;
  end if;

  select * into v_evidence
    from core.evidence e
   where e.id = v_request.evidence_id
     and (e.sensitivity = 'public' or core.can_read_resource(e.resource_id));

  if v_evidence.id is null then
    return query select null::uuid, 'deny_evidence_scope';
    return;
  end if;

  insert into core.observations(
    evidence_id, observation_type, value, method, observed_at,
    observer_identity_id, uncertainty
  ) values (
    v_request.evidence_id, v_request.observation_type, v_request.value,
    v_request.method, v_request.observed_at, v_request.identity_id,
    v_request.uncertainty
  )
  returning id into v_id;

  update core.field_observation_requests
     set status = 'consumed', consumed_at = clock_timestamp()
   where id = v_request.id;

  return query select v_id, 'created';
end;
$$;

revoke execute on function core_private.consume_field_observation_request(uuid) from public;
revoke execute on function core_private.consume_field_observation_request(uuid) from anon;
grant execute on function core_private.consume_field_observation_request(uuid) to authenticated;

comment on table core.field_observation_requests is
  'Durable Field Acquisition observation request. Evidence remains the provenance anchor.';
comment on function core_private.consume_field_observation_request(uuid) is
  'Canonical protected observation mutation boundary; authorization remains external to the domain mutation.';
