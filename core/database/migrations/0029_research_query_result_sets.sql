-- Durable provider-result snapshots for Research, separate from the request envelope and operation ledger.
-- The result payload is an allowlisted metadata projection; abstracts/full text are intentionally excluded.
set lock_timeout = '5s';

create unique index if not exists research_query_requests_id_org_identity_uq
  on core.research_query_requests(id, organisation_id, identity_id);

create table if not exists core.research_query_result_sets (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  identity_id uuid not null,
  query_id uuid not null,
  provider_id text not null check (length(provider_id) between 1 and 64),
  provider_version text not null check (length(provider_version) between 1 and 64),
  request_hash text not null check (request_hash ~ '^[0-9a-f]{64}$'),
  cursor_key text not null check (length(cursor_key) between 1 and 2048),
  provider_query_reference text not null check (length(provider_query_reference) between 1 and 1024),
  result_payload jsonb not null check (jsonb_typeof(result_payload) = 'object'),
  result_hash text not null check (result_hash ~ '^[0-9a-f]{64}$'),
  retrieved_at timestamptz not null,
  created_at timestamptz not null default clock_timestamp(),
  constraint research_query_result_set_scope_fk
    foreign key (query_id, organisation_id, identity_id)
    references core.research_query_requests(id, organisation_id, identity_id) on delete restrict,
  constraint research_query_result_set_payload_size
    check (octet_length(result_payload::text) <= 1048576),
  constraint research_query_result_set_results_array
    check (jsonb_typeof(result_payload->'results') = 'array'),
  constraint research_query_result_set_warnings_array
    check (jsonb_typeof(result_payload->'warnings') = 'array'),
  constraint research_query_result_set_partial_bool
    check (jsonb_typeof(result_payload->'partial') = 'boolean'),
  constraint research_query_result_set_identity
    check (
      result_payload->>'queryId' = query_id::text
      and result_payload->>'providerId' = provider_id
      and result_payload->>'providerQueryReference' = provider_query_reference
    ),
  constraint research_query_result_set_idempotency
    unique (organisation_id, identity_id, query_id, provider_id, request_hash, cursor_key, result_hash)
);

create index if not exists research_query_result_sets_latest_idx
  on core.research_query_result_sets(organisation_id, identity_id, query_id, retrieved_at desc);

alter table core.research_query_result_sets enable row level security;
alter table core.research_query_result_sets force row level security;

drop policy if exists research_query_result_sets_select on core.research_query_result_sets;
create policy research_query_result_sets_select
  on core.research_query_result_sets
  for select to authenticated
  using (
    organisation_id = core.current_organisation_id()
    and identity_id = core.current_identity_id()
  );

revoke all on core.research_query_result_sets from public, anon, authenticated;
grant select on core.research_query_result_sets to authenticated;

create schema if not exists core_private;

create or replace function core_private.persist_research_query_result_set(
  p_operation_id uuid,
  p_query_id uuid,
  p_provider_id text,
  p_provider_version text,
  p_request_hash text,
  p_cursor_key text,
  p_provider_query_reference text,
  p_result_payload jsonb
)
returns table (result_set_id uuid, result_hash text, created boolean)
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  v_operation operations.operations%rowtype;
  v_result_hash text;
  v_result_set_id uuid;
  v_created boolean;
  v_retrieved_at timestamptz;
