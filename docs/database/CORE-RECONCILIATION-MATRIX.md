# Core Reconciliation Matrix

**Status:** Working architectural reconciliation artifact  
**Basis:** Verified live Supabase Core/Audit contract and repository migration inventory  
**Scope:** Core/Audit only; Supabase-managed infrastructure is explicitly out of scope

## Purpose

This matrix converts the verified live contract into bounded repository reconciliation units. An object is reconciled only when its definition, constraints, material indexes, RLS, grants, function security context, triggers, views, and sensitive-data behavior are represented or explicitly classified.

The live project contains 14 applied migration generations. Repository `main` now contains foundation reconciliation through `0004`, evidence/provenance through `0005`, and Knowledge Graph reconciliation through `0006` on the current PR branch. The repository is not yet a complete reproduction of the live contract.

## Reconciliation units

| Unit | Live objects | Repository status | Action | Gate |
|---|---|---|---|---|
| Foundation | organisations, identities, resources, resource_memberships, policy_obligations | Reconciled in `0003`/`0004`; CI fresh-db gate green | Verify against live contract | Authenticated runtime verification remains open |
| Evidence | sources, evidence, observations, measurements, claims, claim_evidence, interpretations, hypotheses, provenance_links | Reconciled in `0005`; CI fresh-db gate green | Verify against live contract | Authenticated runtime verification remains open |
| Knowledge graph | entity_relationships, entity_assertions | Reconciled in `0006` on current PR | Merge only after fresh DB + exact contract review | Relationship visibility + tenant isolation |
| Space/time | spatial_representations, resource_spatial_relations, time_spans, resource_time_spans | Missing from committed migrations; PostGIS platform dependency | Forward reconciliation; preserve platform-managed PostGIS | Spatial safety + extension review |
| Research | research_questions, research_projects, research_project_questions, datasets, research_project_datasets, methods, research_project_methods, research_runs, research_outputs | Missing from committed migrations | Forward reconciliation migration | Research RLS + dependency verification |
| Audit/security | audit.events, audit.kernel_gate_results, authorization/current-context helpers, canonical capability boundary | Partial | Reconcile exact security contract | ACL + security-definer + auth tests |
| Public projections | six `core.public_*` views | Foundation and Knowledge Graph projections reconciled; four domain projections remain | Reconcile exact view definitions/options/privileges | Anonymous safety + sensitive-coordinate tests |

## Knowledge Graph boundary

The Knowledge Graph unit models a directed relationship between two protected resources, with a predicate, epistemic status, optional confidence and temporal validity, plus optional evidence and asserting identity. Relationship assertions separately record support, contradiction, qualification, derivation, or contextualization and may reference evidence or source records.

Relationship visibility requires both subject and object resources to be readable through the canonical resource authorization boundary. Assertions inherit visibility from the relationship subject. No write RLS policies are invented because the verified live contract exposes authenticated SELECT policies only.

The public relationship projection intentionally excludes organisation identity, assertion payload, asserting identity, evidence linkage, and assertion rows. It exposes relationship identifiers and public subject/object resource identifiers only when both endpoint resources are public.

## Evidence/provenance boundary

The evidence unit preserves the canonical epistemic chain: source → evidence → observation/measurement → claim → interpretation/hypothesis, with explicit claim/evidence support or contradiction and provenance links for entity-to-entity lineage.

## Security contract

All live Core/Audit base tables have RLS enabled. Protected reads delegate to the canonical resource authorization helpers where applicable. The only direct anonymous base-table read currently verified is public `core.resources`; public-facing projections are separately controlled.

No reconciliation migration may disable RLS, broaden anonymous access, replace resource-level authorization with organisation-only access, expose precise sensitive coordinates, restore obsolete transaction-local identity context, grant direct public execution of protected SECURITY DEFINER helpers, or treat an unknown capability as allowed.

## Public projection contract

The live Core contract includes six public projections: `core.public_resources`, `core.public_entity_relationships`, `core.public_resource_spatial_relations`, `core.public_resource_time_spans`, `core.public_spatial_representations`, and `core.public_research_questions`. They must be reproduced from verified definitions, not merely recreated by name.

## Platform-managed classification

PostGIS is installed in the public schema and is platform-managed. Reconciliation preserves the dependency without reconstructing Supabase-managed extension objects. The known `ST_EstimatedExtent` advisor residual remains a separate platform-hardening decision.

## Verification order

1. Reproduce each bounded unit on a disposable fresh database.
2. Verify columns, defaults, constraints and material indexes.
3. Verify RLS, policies and role grants exactly.
4. Verify SECURITY DEFINER ownership, `search_path`, and EXECUTE ACLs.
5. Verify public projections and sensitive-coordinate behavior.
6. Add real Auth identities for authenticated positive/negative tests; until then, runtime authorization tests remain explicitly unexecuted.
7. Only after convergence, prepare a production forward migration.

## Non-goals

- Do not reconstruct `auth`, `storage`, or other Supabase-managed schemas.
- Do not silently mutate production data.
- Do not delete historical repository migrations.
- Do not move PostGIS merely to satisfy an advisor warning.
- Do not claim database parity from green GitHub CI alone.
- Do not claim authenticated authorization tests passed while the Auth test population is empty.
