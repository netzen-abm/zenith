# Live Migration Generation Mapping

**Status:** In progress — mapping baseline  
**Purpose:** Convert the verified deployed Core contract into an explicit repository reconciliation plan without destructive recreation or speculative production DDL.

## 1. Mapping rule

The deployed Supabase Core contains 14 migration generations. Repository `main` now contains the initial kernel, capability boundary, and forward foundation reconciliation; PR #16 adds the evidence/provenance unit. The repository is **not yet a complete historical migration ledger**.

This document distinguishes historical generation, repository representation, reconciliation artifact, and verification artifact. The objective is behavioral parity, not filename parity.

## 2. Generation map

| Live generation | Architectural area | Repository representation | Reconciliation status |
|---|---|---|---|
| 1 `past_intelligence_core_security_kernel_v0_1` | Core/Audit security foundation | `0001_security_kernel.sql` | Reconciled forward; live divergence documented |
| 2 `tighten_public_data_api_surface` | Public data exposure | `0003`/`0004` foundation reconciliation | Represented in current foundation contract |
| 3 `restore_public_rls_read_path` | Public RLS read path | `0004` foundation security reconciliation | Represented; fresh-db gate green |
| 4 `separate_anon_public_resource_policy` | Anonymous/public resource policy | `0004` foundation security reconciliation | Represented; fresh-db gate green |
| 5 `harden_postgis_public_surface` | PostGIS/public surface | Platform-managed classification + foundation geometry | Residual separately tracked |
| 6 `close_postgis_extension_public_privileges` | PostGIS extension privileges | Platform-managed classification | No speculative platform DDL |
| 7 `evidence_provenance_audit_kernel_v0_1` | Evidence/provenance/audit | `0005_evidence_provenance_reconciliation.sql` in PR #16 | Implemented; CI fresh-db gate green |
| 8 `evidence_provenance_runtime_gate_v0_1` | Runtime evidence/provenance gate | `tests/database/evidence-provenance-assertions.sql` + fresh-db integration | Schema/security gate implemented; behavioral Auth tests remain open |
| 9 `knowledge_graph_relationship_kernel_v0_1` | Entity relationships/assertions | Not yet represented | Core reconciliation required |
| 10 `space_time_kernel_v0_1` | Spatial/temporal model | Not yet represented | Core/PostGIS reconciliation required |
| 11 `research_workflow_kernel_v0_1` | Research workflow | Not yet represented | Core reconciliation required |
| 12 `harden_authorization_helper_execution_context` | Authorization helper security | `0004` foundation security reconciliation | Represented; fresh-db gate green |
| 13 `close_authorization_helper_direct_execute` | Authorization EXECUTE boundary | `0004` + `0002` | Represented; authenticated runtime verification remains open |
| 14 `add_canonical_capability_policy_boundary` | Canonical capability authorization boundary | `0002_capability_policy_boundary.sql` | Represented; fresh-db security contract green |

## 3. Reconciliation units

Use bounded forward units rather than imitating missing historical filenames:

1. **Core foundation** — tables, columns, constraints, indexes, timestamps, required extensions.
2. **Evidence/provenance** — sources, evidence, observations, measurements, claims, interpretations, hypotheses, provenance, and bounded runtime assertions.
3. **Knowledge/space-time** — entity assertions/relationships, spatial representations/relations, time spans/relations, and public projections.
4. **Research** — questions, projects, datasets, methods, runs, outputs, and associations.
5. **Security** — RLS, grants, function security context, search paths, and triggers.
6. **Public surface** — public views and anonymous/authenticated boundaries, including sensitive-coordinate generalization.

Each unit remains below the repository source-size limit or is split only where the split preserves atomicity and review clarity.

## 4. Security invariants

Reconciliation preserves RLS on protected tables, anonymous access only through explicitly public-safe surfaces, resource-level authorization, cross-tenant isolation, self-only identity access, public projection `security_invoker=true`, sensitive-coordinate protection, fail-closed unknown capabilities, narrow SECURITY DEFINER functions with empty `search_path`, and no user-metadata-based authorization.

## 5. Validation sequence

Before production reconciliation:

1. provision a fresh non-production database from repository migrations;
2. record schema, constraints, indexes, functions, triggers, views, grants and RLS;
3. compare against `LIVE-CORE-CONTRACT-INVENTORY.md`;
4. run public/anonymous safety tests;
5. run authenticated positive/negative tests with real Auth identities;
6. run cross-tenant isolation tests;
7. run sensitive-coordinate exposure tests;
8. only after convergence, consider a bounded forward migration to live.

## 6. Explicit non-goals

- Do not reconstruct Supabase-managed schemas wholesale.
- Do not copy platform default privileges without need.
- Do not move PostGIS merely to silence an advisor.
- Do not silently change live data.
- Do not delete historical repository migrations.
- Do not claim authenticated integration tests passed when no Auth test identities exist.
- Do not treat green SQL/static CI as proof of complete database parity.

## 7. Current conclusion

Foundation reconciliation is merged. Evidence/provenance reconciliation is now a bounded PR with a green fresh-database CI gate. The next architectural unit after review/merge is **Knowledge Graph relationship/assertion reconciliation**, followed by Space/Time. Production DDL remains deferred until behavioral parity and Auth-backed tests converge.
