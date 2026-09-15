# ADR 0002 — Database Source-of-Truth and Migration Parity

- **Status:** Accepted as an architectural remediation requirement
- **Date:** 2026-09-15

## Context

The ZENITH repository and the dedicated Past Intelligence Core database are currently at different schema generations.

The repository's committed `0001_security_kernel.sql` and `0002_capability_policy_boundary.sql` are not, by themselves, sufficient to reproduce the currently deployed Core schema. The live Supabase project has additional migrations and schema changes that were applied during the security, evidence/provenance, knowledge-graph, space-time, research, authorization-helper, and capability-boundary work.

This is a source-of-truth risk: a fresh environment created only from repository migrations could diverge materially from the currently verified Past Intelligence Core.

## Evidence established on 2026-09-15

The live project migration history contains these migration generations beyond the repository's two committed migrations:

- `past_intelligence_core_security_kernel_v0_1`
- `tighten_public_data_api_surface`
- `restore_public_rls_read_path`
- `separate_anon_public_resource_policy`
- `harden_postgis_public_surface`
- `close_postgis_extension_public_privileges`
- `evidence_provenance_audit_kernel_v0_1`
- `evidence_provenance_runtime_gate_v0_1`
- `knowledge_graph_relationship_kernel_v0_1`
- `space_time_kernel_v0_1`
- `research_workflow_kernel_v0_1`
- `harden_authorization_helper_execution_context`
- `close_authorization_helper_direct_execute`
- `add_canonical_capability_policy_boundary`

The live schema also contains fields not represented by the repository's original security-kernel migration, including `core.identities.auth_user_id`, `core.identities.display_name`, `core.resources.epistemic_status`, `core.resources.sensitivity`, `core.resources.geom`, and `core.resource_memberships.membership_role`.

The live authorization helper uses the real Supabase Auth identity boundary: `core.current_identity_id()` resolves `core.identities.auth_user_id` from `auth.uid()`. This is materially different from the historical repository migration, which used transaction-local `app.identity_id` / `app.organisation_id` settings.

## Decision

Treat the **deployed Core schema and its security behavior as the verification target**, but treat the **repository migration history as the reproducible source of truth that must be brought into parity**.

Do not add another application authorization layer, fake Auth context, or compatibility shim merely to conceal this drift.

Before the next major application/runtime layer is implemented, ZENITH must establish a reproducible migration chain that can provision a fresh non-production database with the same effective schema, authorization boundary, RLS behavior, public-data protections, evidence/provenance structures, knowledge-graph structures, space-time structures, research structures, and security hardening that are currently verified in the dedicated Core.

## Required remediation

1. Inventory the complete live schema, including tables, columns, types, constraints, indexes, RLS policies, grants, views, functions, function privileges, extensions, and relevant security settings.
2. Map every live migration to a committed repository migration or an explicit reconciliation migration.
3. Preserve the historical migrations; do not rewrite committed migration history merely to make filenames appear current.
4. Introduce forward reconciliation migrations from the current repository baseline where necessary.
5. Re-run the authorization and public-data security verification against a fresh disposable database created from repository migrations.
6. Only then treat the repository as capable of reproducing the verified Past Intelligence Core.

## Security boundary

This ADR does **not** authorize weakening RLS, replacing `auth.uid()` with client-controlled context, adding service-role credentials to tests, or modifying security controls solely to achieve migration parity.

Supabase Auth remains the trusted identity boundary, and RLS remains an enforcement layer. The canonical `core.authorize_capability(...)` function remains the shared capability decision boundary.

## Consequence

The next high-value infrastructure task is **migration/schema convergence**, not a new UI, tool gateway, hardware adapter, or application-specific authorization implementation.

Authenticated positive/negative authorization tests remain pending until the repository can provision a reproducible test database and an established test runtime can establish real Supabase Auth sessions.
