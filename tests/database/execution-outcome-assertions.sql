-- Durable execution outcome + audit/outbox assertions.
begin;

insert into auth.users(id) values ('00000000-0000-0000-0000-0000000000b3') on conflict do nothing;
insert into core.organisations(id,name,slug) values ('00000000-0000-0000-0000-0000000000b1','Outcome Test','outcome-test') on conflict do nothing;
insert into core.identities(id,auth_user_id,display_name) values ('00000000-0000-0000-0000-0000000000b2','00000000-0000-0000-0000-0000000000b3','Outcome Identity') on conflict do nothing;
insert into core.identity_organisation_memberships(identity_id,organisation_id,membership_role)
values ('00000000-0000-0000-0000-0000000000b2','00000000-0000-0000-0000-0000000000b1','member')
on conflict do nothing;
insert into core.resources(id,organisation_id,resource_type,title,epistemic_status,sensitivity)
values ('00000000-0000-0000-0000-0000000000d2','00000000-0000-0000-0000-0000000000b1','test','Outcome Resource','documented','public')
on conflict (id) do nothing;
insert into core.resource_memberships(resource_id,identity_id,membership_role)
values ('00000000-0000-0000-0000-0000000000d2','00000000-0000-0000-0000-0000000000b2','owner')
on conflict (resource_id,identity_id) do nothing;

reset role;
insert into operations.operations(
  id,organisation_id,identity_id,idempotency_key,action,resource_id,purpose,expires_at
) values (
  '00000000-0000-0000-0000-0000000000f1',
  '00000000-0000-0000-0000-0000000000b1',
  '00000000-0000-0000-0000-0000000000b2',
  'outcome-positive','annotate','00000000-0000-0000-0000-0000000000d2',
  'outcome test',clock_timestamp()+interval '1 hour'
);

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000b3',true);
select set_config('app.organisation_id','00000000-0000-0000-0000-0000000000b1',true);
select operations.transition('00000000-0000-0000-0000-0000000000f1','created','authorized');
select operations.transition('00000000-0000-0000-0000-0000000000f1','authorized','queued');

do $$ declare r record; begin
  select * into r from operations.reserve_execution('00000000-0000-0000-0000-0000000000f1');
  if not r.allowed or r.decision <> 'allow' or r.state <> 'in_flight' or r.attempt_count <> 1 then
    raise exception 'outcome fixture reservation failed';
  end if;
end $$;

do $$ declare r record; begin
  select * into r from operations.record_execution_outcome(
    '00000000-0000-0000-0000-0000000000f1',1,'acknowledged',null,'result://f1','hash-f1'
  );
  if not r.recorded or r.decision <> 'recorded' or r.state <> 'acknowledged' then
    raise exception 'durable outcome recording failed';
  end if;
end $$;

do $$ declare v_state text; v_outcomes integer; v_outbox integer; begin
  select state into v_state from operations.operations where id='00000000-0000-0000-0000-0000000000f1';
  select count(*) into v_outcomes from operations.execution_outcomes where operation_id='00000000-0000-0000-0000-0000000000f1';
  select count(*) into v_outbox from operations.execution_outbox where operation_id='00000000-0000-0000-0000-0000000000f1';
  if v_state <> 'acknowledged' or v_outcomes <> 1 or v_outbox <> 1 then
    raise exception 'durable outcome atomicity failed';
  end if;
end $$;

do $$ declare r record; begin
  select * into r from operations.record_execution_outcome(
    '00000000-0000-0000-0000-0000000000f1',1,'acknowledged',null,'result://f1','hash-f1'
  );
  if r.recorded or r.decision <> 'operation_not_in_flight' then
    raise exception 'duplicate outcome did not fail closed';
  end if;
end $$;

do $$ begin
  begin
    insert into operations.execution_outcomes(operation_id,attempt_count,outcome)
    values ('00000000-0000-0000-0000-0000000000f1',2,'acknowledged');
    raise exception 'direct outcome insert unexpectedly allowed';
  exception when insufficient_privilege then
    null;
  end;
end $$;

rollback;
