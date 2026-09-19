-- ZENITH operation-store mutation boundary hardening.
-- Direct authenticated UPDATE must not bypass lifecycle/CAS/reservation functions.
-- Operation creation is limited to attributed, initial-state rows.

set lock_timeout = '5s';

revoke update on operations.operations from authenticated;

drop policy if exists operations_tenant_update on operations.operations;
drop policy if exists operations_tenant_insert on operations.operations;
create policy operations_tenant_insert
  on operations.operations for insert to authenticated
  with check (
    organisation_id = core.current_organisation_id()
    and identity_id = core.current_identity_id()
    and state = 'created'
    and attempt_count = 0
    and expires_at > clock_timestamp()
  );

-- Lifecycle mutation now executes through the narrowly scoped function boundary.
-- Both functions retain an empty search_path and explicit tenant predicates.
alter function operations.transition(uuid,text,text) security definer;
alter function operations.reserve_execution(uuid) security definer;

comment on function operations.transition(uuid,text,text) is
  'Canonical lifecycle mutation boundary. SECURITY DEFINER exists only because direct table UPDATE is revoked from authenticated; tenant/state/expiry checks remain explicit.';
comment on function operations.reserve_execution(uuid) is
  'Atomic execution reservation after current canonical authorization; direct table UPDATE is revoked from authenticated; not an authorization authority and not a lease store.';
