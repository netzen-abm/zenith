-- Persistent execution reservation assertions.
begin;

insert into auth.users(id) values ('00000000-0000-0000-0000-0000000000a3') on conflict do nothing;
insert into core.organisations(id,name,slug) values ('00000000-0000-0000-0000-0000000000a1','Reservation Test','reservation-test') on conflict do nothing;
insert into core.identities(id,auth_user_id,display_name) values ('00000000-0000-0000-0000-0000000000a2','00000000-0000-0000-0000-0000000000a3','Reservation Identity') on conflict do nothing;
insert into core.identity_organisation_memberships(identity_id,organisation_id,membership_role) values ('00000000-0000-0000-0000-0000000000a2','00000000-0000-0000-0000-0000000000a1','member') on conflict do nothing;
insert into core.resources(id,organisation_id,resource_type,title,epistemic_status,sensitivity) values ('00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000a1','test','Reservation Resource','documented','public') on conflict (id) do nothing;
insert into core.resource_memberships(resource_id,identity_id,membership_role) values ('00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000a2','owner') on conflict (resource_id,identity_id) do nothing;

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000a3',true);
select set_config('app.organisation_id','00000000-0000-0000-0000-0000000000a1',true);

insert into operations.operations(id,organisation_id,identity_id,idempotency_key,action,resource_id,purpose,expires_at)
values ('00000000-0000-0000-0000-0000000000e1','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000a2','reservation-positive','annotate','00000000-0000-0000-0000-0000000000d1','reservation test',clock_timestamp()+interval '1 hour');

update operations.operations set state='queued' where id='00000000-0000-0000-0000-0000000000e1';

do $$ declare r record; begin
  select * into r from operations.reserve_execution('00000000-0000-0000-0000-0000000000e1');
  if not r.allowed or r.decision <> 'allow' or r.state <> 'in_flight' or r.attempt_count <> 1 then raise exception 'positive reservation failed'; end if;
end $$;

-- Current-policy denial must prevent reservation.
insert into operations.operations(id,organisation_id,identity_id,idempotency_key,action,resource_id,purpose,expires_at,state)
values ('00000000-0000-0000-0000-0000000000e2','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000a2','reservation-denied','update','00000000-0000-0000-0000-0000000000d1','reservation test',clock_timestamp()+interval '1 hour','queued');

-- The Core policy currently permits owner writes; remove membership to force current denial.
delete from core.resource_memberships where resource_id='00000000-0000-0000-0000-0000000000d1' and identity_id='00000000-0000-0000-0000-0000000000a2';
do $$ declare r record; begin
  select * into r from operations.reserve_execution('00000000-0000-0000-0000-0000000000e2');
  if r.allowed or r.decision <> 'deny_policy' or r.state <> 'queued' then raise exception 'policy denial failed closed'; end if;
end $$;

-- Expiry is authoritative and cannot reserve.
insert into operations.operations(id,organisation_id,identity_id,idempotency_key,action,purpose,expires_at,state)
values ('00000000-0000-0000-0000-0000000000e3','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000a2','reservation-expired','annotate','reservation test',clock_timestamp()+interval '1 millisecond','queued');
perform pg_sleep(0.01);
do $$ declare r record; begin
  select * into r from operations.reserve_execution('00000000-0000-0000-0000-0000000000e3');
  if r.allowed or r.decision <> 'expired' or r.state <> 'queued' then raise exception 'expiry reservation failed closed'; end if;
end $$;

rollback;
