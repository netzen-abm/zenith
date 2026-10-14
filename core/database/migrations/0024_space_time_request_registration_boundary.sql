-- Register a durable Space-Time request through the trust boundary rather
-- than granting application roles direct INSERT access to the request table.
set lock_timeout = '5s';

create or replace function core_private.register_space_time_representation_request(
  p_request_id uuid,
  p_organisation_id uuid,
  p_identity_id uuid,
  p_resource_id uuid,
  p_representation_type text,
  p_geom text,
  p_precision_level text,
  p_coordinate_confidence numeric,
  p_source_evidence_id uuid,
  p_payload_hash text,
  p_purpose text
)
returns table (id uuid)
language plpgsql
volatile
security definer
set search_path = ''
as $register$
declare
  v_geometry public.geometry;
  v_hash text;
  v_existing core.space_time_representation_requests%rowtype;
begin
  if p_request_id is null
     or p_organisation_id is distinct from core.current_organisation_id()
     or p_identity_id is distinct from core.current_identity_id()
     or p_organisation_id is null
     or p_identity_id is null
     or p_resource_id is null
     or p_representation_type is null or btrim(p_representation_type) = ''
     or p_precision_level is null
     or p_precision_level not in ('exact','generalized','regional','unknown')
     or p_purpose is null or btrim(p_purpose) = ''
     or p_payload_hash is null or p_payload_hash !~ '^[0-9a-f]{64}$'
     or (p_coordinate_confidence is not null and
         (p_coordinate_confidence < 0 or p_coordinate_confidence > 1)) then
    raise exception 'space_time_request_invalid_context';
  end if;

  if not core.can_write_resource(p_resource_id) then
    raise exception 'space_time_request_denied';
  end if;

  if p_geom is not null then
    v_geometry := p_geom::public.geometry;
    if public.st_srid(v_geometry) <> 4326 or public.st_isempty(v_geometry) or not public.st_isvalid(v_geometry) then
      raise exception 'space_time_geometry_invalid';
    end if;
  end if;

  if p_source_evidence_id is not null and not exists (
    select 1 from core.evidence e
     where e.id = p_source_evidence_id and e.resource_id = p_resource_id
  ) then
    raise exception 'space_time_evidence_scope_mismatch';
  end if;

  v_hash := encode(public.digest(convert_to(jsonb_build_object(
    'action', 'space_time.spatial_representation_create',
    'organisationId', p_organisation_id::text,
    'identityId', p_identity_id::text,
    'purpose', p_purpose,
    'resourceId', p_resource_id::text,
    'representationType', p_representation_type,
    'geom', p_geom,
    'precisionLevel', p_precision_level,
    'coordinateConfidence', p_coordinate_confidence,
    'sourceEvidenceId', p_source_evidence_id::text
  )::text, 'UTF8'), 'sha256'), 'hex');

  if v_hash is distinct from p_payload_hash then
    raise exception 'space_time_request_payload_hash_mismatch';
  end if;

  insert into core.space_time_representation_requests(
    id, organisation_id, identity_id, resource_id, representation_type, geom,
    precision_level, coordinate_confidence, source_evidence_id, payload_hash
  ) values (
    p_request_id, p_organisation_id, p_identity_id, p_resource_id,
    p_representation_type, v_geometry, p_precision_level,
    p_coordinate_confidence, p_source_evidence_id, v_hash
  ) on conflict on constraint space_time_representation_requests_pkey do nothing;

  select * into v_existing
    from core.space_time_representation_requests
   where core.space_time_representation_requests.id = p_request_id
     and organisation_id = p_organisation_id
     and identity_id = p_identity_id
   for update;

  if v_existing.id is null or v_existing.payload_hash is distinct from v_hash then
    raise exception 'space_time_request_payload_conflict';
  end if;

  return query select v_existing.id;
end
$register$;

revoke all on function core_private.register_space_time_representation_request(uuid,uuid,uuid,uuid,text,text,text,numeric,uuid,text,text) from public, anon;
grant execute on function core_private.register_space_time_representation_request(uuid,uuid,uuid,uuid,text,text,text,numeric,uuid,text,text) to authenticated;

comment on function core_private.register_space_time_representation_request(uuid,uuid,uuid,uuid,text,text,text,numeric,uuid,text,text) is
  'Authenticated trust boundary for canonical Space-Time request registration; validates tenant, identity, resource permission, evidence scope, geometry, and canonical payload hash before writing.';
