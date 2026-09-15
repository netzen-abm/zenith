# Live Core → Repository Migration Parity Inventory

**Status:** In progress  
**Verified:** 2026-09-15  
**Scope:** ZENITH Past Intelligence Core / Supabase

## Purpose

Record the verified gap between the deployed Core database and the committed
repository migration chain. This is an inventory and reconciliation contract,
not a claim that parity has already been achieved.

## Verified live migration generations

| # | Live migration | Repository status |
|---|---|---|
| 01 | `past_intelligence_core_security_kernel_v0_1` | Partially represented by `0001_security_kernel.sql`; not equivalent |
| 02 | `tighten_public_data_api_surface` | Missing as committed migration |
| 03 | `restore_public_rls_read_path` | Missing as committed migration |
| 04 | `separate_anon_public_resource_policy` | Missing as committed migration |
| 05 | `harden_postgis_public_surface` | Missing as committed migration |
| 06 | `close_postgis_extension_public_privileges` | Missing as committed migration |
| 07 | `evidence_provenance_audit_kernel_v0_1` | Missing as committed migration |
| 08 | `evidence_provenance_runtime_gate_v0_1` | Missing as committed migration |
| 09 | `knowledge_graph_relationship_kernel_v0_1` | Missing as committed migration |
| 10 | `space_time_kernel_v0_1` | Missing as committed migration |
| 11 | `research_workflow_kernel_v0_1` | Missing as committed migration |
| 12 | `harden_authorization_helper_execution_context` | Missing as committed migration |
| 13 | `close_authorization_helper_direct_execute` | Missing as committed migration |
| 14 | `add_canonical_capability_policy_boundary` | Represented by `0002_capability_policy_boundary.sql`; effective runtime still requires parity verification |

## Known live schema domains

The deployed Core contains, in addition to the original security kernel:

- claims and claim/evidence relationships
- evidence and provenance links
- observations and measurements
- interpretations and hypotheses
- knowledge-graph entity assertions and relationships
- space/time representations and resource relations
- research questions, projects, datasets, methods, runs and outputs
- public projections
- audit/kernel gate results
- authorization/capability policy helpers

The live model also contains fields not represented in the original repository
baseline, including identity linkage to Supabase Auth, resource epistemic status,
resource sensitivity, precise geometry, and membership roles.

## Reconciliation rules

1. Do not rewrite historical migrations merely to make them resemble current state.
2. Preserve the existing migration history and add forward reconciliation migrations.
3. Capture exact live DDL, policies, grants, functions, views, triggers, indexes,
   constraints, extensions and types before writing equivalent SQL.
4. Do not use `IF NOT EXISTS` as a substitute for parity verification.
5. Preserve RLS, authorization, public-data minimization and precise-coordinate
   protections; parity work must not weaken them.
6. Every reconciliation migration must remain within the 190-line source limit
   where practical; split by bounded capability rather than arbitrarily.
7. Verify the effective live behavior after every migration batch.
8. A fresh environment is reproducible only after the committed chain produces
   equivalent effective schema and security behavior.

## Required evidence before closure

- complete live DDL/security inventory
- mapping from every live migration generation to repository artifacts
- forward reconciliation migrations
- fresh-environment migration verification
- authenticated positive and negative authorization tests
- cross-tenant isolation verification
- sensitive-resource/public-projection verification
- audit-path verification
- final comparison of live and repository schema/security state

## Current decision

**Migration/schema convergence is the next highest-value implementation layer.**
The repository must not be described as fully reproducible until the evidence
above is complete. The existing canonical authorization boundary remains the
policy decision boundary and must be preserved during reconciliation.
