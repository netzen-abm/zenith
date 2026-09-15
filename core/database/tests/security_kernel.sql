-- ZENITH Security Kernel acceptance test plan.
-- Execute only against a disposable development target after the trusted auth-context bridge exists.

-- G-001 Tenant isolation: org B must not see org A protected resources.
-- G-002 Policy context: purpose/precision must change obligations/decisions where required.
-- G-003 Sensitive archaeology: public projection must not expose precise geometry.
-- G-006 Audit: protected mutation must create an auditable event with actor/org/action/resource/correlation ID.
-- G-015 RLS defense-in-depth: direct authenticated query from org B must still hide org A resource.
-- G-016 Background authority: service identities must be explicitly scoped; no blanket tenant bypass.
-- G-017 Restore: backup/restore validation belongs to target infrastructure.

-- These comments are intentionally not a claim of runtime PASS. Production gate evidence requires execution against the real authorization/data layers.
