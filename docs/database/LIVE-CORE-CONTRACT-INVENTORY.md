# Live Core Contract Inventory

**Date:** 2026-09-15  
**Project:** ZENITH / Past Intelligence Core  
**Purpose:** Evidence baseline for migration/schema convergence.

## 1. Verified migration history

The deployed Supabase project currently reports 14 migration generations:

1. `past_intelligence_core_security_kernel_v0_1`
2. `tighten_public_data_api_surface`
3. `restore_public_rls_read_path`
4. `separate_anon_public_resource_policy`
5. `harden_postgis_public_surface`
6. `close_postgis_extension_public_privileges`
7. `evidence_provenance_audit_kernel_v0_1`
8. `evidence_provenance_runtime_gate_v0_1`
9. `knowledge_graph_relationship_kernel_v0_1`
10. `space_time_kernel_v0_1`
11. `research_workflow_kernel_v0_1`
12. `harden_authorization_helper_execution_context`
13. `close_authorization_helper_direct_execute`
14. `add_canonical_capability_policy_boundary`

Repository `main` historically contains only two migration files, so migration parity is not yet proven.

## 2. Live table domains

The deployed Core/Audit contract includes:

- `core.organisations`, `core.identities`, `core.resources`
- `core.resource_memberships`, `core.policy_obligations`
- `core.sources`, `core.evidence`, `core.observations`, `core.measurements`
- `core.claims`, `core.claim_evidence`, `core.interpretations`, `core.hypotheses`
- `core.entity_relationships`, `core.entity_assertions`, `core.provenance_links`
- `core.spatial_representations`, `core.time_spans`
- `core.resource_spatial_relations`, `core.resource_time_spans`
- `core.research_questions`, `core.research_projects`, `core.research_runs`
- `core.research_project_questions`, `core.research_project_datasets`
- `core.research_project_methods`, `core.research_outputs`
- `core.datasets`, `core.methods`
- `audit.events`, `audit.kernel_gate_results`

All listed base tables were verified with RLS enabled in the live Core.

## 3. Critical live schema differences

The live contract materially extends the original repository security migration.

`core.identities` includes `auth_user_id` and `display_name`.

`core.resources` includes `epistemic_status`, `sensitivity`, and PostGIS `geom`.

`core.resource_memberships` uses `membership_role`.

The live authorization context resolves identity from `auth.uid()` through `core.identities.auth_user_id`; the historical repository migration used transaction-local `app.identity_id` and `app.organisation_id`.

These differences must be reconciled explicitly. They must not be hidden by `IF NOT EXISTS` recreation patterns.

## 4. Authorization contract

Live helpers include:

- `core.current_identity_id()`
- `core.current_organisation_id()`
- `core.can_read_resource(uuid)`
- `core.can_write_resource(uuid)`
- `core.authorize_capability(text, uuid, text)`

The authorization helpers use an empty `search_path`. The capability boundary is `SECURITY INVOKER`; narrowly scoped authorization helpers are `SECURITY DEFINER` and therefore require exact privilege/search-path verification.

The canonical capability boundary permits defined read/discovery actions and defined write actions, and denies unknown capability families rather than failing open.

## 5. Live RLS policy domains

Verified policy coverage includes:

- tenant/member reads for organisations and identities
- resource public/authenticated reads
- membership access
- source/evidence access
- observation/measurement access
- claim/interpretation/hypothesis access
- relationship and assertion access
- provenance access
- spatial/time access
- research project/question/run/output access
- audit event access

No reconciliation migration may weaken these policies merely to obtain migration success.

## 6. Public projections

Verified public views include:

- `core.public_resources`
- `core.public_spatial_representations`
- `core.public_entity_relationships`
- `core.public_resource_spatial_relations`
- `core.public_resource_time_spans`
- `core.public_research_questions`

Public resource projection exposes only public resources. Spatial representations expose geometry only when the resource is public and precision is generalized/regional/unknown. Sensitive resources do not receive precise geometry through the public projections.

## 7. Required extraction before reconciliation SQL

The following still require exact repository-grade extraction:

- primary/unique/check constraints and foreign keys
- complete index definitions
- all table and sequence grants
- function signatures, definitions, ownership and privileges
- trigger definitions
- enum/custom type definitions
- extension versions and privileges
- complete view definitions and view privileges
- complete RLS policy definitions
- relevant PostGIS/public-schema security state

## 8. Reconciliation rule

Forward migrations must reproduce effective live behavior, not merely object names. Historical migrations remain intact. New reconciliation migrations must be bounded, review-gated, and subject to the 190-line source governance rule where splitting preserves atomicity.

## 9. Closure criteria

Migration parity is closed only after:

1. every live migration generation is represented by committed repository history or an explicit forward reconciliation artifact;
2. a fresh non-production database can be provisioned from repository migrations;
3. schema and security behavior are compared against the live contract;
4. RLS/public-projection/cross-tenant tests pass;
5. authenticated positive and negative authorization tests pass;
6. sensitive-coordinate exposure is verified;
7. the migration inventory is updated to `verified`.

Until then, the repository must treat migration parity as **open**.
