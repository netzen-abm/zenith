-- Executable assertions for the first persistent operations store.
-- Seeds as the database owner, then exercises the public authenticated RLS boundary.
begin;

insert into auth.users(id) values ('00000000-0000-0000-0000-0000000000a3'), ('00000000-0000-0000-0000-0000000000b3') on conflict do nothing;

do $
begin
  insert into core.organisations(id, name, slug)
  values
    ('00000000-0000-0000-0000-0000000000a1', 'Operations Test A', 'operations-test-a'),
    ('00000000-0000-0000-0000-0000000000b1', 'Operations Test B', 'operations-test-b')
  on conflict (id) do nothing;

  insert into core.identities(id, auth_user_id, display_name)
  values
    ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000a3', 'Operations Test Identity A'),
    ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000b3', 'Operations Test Identity B')
  on conflict (id) do nothing;

  insert into core.identity_organisation_memberships(identity_id, organisation_id, membership_role)
  values
    ('00000000-0000-0000-0000-0000000000a2','00000000-0000-0000-0000-0000000000a1','member'),
    ('00000000-0000-0000-0000-0000000000b2','00000000-0000-0000-0000-0000000000b1','member')
  on conflict (identity_id, organisation_id) do nothing;
end $$;

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000a3',true);
select set_config('app.organisation_id','00000000-0000-0000-0000-0000000000a1',true);

-- Positive: tenant may create and read its own operation.
insert into operations.operations(
  id, organisation_id, identity_id, idempotency_key, action, purpose, expires_at
) values (
  '00000000-0000-0000-0000-0000000000c1',
  '00000000-0000-0000-0000-0000000000a1',
  '00000000-0000-0000-0000-0000000000a2',
  'idem-positive-1', 'annotate', 'test', now() + interval '1 hour'
);

do $$
declare
  v_count integer;
  v_state text;
begin
  select count(*) into v_count from operations.operations
  where id='00000000-0000-0000-0000-0000000000c1';
  if v_count <> 1 then raise exception 'positive tenant read failed'; end if;

  -- Atomic idempotency: duplicate key must fail on the database unique constraint.
  begin
    insert into operations.operations(
      organisation_id, identity_id, idempotency_key, action, purpose, expires_at
    ) values (
      '00000000-0000-0000-0000-0000000000a1',
      '00000000-0000-0000-0000-0000000000a2',
      'idem-positive-1', 'annotate', 'test-duplicate', now() + interval '1 hour'
    );
    raise exception 'duplicate idempotency key unexpectedly accepted';
  exception when unique_violation then null;
  end;

  -- CAS lifecycle: valid transition succeeds.
  perform operations.transition(
    '00000000-0000-0000-0000-0000000000c1','created','authorized'
  );
  select state into v_state from operations.operations
  where id='00000000-0000-0000-0000-0000000000c1';
  if v_state <> 'authorized' then raise exception 'valid lifecycle transition failed'; end if;

  -- Stale expected state cannot mutate the row.
  begin
    perform operations.transition(
      '00000000-0000-0000-0000-0000000000c1','created','queued'
    );
    raise exception 'stale CAS transition unexpectedly succeeded';
  exception when others then
    if sqlerrm not like 'invalid_operation_transition:%' then raise; end if;
  end;

  -- Terminal-state protection.
  perform operations.transition(
    '00000000-0000-0000-0000-0000000000c1','authorized','cancelled'
  );
  begin
    perform operations.transition(
      '00000000-0000-0000-0000-0000000000c1','cancelled','queued'
    );
    raise exception 'terminal state resurrected';
  exception when others then
    if sqlerrm not like 'invalid_operation_transition:%' then raise; end if;
  end;

  -- Switch to tenant B and verify A's operation is invisible.
  perform set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000b3',true);
  perform set_config('app.organisation_id','00000000-0000-0000-0000-0000000000b1',true);

  select count(*) into v_count from operations.operations
  where id='00000000-0000-0000-0000-0000000000c1';
  if v_count <> 0 then raise exception 'cross-tenant operation visibility leak'; end if;

  -- Cross-tenant insert must be denied by WITH CHECK.
  begin
    insert into operations.operations(
      organisation_id, identity_id, idempotency_key, action, purpose, expires_at
    ) values (
      '00000000-0000-0000-0000-0000000000a1',
      '00000000-0000-0000-0000-0000000000a2',
      'idem-cross-tenant', 'annotate', 'test', now() + interval '1 hour'
    );
    raise exception 'cross-tenant operation insert unexpectedly succeeded';
  exception when others then
    if sqlerrm = 'cross-tenant operation insert unexpectedly succeeded' then raise; end if;
  end;

  -- Tenant A creates an expired operation; non-expiry transition must be rejected.
  perform set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000a3',true);
  perform set_config('app.organisation_id','00000000-0000-0000-0000-0000000000a1',true);
  insert into operations.operations(
    id, organisation_id, identity_id, idempotency_key, action, purpose, expires_at
  ) values (
    '00000000-0000-0000-0000-0000000000c2',
    '00000000-0000-0000-0000-0000000000a1',
    '00000000-0000-0000-0000-0000000000a2',
    'idem-expired-1', 'annotate', 'test', now() + interval '1 millisecond'
  );
  perform pg_sleep(0.01);
  begin
    perform operations.transition(
      '00000000-0000-0000-0000-0000000000c2','created','authorized'
    );
    raise exception 'expired operation transitioned';
  exception when others then
    if sqlerrm <> 'operation_expired' then raise; end if;
  end;

  -- Minimal-data policy: no arbitrary payload column exists.
  select count(*) into v_count
  from information_schema.columns
  where table_schema='operations' and table_name='operations' and column_name='payload';
  if v_count <> 0 then raise exception 'operations table contains forbidden payload column'; end if;
end $$;

rollback;
