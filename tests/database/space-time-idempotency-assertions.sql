-- Database-backed canonical Space-Time idempotency assertions.
begin;

insert into auth.users(id) values ('00000000-0000-0000-0000-0000000002b3') on conflict do nothing;
insert into core.organisations(id,name,slug) values ('00000000-0000-0000-0000-0000000002b1','Space-Time Idempotency Test','space-time-idempotency-test') on conflict do nothing;
insert into core.identities(id,auth_user_id,display_name) values ('00000000-0000-0000-0000-0000000002b2','00000000-0000-0000-0000-0000000002b3','Space-Time Idempotency Identity') on conflict do nothing;
insert into core.identity_organisation_memberships(identity_id,organisation_id,membership_role)
values ('00000000-0000-0000-0000-0000000002b2','00000000-0000-0000-0000-0000000002b1','member')
on conflict do nothing;
insert into core.resources(id,organisation_id,resource_type,title,epistemic_status,sensitivity)
values ('00000000-0000-0000-0000-0000000002d2','00000000-0000-0000-0000-0000000002b1','site','Idempotency Resource','documented','public')
on conflict (id) do nothing;
insert into core.resource_memberships(resource_id,identity_id,membership_role)
values ('00000000-0000-0000-0000-0000000002d2','00000000-0000-0000-0000-0000000002b2','owner')
on conflict (resource_id,identity_id) do nothing;

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000002b3',true);
select set_config('app.organisation_id','00000000-0000-0000-0000-0000000002b1',true);

do $$
declare
  first_result record;
  replay_result record;
begin
  select * into first_result from operations.create_or_get_with_payload_hash(
    '00000000-0000-0000-0000-0000000002f1',
    '00000000-0000-0000-0000-0000000002b1',
    'space-time-idempotency-test-key',
    'space_time.spatial_representation_create',
    '00000000-0000-0000-0000-0000000002b2',
    'integration-test',
    clock_timestamp() + interval '1 hour',
    '00000000-0000-0000-0000-0000000002d2',
    '00000000-0000-0000-0000-0000000002f2',
    jsonb_build_object(
      'action','space_time.spatial_representation_create',
      'organisationId','00000000-0000-0000-0000-0000000002b1',
      'identityId','00000000-0000-0000-0000-0000000002b2',
      'purpose','integration-test',
      'resourceId','00000000-0000-0000-0000-0000000002d2',
      'representationType','point',
      'geom','POINT(10 20)',
      'precisionLevel','generalized',
      'coordinateConfidence',0.8,
      'sourceEvidenceId',null
    )
  );
  if not first_result.created or first_result.operation_id <> '00000000-0000-0000-0000-0000000002f1' then
    raise exception 'first idempotent operation was not created';
  end if;

  select * into replay_result from operations.create_or_get_with_payload_hash(
    '00000000-0000-0000-0000-0000000002f3',
    '00000000-0000-0000-0000-0000000002b1',
    'space-time-idempotency-test-key',
    'space_time.spatial_representation_create',
    '00000000-0000-0000-0000-0000000002b2',
    'integration-test',
    clock_timestamp() + interval '1 hour',
    '00000000-0000-0000-0000-0000000002d2',
    '00000000-0000-0000-0000-0000000002f4',
    jsonb_build_object(
      'action','space_time.spatial_representation_create',
      'organisationId','00000000-0000-0000-0000-0000000002b1',
      'identityId','00000000-0000-0000-0000-0000000002b2',
      'purpose','integration-test',
      'resourceId','00000000-0000-0000-0000-0000000002d2',
      'representationType','point',
      'geom','POINT(10 20)',
      'precisionLevel','generalized',
      'coordinateConfidence',0.8,
      'sourceEvidenceId',null
    )
  );
  if replay_result.created or replay_result.operation_id <> first_result.operation_id then
    raise exception 'same key and payload did not resolve to canonical operation';
  end if;

  begin
    perform * from operations.create_or_get_with_payload_hash(
      '00000000-0000-0000-0000-0000000002f5',
      '00000000-0000-0000-0000-0000000002b1',
      'space-time-idempotency-test-key',
      'space_time.spatial_representation_create',
      '00000000-0000-0000-0000-0000000002b2',
      'integration-test',
      clock_timestamp() + interval '1 hour',
      '00000000-0000-0000-0000-0000000002d2',
      '00000000-0000-0000-0000-0000000002f6',
      jsonb_build_object(
      'action','space_time.spatial_representation_create',
      'organisationId','00000000-0000-0000-0000-0000000002b1',
      'identityId','00000000-0000-0000-0000-0000000002b2',
      'purpose','integration-test',
      'resourceId','00000000-0000-0000-0000-0000000002d2',
      'representationType','point',
      'geom','POINT(11 21)',
      'precisionLevel','generalized',
      'coordinateConfidence',0.8,
      'sourceEvidenceId',null
    )
    );
    raise exception 'changed payload unexpectedly reused idempotency key';
  exception when others then
    if sqlerrm = 'changed payload unexpectedly reused idempotency key' then raise; end if;
    if sqlerrm <> 'operation_idempotency_conflict' then raise; end if;
  end;
end $$;

-- Ambiguous post-mutation retry safety: consume the same durable request twice.
-- The first call creates exactly one representation; the second must fail closed
-- because the request is already consumed, even if the caller lost the first reply.
do $ambiguous_retry$
declare
  first_mutation record;
  retry_mutation record;
  representation_count integer;
begin
  insert into core.space_time_representation_requests(
    id, organisation_id, identity_id, resource_id, representation_type, geom,
    precision_level, coordinate_confidence, source_evidence_id, payload_hash
  ) values (
    '00000000-0000-0000-0000-0000000002f7',
    '00000000-0000-0000-0000-0000000002b1',
    '00000000-0000-0000-0000-0000000002b2',
    '00000000-0000-0000-0000-0000000002d2',
    'point', ST_GeomFromText('POINT(10 20)',4326), 'generalized', 0.8, null,
    encode(public.digest(convert_to(jsonb_build_object(
      'action','space_time.spatial_representation_create',
      'organisationId','00000000-0000-0000-0000-0000000002b1',
      'identityId','00000000-0000-0000-0000-0000000002b2',
      'purpose','integration-test',
      'resourceId','00000000-0000-0000-0000-0000000002d2',
      'representationType','point',
      'geom','POINT(10 20)',
      'precisionLevel','generalized',
      'coordinateConfidence',0.8,
      'sourceEvidenceId',null
    )::text,'UTF8'),'sha256'),'hex')
  );

  select * into first_mutation
    from core_private.consume_space_time_representation_request('00000000-0000-0000-0000-0000000002f7');
  if first_mutation.decision <> 'created' or first_mutation.representation_id is null then
    raise exception 'first Space-Time mutation did not create a representation';
  end if;

  select * into retry_mutation
    from core_private.consume_space_time_representation_request('00000000-0000-0000-0000-0000000002f7');
  if retry_mutation.decision <> 'request_not_pending' then
    raise exception 'consumed Space-Time request was not rejected on retry';
  end if;

  select count(*) into representation_count
    from core.spatial_representations
   where resource_id = '00000000-0000-0000-0000-0000000002d2';
  if representation_count <> 1 then
    raise exception 'ambiguous retry created duplicate spatial representations: %', representation_count;
  end if;
end $ambiguous_retry$;

rollback;
select 'space-time-idempotency-assertions: PASS' as result;
