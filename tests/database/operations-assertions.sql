-- Executable assertions for the first persistent operations store.
-- Uses the repository's disposable Auth shim and transaction-scoped app context.
set lock_timeout = '5s';

do $$
declare
  v_org_a uuid := gen_random_uuid();
  v_org_b uuid := gen_random_uuid();
  v_id_a uuid := gen_random_uuid();
  v_id_b uuid := gen_random_uuid();
  v_op_a uuid := gen_random_uuid();
  v_op_b uuid := gen_random_uuid();
  v_count integer;
  v_state text;
begin
  insert into core.organisations(id, name, slug) values
    (v_org_a, 'Operations Test A', 'operations-test-a'),
    (v_org_b, 'Operations Test B', 'operations-test-b');

  insert into core.identities(id, auth_user_id, display_name) values
    (v_id_a, gen_random_uuid(), 'Operations Test Identity A'),
    (v_id_b, gen_random_uuid(), 'Operations Test Identity B');

  insert into core.identity_organisation_memberships(identity_id, organisation_id, membership_role)
  values
    (v_id_a, v_org_a, 'member'),
    (v_id_b, v_org_b, 'member');

  perform set_config('request.jwt.claim.sub', (select auth_user_id::text from core.identities where id=v_id_a), true);
  perform set_config('role', 'authenticated', true);
  perform set_config('app.organisation_id', v_org_a::text, true);

  -- Positive: tenant may create and read its own operation.
  insert into operations.operations(
    id, organisation_id, identity_id, idempotency_key, action, purpose, expires_at
  ) values (
    v_op_a, v_org_a, v_id_a, 'idem-positive-1', 'annotate', 'test', now() + interval '1 hour'
  );

  select count(*) into v_count from operations.operations where id=v_op_a;
  if v_count <> 1 then
    raise exception 'positive tenant read failed';
  end if;

  -- Atomic idempotency: duplicate key cannot create a second operation.
  begin
    insert into operations.operations(
      organisation_id, identity_id, idempotency_key, action, purpose, expires_at
    ) values (
      v_org_a, v_id_a, 'idem-positive-1', 'annotate', 'test-duplicate', now() + interval '1 hour'
    );
    raise exception 'duplicate idempotency key unexpectedly accepted';
  exception when unique_violation then
    null;
  end;

  -- CAS lifecycle: valid transition succeeds.
  perform operations.transition(v_op_a, 'created', 'authorized');
  select state into v_state from operations.operations where id=v_op_a;
  if v_state <> 'authorized' then
    raise exception 'valid lifecycle transition failed';
  end if;

  -- CAS lifecycle: stale expected state must fail.
  begin
    perform operations.transition(v_op_a, 'created', 'queued');
    raise exception 'stale CAS transition unexpectedly succeeded';
  exception when others then
    if sqlerrm not like 'invalid_operation_transition:%' then
      raise;
    end if;
  end;

  -- Terminal-state protection.
  perform operations.transition(v_op_a, 'authorized', 'cancelled');
  begin
    perform operations.transition(v_op_a, 'cancelled', 'queued');
    raise exception 'terminal state resurrected';
  exception when others then
    if sqlerrm not like 'invalid_operation_transition:%' then
      raise;
    end if;
  end;

  -- Cross-tenant read must be invisible.
  perform set_config('app.organisation_id', v_org_b::text, true);
  select count(*) into v_count from operations.operations where id=v_op_a;
  if v_count <> 0 then
    raise exception 'cross-tenant operation visibility leak';
  end if;

  -- Cross-tenant insert must fail.
  begin
    insert into operations.operations(
      id, organisation_id, identity_id, idempotency_key, action, purpose, expires_at
    ) values (
      v_op_b, v_org_a, v_id_a, 'idem-cross-tenant', 'annotate', 'test', now() + interval '1 hour'
    );
    raise exception 'cross-tenant operation insert unexpectedly succeeded';
  exception when others then
    if sqlerrm = 'cross-tenant operation insert unexpectedly succeeded' then
      raise;
    end if;
  end;

  -- Switch back to tenant A and create an expired operation.
  perform set_config('app.organisation_id', v_org_a::text, true);
  insert into operations.operations(
    id, organisation_id, identity_id, idempotency_key, action, purpose, expires_at
  ) values (
    v_op_b, v_org_a, v_id_a, 'idem-expired-1', 'annotate', 'test', now() + interval '1 millisecond'
  );
  perform pg_sleep(0.01);

  begin
    perform operations.transition(v_op_b, 'created', 'authorized');
    raise exception 'expired operation transitioned';
  exception when others then
    if sqlerrm <> 'operation_expired' then
      raise;
    end if;
  end;

  -- Minimal-data policy: protected payload is represented by reference/hash, not payload JSON.
  select count(*) into v_count
  from information_schema.columns
  where table_schema='operations' and table_name='operations' and column_name='payload';
  if v_count <> 0 then
    raise exception 'operations table contains forbidden payload column';
  end if;

  raise notice 'operations persistence positive/negative assertions passed';
end $$;
