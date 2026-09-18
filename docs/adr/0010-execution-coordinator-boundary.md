# ADR 0010 — Execution Coordinator Boundary

**Status:** Proposed
**Date:** 2026-09-18

## Context

ZENITH now has separate contracts for authorization, explicit organisation context, capability leases, operations, and resilient/offline execution. Without a single runtime composition point, adapters could accidentally create alternate authorization or retry semantics.

## Decision

Introduce one provider-neutral Execution Coordinator as the runtime composition boundary.

The coordinator must perform operation validation, lease validation, current authorization, idempotency resolution, handler execution, audit/provenance recording, deterministic state transition, and capability release.

Authorization and lease validation remain separate checks. Possession of a valid lease is not sufficient authority when current policy denies the action.

Offline or delayed operations must be reauthorized at the receiving execution boundary.

## Consequences

Positive consequences:

- one execution security boundary;
- consistent retry and idempotency behavior;
- transport and provider independence;
- easier auditability and testing;
- no per-adapter authorization authority.

Costs:

- runtime implementations must depend on coordinator contracts;
- an idempotency store and audit sink are required;
- domain-specific conflict resolution remains outside the coordinator.

## Rejected alternatives

Per-adapter authorization was rejected because it duplicates policy semantics and creates bypass risk.

A queue-owned authorization layer was rejected because queued work may cross transports and execution environments and must be rechecked at execution time.

A monolithic coordinator containing domain logic was rejected because the coordinator should compose policies and lifecycle controls, not become the domain engine.