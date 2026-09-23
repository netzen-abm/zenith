# Live Core Contract Inventory

**Date:** 2026-09-23 — re-baselined against current `main`  
**Project:** ZENITH / Past Intelligence Core  
**Purpose:** Evidence baseline for migration/schema convergence.

## 1. Verified migration history and current repository state

The deployed Supabase project baseline currently reports 14 historical migration generations. The repository has since advanced through migration `0021_field_observation_requests.sql` using bounded forward reconciliation units. Therefore the historical 14-generation count remains evidence about the deployed lineage, not a count of repository migration files.

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

## 4. Live structural constraints

The live contract has primary keys across all listed base tables, composite primary keys on association tables, unique constraints on `core.identities.auth_user_id` and `core.organisations.slug`, and foreign keys enforcing the evidence/observation/claim/relationship/research/resource graph. Important checks constrain epistemic status, sensitivity, confidence ranges, relationship self-links, relationship validity ordering, spatial precision/type, time precision/order, research status, and association roles.

Foreign-key delete behavior is part of the effective contract and must be preserved during reconciliation, including `CASCADE`, `RESTRICT`, and `SET NULL` semantics where currently deployed.

## 5. Live indexes

Verified indexes include primary/unique indexes, evidence/resource/source relationship indexes, organisation indexes, provenance from/to indexes, spatial GiST indexes on `core.resources.geom` and `core.spatial_representations.geom`, and time-range indexes on `core.time_spans`. The live index set must be reproduced deliberately; performance-advisor findings must not be treated as permission to remove or add indexes blindly.

## 6. Authorization contract

Live helpers include:

- `core.current_identity_id()`
- `core.current_organisation_id()`
- `core.can_read_resource(uuid)`
- `core.can_write_resource(uuid)`
- `core.authorize_capability(text, uuid, text)`

The authorization helpers use an empty `search_path`. The capability boundary is `SECURITY INVOKER`; narrowly scoped authorization helpers are `SECURITY DEFINER` and therefore require exact privilege/search-path verification.

The canonical capability boundary permits defined read/discovery actions and defined write actions, and denies unknown capability families rather than failing open.

## 7. Live RLS policy contract

The live Core exposes SELECT policies for authenticated users across the research, evidence, provenance, spatial/time, resource, membership, and knowledge-graph domains. `core.resources` additionally has a dedicated anonymous public-read policy restricted to `sensitivity = 'public'`.

Policy predicates delegate protected-resource decisions to the canonical authorization helpers. Source access uses public sensitivity or the current organisation; identity access is self-only; audit-event access is identity-scoped. The exact policy definitions are the security contract and must be preserved, not approximated by table-level grants.

## 8. Public projections

Verified public views include:

- `core.public_resources`
- `core.public_spatial_representations`
- `core.public_entity_relationships`
- `core.public_resource_spatial_relations`
- `core.public_resource_time_spans`
- `core.public_research_questions`

All six are `security_invoker=true`. Their exact live definitions were extracted. Public resource projection exposes only public resources; spatial representations expose geometry only for public resources at generalized/regional/unknown precision; relationship and spatial-relation projections require both resources to be public; time-span projection requires the resource to be public; research-question projection exposes only `open` and `active` questions.

## 9. Grants and execution surface

Live base tables are owned by `postgres`. Authenticated has SELECT on Core tables and `audit.events`; anonymous has SELECT on `core.resources`. Public projection views grant SELECT to `anon` and `authenticated`. `audit.kernel_gate_results` has no authenticated table grant in the extracted ACL.

The five Core authorization/context functions are owned by `postgres`. `authorize_capability(text, uuid, text)` grants EXECUTE to `authenticated` and not to `public`; `current_identity_id`, `current_organisation_id`, `can_read_resource`, and `can_write_resource` have no explicit non-owner EXECUTE grant in their ACLs. The five trigger functions retain PostgreSQL's default PUBLIC EXECUTE plus authenticated EXECUTE in their explicit ACLs.

Schema ACLs grant USAGE to `authenticated` on `core` and `audit`, and USAGE to `anon` on `core`. No Core/Audit sequences were identified in the extracted catalog. Default privileges exist primarily in Supabase-managed schemas (`auth`, `extensions`, `graphql`, `graphql_public`, `public`, `realtime`, `storage`) rather than Core/Audit; they should not be copied into ZENITH application migrations without a specific need.

## 10. Triggers

Five user-defined triggers were verified: updated-at triggers on `core.claims`, `core.entity_relationships`, `core.research_projects`, `core.research_questions`, and `core.resources`. Their trigger functions use an empty `search_path` and are `SECURITY INVOKER`.

## 11. Types and extensions

No user-defined enum/domain/composite types were identified in `core` or `audit`; PostgreSQL's table row composite types appeared in the catalog query and are not independent application types.

PostGIS 3.3.7 is installed in `public`. The broader Supabase platform extension inventory includes pgcrypto and uuid-ossp in `extensions`, among many platform-managed extensions. The full platform inventory is not an instruction to recreate every available extension in ZENITH migrations.

The known PostGIS advisor residual remains: three public `ST_EstimatedExtent` overloads are owned by `supabase_admin` and currently grant EXECUTE to `anon`, `authenticated`, and `service_role`. This is a platform-security residual to be handled as a separate bounded hardening decision, not silently altered as part of migration parity.

## 12. Remaining exact extraction / verification

The structural contract extraction is now substantially complete. Remaining closure work is behavioral rather than broad catalog discovery:

- verify fresh-database reproduction from repository migrations;
- compare resulting schema/security behavior with this live contract;
- execute authenticated positive/negative authorization tests once a real Auth test runtime is available;
- verify cross-tenant isolation and sensitive-coordinate exposure end-to-end;
- separately decide whether the known PostGIS `ST_EstimatedExtent` platform residual requires further hardening.

## 13. Reconciliation rule

Forward migrations must reproduce effective live behavior, not merely object names. Historical migrations remain intact. New reconciliation migrations must be bounded, review-gated, and subject to the 190-line source governance rule where splitting preserves atomicity.

Do not apply speculative live DDL. First map each live generation to repository history or an explicit reconciliation artifact, then validate the result on a fresh non-production database.

## 14. Closure criteria

Migration parity is closed only after:

1. every live migration generation is represented by committed repository history or an explicit forward reconciliation artifact;
2. a fresh non-production database can be provisioned from repository migrations;
3. schema and security behavior are compared against the live contract;
4. RLS/public-projection/cross-tenant tests pass;
5. authenticated positive and negative authorization tests pass;
6. sensitive-coordinate exposure is verified;
7. the migration inventory is updated to `verified`.

Until then, the repository must treat migration parity as **open**.
