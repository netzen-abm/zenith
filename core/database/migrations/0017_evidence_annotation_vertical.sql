-- ZENITH evidence annotation vertical: durable request payload and protected mutation boundary.
set lock_timeout = '5s';

create table if not exists core.evidence_annotation_requests (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references core.organisations(id) on delete restrict,
  identity_id uuid not null references core.identities(id) on delete restrict,
  resource_id uuid not null references core.resources(id) on delete restrict,
  source_id uuid not null references core.sources(id) on delete restrict,
  evidence_type text not null,
  locator jsonb not null default '{}'::jsonb,
  excerpt text,
  evidence_payload jsonb not null default '{}'::jsonb,
  epistemic_status text not null default 'documented',
  sensitivity text not null default 'public',
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  consumed_at timestamptz,
  constraint evidence_annotation_request_status_check
    check (status in ('pending','consumed','rejected')),
  constraint evidence_annotation_request_epistemic_check
    check (epistemic_status = any (array[
      'observed','documented','derived','interpreted','hypothesized',
      'traditional_oral','contested_disputed','unknown'
    ])),
  constraint evidence_annotation_request_sensitivity_check
    check (sensitivity = any (array['public','controlled','sensitive']))
);

create index if not exists evidence_annotation_requests_actor_idx
  on core.evidence_annotation_requests(organisation_id, identity_id, status);

alter table core.evidence_annotation_requests enable row level security;
alter table core.evidence_annotation_requests force row level security;

drop policy if exists evidence_annotation_requests_select on core.evidence_annotation_requests;
drop policy if exists evidence_annotation_requests_insert on core.evidence_annotation_requests;

create policy evidence_annotation_requests_select
  on core.evidence_annotation_requests for select to authenticated
  using (
    organisation_id = core.current_organisation_id()
    and identity_id = core.current_identity_id()
  );

create policy evidence_annotation_requests_insert
  on core.evidence_annotation_requests for insert to authenticated
  with check (
    organisation_id = core.current_organisation_id()
    and identity_id = core.current_identity_id()
    and core.can_write_resource(resource_id)
  );

grant select, insert on core.evidence_annotation_requests to authenticated;

create schema if not exists core_private;

grant usage on schema core_private to postgres;
revoke all on schema core_private from public;
grant usage on schema core_private to authenticated;

create or replace function core_private.consume_evidence_annotation_request(
  p_request_id uuid
)
returns table (
  evidence_id uuid,
  decision text
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_request core.evidence_annotation_requests;
  v_evidence_id uuid;
begin
  select *
    into v_request
    from core.evidence_annotation_requests
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

  if not exists (
    select 1
      from core.sources s
     where s.id = v_request.source_id
       and (s.organisation_id is null or s.organisation_id = v_request.organisation_id)
  ) then
    return query select null::uuid, 'source_scope_mismatch';
    return;
  end if;

  insert into core.evidence(
    source_id, resource_id, evidence_type, locator, excerpt,
    evidence_payload, epistemic_status, sensitivity, created_by
  ) values (
    v_request.source_id, v_request.resource_id, v_request.evidence_type,
    v_request.locator, v_request.excerpt, v_request.evidence_payload,
    v_request.epistemic_status, v_request.sensitivity, v_request.identity_id
  )
  returning id into v_evidence_id;

  update core.evidence_annotation_requests
     set status = 'consumed', consumed_at = clock_timestamp()
   where id = v_request.id;

  return query select v_evidence_id, 'created';
end;
$$;

revoke execute on function core_private.consume_evidence_annotation_request(uuid) from public;
revoke execute on function core_private.consume_evidence_annotation_request(uuid) from anon;
grant execute on function core_private.consume_evidence_annotation_request(uuid) to authenticated;

comment on table core.evidence_annotation_requests is
  'Durable domain request payload for the evidence annotation capability; operation.payload_ref points to the request.';
comment on function core_private.consume_evidence_annotation_request(uuid) is
  'Canonical protected evidence mutation boundary for the evidence annotation capability.';