begin
  if core.current_organisation_id() is null
     or core.current_identity_id() is null
     or p_operation_id is null
     or p_query_id is null
     or p_provider_id is null or btrim(p_provider_id) = ''
     or p_provider_version is null or btrim(p_provider_version) = ''
     or p_request_hash is null or p_request_hash !~ '^[0-9a-f]{64}$'
     or p_cursor_key is null or btrim(p_cursor_key) = ''
     or p_provider_query_reference is null or btrim(p_provider_query_reference) = ''
     or p_result_payload is null or jsonb_typeof(p_result_payload) <> 'object'
     or octet_length(p_result_payload::text) > 1048576
     or p_result_payload->>'queryId' is distinct from p_query_id::text
     or p_result_payload->>'providerId' is distinct from p_provider_id
     or p_result_payload->>'providerQueryReference' is distinct from p_provider_query_reference
     or jsonb_typeof(p_result_payload->'results') is distinct from 'array'
     or jsonb_typeof(p_result_payload->'warnings') is distinct from 'array'
     or jsonb_typeof(p_result_payload->'partial') is distinct from 'boolean' then
    raise exception 'research_result_payload_invalid';
  end if;

  -- Only the canonical operation that currently owns an in-flight attempt may persist its result.
  select o.* into v_operation
    from operations.operations o
   where o.id = p_operation_id
     and o.organisation_id = core.current_organisation_id()
     and o.identity_id = core.current_identity_id()
     and o.action = 'research.query'
     and o.payload_ref = p_query_id::text
     and o.payload_hash = p_request_hash
     and o.state = 'in_flight'
     and o.attempt_count >= 1
   for share;
  if not found then
    raise exception 'research_result_operation_context_invalid';
  end if;

  if not exists (
    select 1 from core.research_query_requests q
     where q.id = p_query_id
       and q.organisation_id = core.current_organisation_id()
       and q.identity_id = core.current_identity_id()
  ) then
    raise exception 'research_result_query_scope_invalid';
  end if;

  -- Reject fields outside the metadata contract. This prevents storing abstracts/full text by convenience.
  if exists (
    select 1 from jsonb_object_keys(p_result_payload) as k(name)
     where k.name not in ('queryId','providerId','providerQueryReference','retrievedAt','results','nextCursor','partial','warnings')
  ) then
    raise exception 'research_result_payload_field_not_allowed';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_result_payload->'results') as item(value)
     where jsonb_typeof(item.value) <> 'object'
  ) or exists (
    select 1
      from jsonb_array_elements(p_result_payload->'results') as item(value)
      cross join lateral jsonb_object_keys(item.value) as k(name)
     where k.name not in ('canonicalWorkId','title','workType','publicationDate','identifiers','sourceProvenance','rightsMetadata')
  ) then
    raise exception 'research_result_work_field_not_allowed';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_result_payload->'results') as item(value)
     where item.value ? 'rightsMetadata'
       and jsonb_typeof(item.value->'rightsMetadata') <> 'object'
  ) or exists (
    select 1
      from jsonb_array_elements(p_result_payload->'results') as item(value)
      cross join lateral jsonb_object_keys(coalesce(item.value->'rightsMetadata','{}'::jsonb)) as k(name)
     where k.name not in ('provider','licenseUrls','metadataUrl')
  ) then
    raise exception 'research_result_rights_field_not_allowed';
  end if;

  begin
    v_retrieved_at := (p_result_payload->>'retrievedAt')::timestamptz;
  exception when others then
    raise exception 'research_result_retrieved_at_invalid';
  end;
  v_result_hash := encode(public.digest(convert_to(p_result_payload::text, 'UTF8'), 'sha256'), 'hex');

  insert into core.research_query_result_sets(
    organisation_id, identity_id, query_id, provider_id, provider_version,
    request_hash, cursor_key, provider_query_reference, result_payload, result_hash, retrieved_at
  ) values (
    core.current_organisation_id(), core.current_identity_id(), p_query_id, p_provider_id, p_provider_version,
    p_request_hash, p_cursor_key, p_provider_query_reference, p_result_payload, v_result_hash, v_retrieved_at
  )
  on conflict (organisation_id, identity_id, query_id, provider_id, request_hash, cursor_key, result_hash) do nothing
  returning id into v_result_set_id;

  v_created := v_result_set_id is not null;
  if not v_created then
    select r.id into v_result_set_id
      from core.research_query_result_sets r
     where r.organisation_id = core.current_organisation_id()
       and r.identity_id = core.current_identity_id()
       and r.query_id = p_query_id
       and r.provider_id = p_provider_id
       and r.request_hash = p_request_hash
       and r.cursor_key = p_cursor_key
       and r.result_hash = v_result_hash
     order by r.created_at desc
     limit 1;
  end if;

  return query select v_result_set_id, v_result_hash, v_created;
end
$function$;

revoke all on function core_private.persist_research_query_result_set(uuid,uuid,text,text,text,text,text,jsonb) from public, anon;
grant execute on function core_private.persist_research_query_result_set(uuid,uuid,text,text,text,text,text,jsonb) to authenticated;

comment on table core.research_query_result_sets is
  'Immutable metadata-only provider result snapshots, scoped to the same tenant and identity as the query; provider response bodies and full text are not persisted.';
comment on function core_private.persist_research_query_result_set(uuid,uuid,text,text,text,text,text,jsonb) is
  'Trusted result-write boundary: verifies the current in-flight canonical Research operation, tenant/identity scope, provider response identity, payload size and allowlisted metadata fields; computes a server-side SHA-256 hash.';
