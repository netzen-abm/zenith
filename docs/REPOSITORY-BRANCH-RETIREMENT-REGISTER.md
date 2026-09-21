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

The following branches are backed by merged PRs or are duplicate branch generations and should be deleted when the GitHub remote-delete capability is available:

- `feat/vertical-evidence-annotation`
- `feat/execution-kernel-conformance`
- `feat/execution-kernel-convergence`
- `feat/durable-execution-outcome-audit`
- `refactor/canonical-execution-lifecycle`
- `feat/postgres-coordinator-e2e-converged`
- `feat/execution-coordinator-handler-boundary`
- `feat/persistent-execution-reservation`
- `feat/operation-queue-runtime-mainline`
- `feat/operations-persistence-postgres`
- `docs/operation-persistence-supabase-boundary`
- `feat/atomic-operation-store-contract`
- `feat/execution-coordinator-contract`
- `feat/execution-coordinator-runtime`
- `feat/operation-queue-contract`
- `feat/operation-queue-runtime`
- `feat/operation-idempotency-retry-expiry`
- `feat/execution-lease-reconciliation`
- `feat/explicit-organisation-context`
- `audit/core-convergence-and-tenant-context`
- `db/knowledge-graph-reconciliation`
- `db/research-reconciliation`
- `db/space-time-reconciliation`
- `feat/core-evidence-provenance-reconciliation`
- `feat/core-foundation-reconciliation`
- `docs/core-reconciliation-matrix`
- `test/fresh-db-reconciliation-harness`
- `chore/database-live-contract-inventory`
- `revert/direct-migration-parity-marker`
- `chore/enforce-source-file-size`
- `docs/database-source-of-truth-audit`
- `feat/core-policy-boundary-clean`
- `docs/auth-integration-test-contract`
- `chore/ci-security-baseline`
- `ci/supply-chain-security-hardening`
- `chore/configure-dependabot-actions`
- `chore/workflow-and-architecture-audit`

## Duplicate-generation retirement candidates

These branch names currently point at the same commit and do not each represent independent development:

- `feat/core-policy-boundary-final`
- `feat/core-policy-boundary-v2`
- `feat/core-policy-boundary-v3`
- `feat/core-policy-boundary-v4`

These also currently point at the same commit:

- `docs/language-policy`
- `docs/language-policy-2`
- `docs/language-policy-3`

## Requires content review before retirement

These branches are not to be merged blindly. Their remaining commits must be compared with `main` and either transferred through a reviewed PR or retired:

- `chore/harden-execution-kernel-boundary`
- `chore/database-migration-parity-inventory`
- `feat/core-authorization-adapter-e2e`
- `feat/core-authorization-adapter-e2e-v2`
- `feat/core-policy-boundary`
- `feat/durable-execution-outcome-audit`
- `feat/execution-boundary-reservation`
- `feat/execution-kernel-convergence`
- `feat/execution-lease-reconciliation`
- `feat/language-policy`
- `feat/mandatory-durable-outcome-boundary`
- `feat/operation-queue-executable-core`
- `feat/postgres-execution-reservation-adapter`
- `docs/language-independent-architecture`
- `docs/programming-language-architecture`
- `fix/authorization-context-for-rls`
- `fix/operation-store-mutation-boundary`
- `test/auth-integration-contract`
- `test/operations-concurrency-gate`

**Important:** this list is a workflow register, not permission to delete without the corresponding remote-delete operation and final content verification.

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

## Current blocker

The connected GitHub interface currently exposes branch listing, creation, ref updates, and PR operations, but not remote branch deletion. Until a genuine delete operation is available, branches must not be force-moved or otherwise mutated merely to simulate deletion.

Once deletion is available, execute the register as a retirement sweep and re-audit the remote inventory until the repository contains exactly nine genuine active branches.
