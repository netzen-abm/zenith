# ZENITH Engineering Cycle: Evidence-First Convergence

**Status:** Proposed execution control document  
**Baseline inspected:** `main` at `18a6fccac4969f2a17da36676e7966649f868cb9`  
**Date:** 2026-10-12

## Decision

The next cycle is for proving the current architecture under integration—not adding layers or producing more architecture documents. Preserve the modular-monolith baseline and the shared execution chain:

`Identity → Authorization → Tenant/RLS → Capability Contract → Operation → Reservation → Handler → Durable Outcome → Outbox → Provenance`

Keep orchestration cohesive where correctness depends on atomic ordering. Place provider/database implementations behind repository or adapter boundaries. File length is a signal, not a decomposition objective.

## Verified repository state

- Default branch: `main`.
- Remote branch count: exactly nine, matching the canonical branch list.
- Current `main` workflow runs inspected on 2026-10-12: CI, CodeQL, Scorecard and branch-hygiene runs report success.
- The branch inventory and current mainline are not the same as proof that every feature is integrated: most feature branches are 159 commits behind `main`.

## Nine-branch rule

Keep exactly these remote branch names; `main` counts toward the total:

1. `main`
2. `feat/ai-agent-infrastructure`
3. `feat/api-sdk-contracts`
4. `feat/field-acquisition`
5. `feat/knowledge-graph-next`
6. `feat/multisurface-adapters`
7. `feat/research-intelligence-next`
8. `feat/security-release-engineering`
9. `feat/space-time-next`

Do not create temporary remote branches. Use pull requests from the existing canonical workstreams or transfer a coherent, reviewed change to an existing canonical branch. Never force-move branches to make them appear synchronized. Retire a canonical workstream only after its required changes are integrated and the register/CI policy is updated in the same reviewed change.

## Immediate engineering risks observed

### 1. Spatial operation violates the canonical orchestration rule

`packages/capabilities/src/space-time-operation.ts` performs authorization once directly and then again through `ExecutionCoordinator`. It persists the request before the coordinator's reservation step. This makes authorization orchestration non-canonical and creates the risk of a durable request without a successful reservation. Refactor to a single coordinator admission path; make request persistence/preparation occur at the contractually correct point and ensure request + operation lifecycle creation is transactionally consistent.

### 2. Field and knowledge-graph consumers need retry/idempotency review

The current source shows capability operations generating random operation IDs independently of caller idempotency keys (including the field operation). The database uniqueness constraint is per organisation and idempotency key, but the application operation identity and request identity need to be derived/reused consistently on retries. Add same-key/same-payload replay and same-key/different-payload conflict tests.

### 3. Mutation request persistence has an atomicity boundary to verify

Knowledge-graph request creation currently persists its request in a repository transaction, while the shared coordinator reserves and records execution separately. Review the complete path for orphaned pending requests, failed reservation, duplicate handler execution, and retry behavior. Do not introduce a second lifecycle system to fix it.

### 4. Migration history contains competing version numbers

The mainline migration inventory includes two distinct `0017_*` files and two distinct `0018_*` files, while feature branches introduce `0019` and `0020`. The fresh database script sorts filenames lexically. This deserves an explicit compatibility test and a versioned migration ledger/runner decision; do not silently rename already-applied migrations or assume filename ordering alone is a safe production migration protocol.

### 5. Branch CI is not equal to integration proof

The current mainline CI passes. Feature workstreams diverge; branch comparisons show:
- Knowledge graph: 17 unique commits, 159 behind.
- Space/time: 15 unique commits, 159 behind.
- AI/API/multisurface/research workstream branches: 2 commits each, 159 behind, primarily workstream documentation.
- Field acquisition branch: 66 behind with no unique commits reported.
- Security/release branch: identical to main at inspected baseline.

Do not merge these branches wholesale. Port only unique, still-required changes through a reviewed PR on the existing branch topology.

## Engineering cycle and acceptance gates

### Gate A — Reproduce mainline
- Record exact main SHA and successful workflow run URLs.
- Run a fresh Postgres/PostGIS reconciliation and existing queue/capability tests from a clean checkout.
- Preserve failing logs and DB snapshots as CI artifacts; never call a design-only or mock-only test a runtime proof.

### Gate B — Fix shared execution invariants
- One authorization boundary; no capability-owned duplicate authorization.
- No handler entry without a successful reservation.
- Durable outcomes are required; failure to record an outcome is surfaced and reconciled without silent success.
- Concurrent same-key requests execute at most once.
- Same idempotency key with materially different payload is rejected.
- Request persistence, operation reservation and lifecycle changes have explicitly tested failure semantics.

### Gate C — Verify domain verticals against the same kernel
- Evidence annotation.
- Knowledge-graph relationship mutation.
- Space-time representation mutation.
- Field observation mutation.
For each, run allow and deny paths, cross-tenant tests, duplicate/replay, invalid state, provider failure and outcome-recording failure cases against PostgreSQL/PostGIS—not only in-memory doubles.

### Gate D — Security/operations
- Authenticated RLS isolation across two organisations.
- Sensitive geometry remains generalized for public callers.
- Protected payloads do not leak into logs/audit/outbox.
- Fresh database applies every migration deterministically.
- Backup/restore is tested where target-environment access allows it; otherwise keep the gate blocked.
- Record remaining PostGIS advisor finding and do not perform a destructive extension move merely to green a dashboard.

### Gate E — Shareable infrastructure contract
- Verify typed contracts and versioned API are consuming the same authorization/execution kernel.
- Verify provider adapters cannot import or bypass Core policy/lifecycle.
- Verify a surface can fail independently without corrupting Core state.
- Publish developer setup and one end-to-end Pattanam/Muziris example only after Gates A–D pass.

## Architecture decomposition rules

**Split when** the change, trust, persistence, provider/device dependency or independent reuse boundary is real.

**Keep together when** the code participates in one transaction, invariant, security decision or ordered execution protocol. The execution coordinator should remain cohesive; improve tests and names before creating more orchestration classes.

Suggested immediate ownership:
- Core security and execution kernel: protected shared infrastructure.
- Capability domain validation/contracts: provider-neutral.
- Persistence repositories: database adapter boundary.
- Provider/device integration: adapters.
- Surface UI/transport: independent clients of shared APIs.
- Evidence/provenance: shared canonical semantics, not per-surface duplication.

## Stop conditions

Stop feature expansion and return to integration work if any of the following appears:
- authorization is executed outside the canonical coordinator;
- a handler can run without reservation;
- a request can persist without an explicit recoverable operation state;
- duplicate retries can create duplicate domain records;
- migration order depends on lexical accidents;
- any capability creates independent tenant, audit, lifecycle, or policy logic.

## Completion definition

This engineering cycle is complete only when the above runtime gates have actual passing evidence or are explicitly marked blocked with an identified environmental prerequisite. A passing mainline CI run alone is not the completion criterion.
