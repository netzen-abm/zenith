# Live Migration Generation Mapping

**Status:** In progress — mapping baseline  
**Purpose:** Convert the verified deployed Core contract into an explicit repository reconciliation plan without destructive recreation or speculative production DDL.

## 1. Mapping rule

The deployed Supabase Core currently contains 14 migration generations while repository `main` contains only the initial security kernel and canonical capability-boundary migrations. Therefore the repository is **not yet a complete historical migration ledger**.

This document deliberately distinguishes:

- **historical generation:** evidence that a change was deployed;
- **repository representation:** committed SQL that reproduces that generation;
- **reconciliation artifact:** a forward migration that brings a repository baseline to the verified live contract;
- **verification artifact:** tests proving schema/security behavior.

The objective is behavioral parity, not filename parity.

## 2. Generation map

| Live generation | Architectural area | Repository representation | Reconciliation status |
|---|---|---|---|
| 1 `past_intelligence_core_security_kernel_v0_1` | Core/Audit security foundation | `core/database/migrations/0001_security_kernel.sql` | Partially represented; live schema has materially evolved |
| 2 `tighten_public_data_api_surface` | Public data exposure | Not separately represented | Must be mapped into forward reconciliation |
| 3 `restore_public_rls_read_path` | Public RLS read path | Not separately represented | Must be mapped into forward reconciliation |
| 4 `separate_anon_public_resource_policy` | Anonymous/public resource policy | Not separately represented | Must be mapped into forward reconciliation |
| 5 `harden_postgis_public_surface` | PostGIS/public surface | Not separately represented | Must be mapped or explicitly recorded as platform-managed residual |
| 6 `close_postgis_extension_public_privileges` | PostGIS extension privileges | Not separately represented | Must be mapped; avoid speculative platform DDL |
| 7 `evidence_provenance_audit_kernel_v0_1` | Evidence/provenance/audit | Not separately represented | Core reconciliation required |
| 8 `evidence_provenance_runtime_gate_v0_1` | Runtime evidence/provenance gate | Not separately represented | Behavioral test/reconciliation required |
| 9 `knowledge_graph_relationship_kernel_v0_1` | Entity relationships/assertions | Not separately represented | Core reconciliation required |
| 10 `space_time_kernel_v0_1` | Spatial/temporal model | Not separately represented | Core/PostGIS reconciliation required |
| 11 `research_workflow_kernel_v0_1` | Research workflow | Not separately represented | Core reconciliation required |
| 12 `harden_authorization_helper_execution_context` | Authorization helper security | Not separately represented | Must reproduce exact function security context |
| 13 `close_authorization_helper_direct_execute` | Authorization EXECUTE boundary | Not separately represented | Must reproduce exact ACLs |
| 14 `add_canonical_capability_policy_boundary` | Canonical capability authorization boundary | `core/database/migrations/0002_capability_policy_boundary.sql` | Represented; live behavior must still be verified on fresh DB |

## 3. Reconciliation units

Do not create one migration per historical filename merely to imitate missing history. Use bounded forward units whose atomicity and reviewability are clear:

1. **Core foundation reconciliation** — tables, columns, constraints, indexes, timestamps, and required extensions.
2. **Evidence/provenance reconciliation** — sources, evidence, observations, measurements, claims, interpretations, hypotheses, provenance, and audit structures.
3. **Knowledge/space-time reconciliation** — entity assertions/relationships, spatial representations/relations, time spans/relations, and public projections.
4. **Research reconciliation** — questions, projects, datasets, methods, runs, outputs, and associations.
5. **Security reconciliation** — RLS policies, grants, function definitions, SECURITY INVOKER/DEFINER properties, search paths, and trigger behavior.
6. **Public surface reconciliation** — public views and anonymous/authenticated access boundaries, including sensitive-coordinate generalization.

Each unit must remain below the repository source-size limit or be split only where the split preserves transactional atomicity and review clarity.

## 4. Known divergence requiring explicit treatment

The live `core.identities` contract contains `auth_user_id` and `display_name`; the live `core.resources` contract contains `epistemic_status`, `sensitivity`, and PostGIS `geom`; and the live authorization context resolves identity through `auth.uid()`.

The historical repository security migration instead used transaction-local `app.identity_id` and `app.organisation_id`. This is an architectural divergence, not a cosmetic migration difference. The reconciliation must adopt the verified canonical live contract rather than reintroducing the obsolete context model.

## 5. Security invariants

Reconciliation must preserve:

- RLS enabled on every protected Core/Audit base table;
- anonymous access only through explicitly public-safe surfaces;
- authenticated protected access through canonical authorization/resource policy;
- cross-tenant isolation;
- self-only identity access;
- identity-scoped audit access;
- public projections using `security_invoker=true`;
- sensitive coordinates generalized/redacted according to sensitivity and precision rules;
- unknown capability/action families fail closed;
- SECURITY DEFINER functions remain narrow, owned by `postgres`, and use an empty `search_path`;
- no user-metadata-based authorization;
- no speculative weakening of policy to make tests pass.

## 6. Validation sequence

Before production reconciliation:

1. provision a fresh non-production database from repository migrations;
2. record resulting schema, constraints, indexes, functions, triggers, views, grants and RLS;
3. compare against `LIVE-CORE-CONTRACT-INVENTORY.md`;
4. run public/anonymous safety tests;
5. run authenticated positive/negative tests with real Auth identities;
6. run cross-tenant isolation tests;
7. run sensitive-coordinate exposure tests;
8. only after convergence, consider applying a bounded forward migration to the live project.

## 7. Explicit non-goals

This work does not:

- reconstruct Supabase-managed schemas wholesale;
- copy platform default privileges into application migrations without need;
- move PostGIS merely to silence an advisor;
- silently change live data;
- delete historical repository migrations;
- claim authenticated integration tests passed when no Auth test identities exist;
- treat a green SQL/static CI run as proof of database parity.

## 8. Current conclusion

The live contract is now sufficiently inventoried to begin **bounded reconciliation design**. The next implementation artifact should be a disposable/fresh-database reproduction and diff harness, followed by the smallest necessary forward reconciliation migration(s). No production DDL should be introduced until that comparison identifies a concrete, reviewed gap.
