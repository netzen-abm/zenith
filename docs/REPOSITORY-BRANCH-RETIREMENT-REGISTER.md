# ZENITH Remote Branch Retirement Register

**Status:** Operational register  
**Canonical base:** `main`  
**Branch budget:** 9 total active development branches, including `main`

**Source-code limit:** every tracked source file must remain at or below 180 lines; split by responsibility rather than compressing logic.

## Purpose

This register separates **Git history preservation** from **remote branch retention**.

A merged commit remains permanently recoverable through Git history, tags, pull requests, and commit SHAs. A remote branch therefore remains only when it represents a genuinely active workstream.

## Retirement rules

1. Never merge obsolete generations solely to eliminate a branch.
2. Never force-move a branch to `main` as a substitute for deletion.
3. Never create placeholder branches to satisfy the nine-branch budget.
4. A merged branch is a retirement candidate.
5. Duplicate branches pointing at the same commit are retirement candidates unless one has an explicit active purpose.
6. An unmerged branch requires a content review before retirement.
7. Any unique, still-required work must be transferred through a reviewed PR before the source branch is retired.
8. The remote branch inventory is authoritative for the count.

## High-confidence retirement candidates

These live remote branches are confirmed **0 commits ahead of `main`** and are therefore safe retirement candidates without a merge-for-retirement maneuver:

- `feat/operation-queue-runtime-mainline`
- `feat/persistent-execution-reservation`
- `feat/postgres-coordinator-e2e-converged`
- `fix/operation-store-mutation-boundary`
- `refactor/canonical-execution-lifecycle`
- `test/operations-concurrency-gate`

They are behind `main` and add no unique commits relative to the current mainline. Delete them directly when remote branch-delete authority is available.

## Requires content review before retirement

These live remote branches contain commits not present in `main` by SHA comparison. Their unique commits must be evaluated against the current tree before retirement; do not merge them merely to eliminate the branch:

- `feat/operations-persistence-postgres`
- `feat/postgres-execution-reservation-adapter`
- `feat/research-intelligence-capability`
- `feat/research-provider-contract`
- `feat/vertical-evidence-annotation`
- `fix/authorization-context-for-rls`
- `test/auth-integration-contract`
- `test/fresh-db-reconciliation-harness`
- `revert/direct-migration-parity-marker`

The current canonical workstream branches are intentionally retained:

- `feat/ai-agent-infrastructure`
- `feat/api-sdk-contracts`
- `feat/field-acquisition`
- `feat/knowledge-graph-next`
- `feat/multisurface-adapters`
- `feat/research-intelligence-next`
- `feat/security-release-engineering`
- `feat/space-time-next`

## Target active slots

The steady-state budget is:

1. `main`
2. Archaeological capability A
3. Archaeological capability B
4. Shared platform infrastructure
5. API / SDK contracts
6. Database / schema
7. Multisurface adapters
8. AI / agent infrastructure
9. Security / release engineering

Only genuine work occupies a slot. If fewer than eight concurrent workstreams exist, the repository intentionally remains below nine branches rather than creating placeholders.

## Ecosystem architecture rule

All active capabilities must consume the shared chain:

`Identity → Authorization → Tenant/RLS → Capability Contract → Operation → Reservation → Handler → Durable Outcome → Outbox → Provenance`

A domain capability may add domain behavior, but it may not create a competing authorization, tenant-isolation, lifecycle, reservation, idempotency, audit, or protected-mutation mechanism.

## Current verified state — 2026-10-05

The live GitHub remote was re-read on 2026-10-05 and contains **24 branches**. `main` is authoritative. The nine intended active slots remain an architectural target, but the remote count is not yet compliant because this connected GitHub interface exposes no remote-branch deletion operation.

The canonical active workstream set remains:

- `main`
- `feat/ai-agent-infrastructure`
- `feat/api-sdk-contracts`
- `feat/field-acquisition`
- `feat/knowledge-graph-next`
- `feat/multisurface-adapters`
- `feat/research-intelligence-next`
- `feat/security-release-engineering`
- `feat/space-time-next`

The six high-confidence candidates above are confirmed 0-ahead of `main`; merging them would create no architectural value and is prohibited by this register. The remaining review branches have unique commits relative to `main`, so retirement requires content-level transfer analysis. Unique commits are not automatically required: `main` remains the source of truth.


### Enforcement decision

1. Do not force-move any branch to `main` as a substitute for deletion.
2. Do not create placeholder branches.
3. Do not merge stale work merely to retire a branch.
4. Transfer only genuinely missing, still-required work through reviewed commits/PRs.
5. Retire branches that add no current value once remote deletion is performed from a client with branch-delete authority.
6. Re-read the remote inventory after every retirement action.
7. Update CI's nine-branch allowlist only after the remote inventory actually reaches the canonical nine.

The nine-branch target is therefore **architecturally selected but operationally not yet complete**.

## Collective retirement execution — 2026-10-05

The current remote inventory has been independently verified at 24 branches with no open pull requests. The six 0-ahead branches and the nine additional branches whose unique changed paths are already represented in the current main tree are eligible for archival-tagging and retirement by the repository's collective-retirement workflow. The migration-parity revert branch is also eligible because its unique migration marker is absent from the branch itself and absent from current main, confirming it does not carry active implementation work.

The minimal retirement executor is installed at `.github/workflows/execute-nine-branch-retirement.yml`; it archives branch heads before deletion and verifies the final nine-branch invariant.
