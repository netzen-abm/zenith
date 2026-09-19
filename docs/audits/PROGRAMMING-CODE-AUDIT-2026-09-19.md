# ZENITH Programming / Code Audit — 2026-09-19

## Scope

This audit covers the executable repository surfaces currently present in main and the active operation/execution work:
- TypeScript contracts and operation-queue runtime
- Python reference gate harness
- PostgreSQL/PostGIS migrations and database assertions
- shell-based fresh-database and concurrency gates
- GitHub Actions CI
- execution/reservation boundary and related tests

The audit used repository code search plus direct inspection of executable files and current CI evidence. It is a code/security architecture audit, not a claim that every future application surface has already been implemented.

## Verified strengths

1. **Canonical authorization remains in Core.**
   'core.authorize_capability(...)' is SECURITY INVOKER, uses an empty search_path, denies unknown actions, and is not executable by public.

2. **Protected helper execution is bounded.**
   The narrow SECURITY DEFINER identity/resource helpers use an empty search_path; public execution is revoked and authenticated execution is explicitly granted.

3. **Tenant context is explicit.**
   'core.current_organisation_id()' requires an active identity-to-organisation membership and an explicitly selected organisation context.

4. **Persistent reservation is correctly separated from authorization.**
   'operations.reserve_execution(uuid)' re-evaluates canonical Core policy and performs the atomic queued-to-in_flight claim under a row lock.

5. **Concurrency evidence exists.**
   The reservation concurrency gate proves one allow and one denial under contention, with final in_flight and attempt count one.

6. **Minimal operation persistence is preserved.**
   Operation rows carry references/hashes/classification/provenance references rather than protected payload bodies.

7. **CI has multiple independent security/integrity gates.**
   Repository integrity, source-size governance, SQL static checks, fresh DB reconciliation, operation-queue tests, and concurrency checks are separately represented.

## Findings

### F-01 — Direct lifecycle mutation boundary was too broad — HIGH — addressed by PR #43

'operations.operations' previously granted UPDATE directly to authenticated. RLS constrained tenant membership but did not constrain which lifecycle columns could be changed.

That meant an authenticated caller could potentially mutate state, attempt_count, expires_at, lease_ref, or other lifecycle metadata without going through the canonical CAS/reservation functions.

PR #43 removes direct authenticated UPDATE and constrains authenticated creation to state='created', attempt_count=0, and a future expiry. Lifecycle progression remains through 'operations.transition(...)' and 'operations.reserve_execution(...)'.

**Status:** remediation implemented; CI verification pending.

### F-02 — Two execution orchestration implementations exist — HIGH — open

There are two materially different execution coordinators:
- 'packages/contracts/src/execution-coordinator.ts' exposes 'executeOperation(...)' and performs lease validation, authorization, duplicate detection, handler execution, audit, and release.
- 'packages/operation-queue/src/execution-coordinator.ts' exposes 'ExecutionCoordinator' and performs authorization preflight, persistent reservation, and handler entry.

The second is the intended current runtime boundary, but the first still contains executable orchestration logic. This creates architectural drift and makes it possible for future code to accidentally bypass the persistent reservation boundary.

**Required action:** reconcile the contract module into a pure contract/interface layer or explicitly deprecate/remove its executable orchestration. There must be one production execution coordinator.

### F-03 — Lifecycle state machine is duplicated — MEDIUM/HIGH — open

'packages/contracts/src/operation-state.ts' and 'packages/operation-queue/src/lifecycle.ts' each define their own transition graph. They are similar but not identical.

Examples:
- the queue lifecycle requires leaseValid before queued → in_flight;
- the contract coordinator separately validates leases;
- the two transition graphs differ in some allowed transitions such as expiry handling.

This is a future drift risk.

**Required action:** establish one canonical lifecycle contract and make the runtime queue consume it rather than maintaining a second transition table.

### F-04 — Current Coordinator E2E harness has exposed useful defects — MEDIUM — active

The E2E gate found:
- incorrect import paths;
- missing explicit identity context;
- a mutating diagnostic probe that consumed the reservation fixture.

Those test defects have been corrected progressively. The latest clean harness commit removes the mutating probe.

The production SQL reservation path itself has been directly verified in CI as:
queued/0 → allow → in_flight/1.

**Status:** final clean concurrent Coordinator E2E remains unproven until CI passes.

### F-05 — Lease runtime remains incomplete — HIGH — open

Lease validation exists as a contract-level function, but the current production ExecutionCoordinator does not consume an ExecutionLease. The PostgreSQL reservation path is the final persistent gate, while the broader lease lifecycle (issuance, revocation, expiry persistence, release, synchronization/reconciliation) remains incomplete.

**Required action:** implement lease runtime only after the Coordinator/reservation E2E is green, without introducing a second authorization authority.

### F-06 — Durable execution outcome/audit boundary remains incomplete — HIGH — open

The current new Coordinator calls the handler and returns executed=true, but there is no durable outcome/outbox transaction surrounding domain side effects.

A crash after the handler performs an external side effect but before durable acknowledgement can leave an ambiguous operation state.

**Required action:** define durable outcome/idempotency/audit semantics before adding external provider adapters.

### F-07 — Reference Python policy harness is correctly non-production but must remain isolated — LOW

'tests/reference_gate_harness/core.py' implements a simplified policy model. Its docstring explicitly identifies it as reference-only and not production authorization.

It must not be imported by production runtime code or allowed to become a shadow authorization implementation.

**Status:** currently isolated under tests.

## Verification gaps

- Authenticated production-like runtime tests beyond the fresh PostgreSQL harness.
- Durable audit/outbox and crash recovery.
- Persistent lease lifecycle.
- External side-effect idempotency.
- Federation/offline replay authorization.
- Load testing and fault injection.
- Full application-surface integration, because most application directories remain scaffold-level.

## Recommended execution order

1. Merge PR #43 only after its complete CI is green.
2. Finish PR #42 with a clean Coordinator → PostgreSQL reservation → concurrent handler E2E.
3. Reconcile/remove the duplicate executable coordinator in packages/contracts.
4. Canonicalize lifecycle transitions so only one state machine exists.
5. Implement durable execution outcome/audit and recovery semantics.
6. Implement persistent lease lifecycle.
7. Add external provider/transport adapters only after these boundaries are durable.

## Audit conclusion

The current ZENITH security architecture is materially stronger than the application surface around it. The Core authorization and PostgreSQL reservation boundaries are explicit and testable. The highest remaining risks are now architectural duplication and runtime durability, not another missing authorization helper.

Do not add another authorization engine. Do not move authorization into adapters. Do not bypass the reservation boundary to make an execution test pass.
