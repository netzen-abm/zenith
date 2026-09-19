-- Regression assertions for the operations mutation boundary.
begin;

insert into auth.users(id)
values ('00000000-0000-0000-0000-0000000000a3')
on conflict do nothing;

insert into core.organisations(id,name,slug)
values ('00000000-0000-0000-0000-0000000000a1','Mutation Boundary Test','mutation-boundary-test')
on conflict do nothing;

insert into core.identities(id,auth_user_id,display_name)
values ('00000000-0000-0000-0000-0000000000a2','00000000-0000-0000-0000-0000000000a3','Mutation Boundary Identity')
on conflict do nothing;

insert into core.identity_organisation_memberships(identity_id,organisation_id,membership_role)
values ('00000000-0000-0000-0000-0000000000a2','00000000-0000-0000-0000-0000000000a1','member')
on conflict (identity_id,organisation_id) do nothing;

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000a3',true);
select set_config('app.organisation_id','00000000-0000-0000-0000-0000000000a1',true);

-- Direct lifecycle UPDATE must be rejected.
insert into operations.operations(
  id, organisation_id, identity_id, idempotency_key, action, purpose, expires_at
) values (
  '00000000-0000-0000-0000-0000000000f2',
  '00000000-0000-0000-0000-0000000000a1',
  '00000000-0000-0000-0000-0000000000a2',
  'mutation-boundary', 'annotate', 'mutation boundary', clock_timestamp()+interval '1 hour'
);

begin
  update operations.operations
     set state='queued'
   where id='00000000-0000-0000-0000-0000000000f2';
  raise exception 'direct lifecycle update unexpectedly succeeded';
exception when insufficient_privilege then null;
end;

-- Forged initial lifecycle state must be rejected.
begin
  insert into operations.operations(
    id, organisation_id, identity_id, idempotency_key, action, purpose, expires_at, state
  ) values (
    '00000000-0000-0000-0000-0000000000f3',
    '00000000-0000-0000-0000-0000000000a1',
    '00000000-0000-0000-0000-0000000000a2',
    'mutation-boundary-forged-state', 'annotate', 'mutation boundary',
    clock_timestamp()+interval '1 hour', 'queued'
  );
  raise exception 'forged initial state unexpectedly succeeded';
exception when others then
  if sqlerrm = 'forged initial state unexpectedly succeeded' then raise; end if;
end;

-- Canonical transition remains the permitted lifecycle path.
perform operations.transition(
  '00000000-0000-0000-0000-0000000000f2','created','authorized'
);

rollback;
