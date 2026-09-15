-- ZENITH capability authorization boundary acceptance cases.
-- These cases are executable only when run inside a trusted authenticated
-- test harness that can establish the corresponding auth.uid() context.

-- C-001: malformed action must deny.
select * from core.authorize_capability('', null, 'test');

-- C-002: unknown action must deny.
select * from core.authorize_capability('delete_everything', null, 'test');

-- C-003: unauthenticated context must deny.
select * from core.authorize_capability('read', null, 'test');

-- C-004: protected resource reads must delegate to can_read_resource().
-- C-005: protected resource writes must delegate to can_write_resource().
-- C-006: cross-tenant access must remain denied by the underlying RLS/resource policy.
-- C-007: public-safe projections must not expose precise sensitive geometry.
-- C-008: purpose must be retained as decision context and audit input.
-- C-009: unknown capability families must never fail open.

-- This file records the acceptance contract; C-004..C-008 require seeded
-- authenticated identities/resources and must be executed by integration CI.
