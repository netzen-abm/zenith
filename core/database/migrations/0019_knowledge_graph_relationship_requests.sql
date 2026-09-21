set lock_timeout = '5s';

create table if not exists core.knowledge_graph_relationship_requests (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references core.organisations(id) on delete restrict,
  identity_id uuid not null references core.identities(id) on delete restrict,
  subject_resource_id uuid not null references core.resources(id) on delete restrict,
  predicate text not null,
  object_resource_id uuid not null references core.resources(id) on delete restrict,
  asserted_by_identity_id uuid references core.identities(id) on delete set null,
  evidence_id uuid references core.evidence(id) on delete set null,
  epistemic_status text not null,
  confidence numeric,
  valid_from timestamptz,
  valid_to timestamptz,
  assertion jsonb not null default '{}'::jsonb,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  consumed_at timestamptz,
  constraint kg_request_self_relationship_check check (subject_resource_id <> object_resource_id),
  constraint kg_request_temporal_check check (valid_to is null or valid_from is null or valid_to >= valid_from),
  constraint kg_request_confidence_check check (confidence is null or (confidence >= 0 and confidence <= 1)),
  constraint kg_request_epistemic_check check (epistemic_status = any (array[
    'observed','documented','derived','interpreted','hypothesized',
    'traditional_oral','contested_disputed','unknown'
  ])),
  constraint kg_request_status_check check (status in ('pending','consumed','rejected'))
);

create index if not exists kg_request_actor_idx
  on core.knowledge_graph_relationship_requests(organisation_id, identity_id, status);

alter table core.knowledge_graph_relationship_requests enable row level security;
alter table core.knowledge_graph_relationship_requests force row level security;

drop policy if exists kg_request_select on core.knowledge_graph_relationship_requests;
drop policy if exists kg_request_insert on core.knowledge_graph_relationship_requests;

create policy kg_request_select
  on core.knowledge_graph_relationship_requests for select to authenticated
  using (
    organisation_id = core.current_organisation_id()
    and identity_id = core.current_identity_id()
  );

create policy kg_request_insert
  on core.knowledge_graph_relationship_requests for insert to authenticated
  with check (
    organisation_id = core.current_organisation_id()
    and identity_id = core.current_identity_id()
    and core.can_write_resource(subject_resource_id)
    and core.can_write_resource(object_resource_id)
  );

grant select, insert on core.knowledge_graph_relationship_requests to authenticated;

create schema if not exists core_private;
grant usage on schema core_private to postgres;
revoke all on schema core_private from public;
grant usage on schema core_private to authenticated;

revoke insert, update, delete on core.entity_relationships from authenticated;

create or replace function core_private.consume_knowledge_graph_relationship_request(
  p_request_id uuid
)
returns table (
  relationship_id uuid,
  decision text
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_request core.knowledge_graph_relationship_requests;
  v_relationship_id uuid;
begin
  select *
    into v_request
    from core.knowledge_graph_relationship_requests
   where id = p_request_id
     and organisation_id = core.current_organisation_id()
     and identity_id = core.current_identity_id()
     and status = 'pending'
   for update;

  if v_request.id is null then
    return query select null::uuid, 'request_not_pending';
    return;
  end if;

  if not core.can_write_resource(v_request.subject_resource_id)
     or not core.can_write_resource(v_request.object_resource_id) then
    return query select null::uuid, 'deny_policy';
    return;
  end if;

  if v_request.evidence_id is not null
     and not exists (
       select 1 from core.evidence e
        where e.id = v_request.evidence_id
          and e.resource_id = v_request.subject_resource_id
     ) then
    return query select null::uuid, 'evidence_scope_mismatch';
    return;
  end if;

  insert into core.entity_relationships(
    organisation_id, subject_resource_id, predicate, object_resource_id,
    asserted_by_identity_id, evidence_id, epistemic_status, confidence,
    valid_from, valid_to, assertion
  ) values (
    v_request.organisation_id, v_request.subject_resource_id, v_request.predicate,
    v_request.object_resource_id, v_request.asserted_by_identity_id,
    v_request.evidence_id, v_request.epistemic_status, v_request.confidence,
    v_request.valid_from, v_request.valid_to, v_request.assertion
  )
  returning id into v_relationship_id;

  update core.knowledge_graph_relationship_requests
     set status = 'consumed', consumed_at = clock_timestamp()
   where id = v_request.id;

  return query select v_relationship_id, 'created';
end;
$$;

revoke execute on function core_private.consume_knowledge_graph_relationship_request(uuid) from public;
revoke execute on function core_private.consume_knowledge_graph_relationship_request(uuid) from anon;
grant execute on function core_private.consume_knowledge_graph_relationship_request(uuid) to authenticated;

comment on table core.knowledge_graph_relationship_requests is
  'Durable Knowledge Graph mutation request; operation.payload_ref points to this protected request payload.';
comment on function core_private.consume_knowledge_graph_relationship_request(uuid) is
  'Canonical protected Knowledge Graph relationship mutation boundary; domain mutation only, not general capability authorization.';
