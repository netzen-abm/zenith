-- ZENITH operations mutation boundary hardening.
-- Authenticated callers may create an operation, but lifecycle mutation must use
-- the canonical CAS/reservation functions rather than direct row UPDATEs.

revoke update on operations.operations from authenticated;

drop policy if exists operations_tenant_update on operations.operations;

drop policy if exists operations_tenant_insert on operations.operations;
create policy operations_tenant_insert
  on operations.operations for insert to authenticated
  with check (
    organisation_id = core.current_organisation_id()
    and (identity_id is null or identity_id = core.current_identity_id())
    and state = 'created'
    and attempt_count = 0
    and expires_at > clock_timestamp()
  );

comment on table operations.operations is
  'Minimal tenant-scoped operation lifecycle state. Protected payloads remain in domain evidence/storage systems. Direct authenticated lifecycle UPDATE is prohibited; lifecycle changes use transition/reservation functions.';
