# ZENITH Remote Branch Retirement Register

**Status:** Operational register  
**Canonical base:** `main`  
**Branch budget:** 9 total active development branches, including `main`

**Source-code decomposition:** file/class size is a review signal only. Split only when the split creates an independent boundary of change, trust, persistence, provider dependency, or independent reuse. Preserve cohesion when splitting would weaken invariants or duplicate orchestration.

## Purpose

This register separates **Git history preservation** from **remote branch retention**.

A merged commit remains permanently recoverable through Git history, pull requests, and commit SHAs. A remote branch therefore remains only when it represents a genuinely active workstream.

## Retirement rules

1. Never merge obsolete generations solely to eliminate a branch.
2. Never force-move a branch to `main` as a substitute for deletion.
3. Never create placeholder branches to satisfy the nine-branch budget.
4. A merged branch is a retirement candidate.
5. Duplicate branches pointing at the same commit are retirement candidates unless one has an explicit active purpose.
6. An unmerged branch requires a content review before retirement.
7. Any unique, still-required work must be transferred through a reviewed PR before the source branch is retired.
8. The remote branch inventory is authoritative for the count.

## Canonical active branches

The currently verified remote inventory contains exactly nine branches:

1. `main`
2. `feat/ai-agent-infrastructure`
3. `feat/api-sdk-contracts`
4. `feat/field-acquisition`
5. `feat/knowledge-graph-next`
6. `feat/multisurface-adapters`
7. `feat/research-intelligence-next`
8. `feat/security-release-engineering`
9. `feat/space-time-next`

No non-canonical remote branches are currently present.

## Active-workstream rule

The nine branches above are retained because they represent the current architectural workstreams. Their histories are not assumed mergeable merely because they are active.

Before merging any workstream branch:

- compare it with current `main`;
- identify changes unique to the branch;
- verify whether those changes are still required;
- transfer only the required changes through a reviewed PR;
- run the relevant security, architecture, database, concurrency and integration gates;
- merge only after the result is compatible with current `main`;
- delete the source branch after successful merge and verification.

A branch that is substantially behind `main` must not be force-moved or merged merely to consume/release a branch slot.

## Current architectural workstreams

- `feat/ai-agent-infrastructure` — AI/agent boundary and infrastructure.
- `feat/api-sdk-contracts` — versioned API/SDK capability boundary.
- `feat/field-acquisition` — field evidence acquisition.
- `feat/knowledge-graph-next` — knowledge graph capability.
- `feat/multisurface-adapters` — independent surface/transport adapters.
- `feat/research-intelligence-next` — provider-neutral research capability.
- `feat/security-release-engineering` — security, migration and release verification.
- `feat/space-time-next` — spatial/temporal capability.

## Branch hygiene and source-code architecture are coupled by policy, not implementation

Repository hygiene does not justify architectural shortcuts.

The source-code rule remains:

> Split responsibility only where the split strengthens an independent architectural boundary.

Valid boundaries are:

- change;
- trust;
- persistence;
- provider/device dependency;
- independent reuse.

Do not split tightly coupled execution responsibilities merely because a file or class grows. In particular, the protected execution sequence remains cohesive:

`Authorization → Reservation → Handler → Durable Outcome → Lifecycle/Outbox`

The execution coordinator is therefore treated as frozen infrastructure unless a concrete missing invariant or boundary is demonstrated.

## Ecosystem architecture rule

All active capabilities consume the shared chain:

`Identity → Authorization → Tenant/RLS → Capability Contract → Operation → Reservation → Handler → Durable Outcome → Outbox → Provenance`

A domain capability may add domain behavior, but it may not create a competing authorization, tenant-isolation, lifecycle, reservation, idempotency, audit, or protected-mutation mechanism.

## Operational enforcement

CI verifies the exact nine-branch budget on pushes to `main`. The CI gate is an audit, not a deletion mechanism.

Remote inventory must be re-read after every branch retirement or creation action. No branch may be retired by force-moving its ref to another commit.

## Current verified state — 2026-10-07

The live GitHub remote was re-read on 2026-10-07 and contains exactly **9 branches**, matching the canonical set above.

This closes the previously documented branch-count gap. The historical retirement analysis remains preserved in Git history, but obsolete branch names are no longer represented as active remote development lines.

The repository is therefore currently compliant with the nine-branch budget.

## Next convergence rule

The next repository-level objective is not to create more branches. It is to reconcile the existing active workstreams safely with current `main`:

1. verify current CI after the execution-coordinator syntax correction;
2. transfer only genuinely unique, still-required work from stale/diverged branches;
3. merge only reviewed, validated work;
4. delete a completed source branch immediately after successful merge;
5. never exceed nine active branches.

The objective is **one trustworthy mainline plus a fixed budget of genuine workstreams**, not nine branches for their own sake.
