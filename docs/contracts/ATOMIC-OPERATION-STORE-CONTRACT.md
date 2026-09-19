# Atomic Operation Store Contract

## Purpose

The operation runtime requires an atomic boundary for idempotency reservation and lifecycle state. A read-then-write sequence is insufficient under concurrent delivery.

## Contract

The execution boundary exposes one atomic persistent reservation operation:

`reserve(operationId) → allowed | denied`

Reservation and duplicate/concurrency detection MUST be linearizable within the operation's tenant scope.

The first successful reservation moves the operation from `queued` to `in_flight` and owns execution for that attempt. A denied reservation MUST NOT invoke the domain handler.

The production PostgreSQL implementation is:

`operations.reserve_execution(uuid)`

It locks the tenant-scoped operation row, checks lifecycle/readiness/expiry, re-evaluates the canonical Core capability policy, and atomically claims the queued operation.

## Authorization relationship

The operation store does not define authorization policy and is not an authorization authority.

The persistent reservation MAY invoke the canonical Core authorization function as a final execution-time policy check. This is a policy re-check at the existing canonical boundary, not a second policy implementation.

Authorization remains owned by Core.

## Lifecycle persistence

The store must persist at minimum:

- operation identity;
- idempotency scope and key;
- current lifecycle state;
- attempt count;
- creation and expiry timestamps;
- capability lease reference;
- payload/content hash reference;
- provenance and epistemic metadata references;
- last execution outcome;
- reconciliation/conflict status.

State changes must use compare-and-set or an equivalent atomic transition primitive.

## Safety invariants

- No duplicate reservation may execute side effects.
- A terminal state cannot be resurrected.
- Expiry is checked against authoritative time at execution.
- A retry does not renew a lease.
- State transition and reservation semantics cannot silently disagree.
- The store does not define or replace authorization policy.
- Authorization remains in the canonical Core policy boundary.
- Sensitive payloads are referenced rather than duplicated where possible.
- Storage or reservation uncertainty is never treated as authorization allow.

## Failure semantics

Storage unavailability is not an authorization allow.

If reservation outcome is unknown, execution MUST NOT proceed unless the implementation can establish a safe idempotent condition.

An atomic reservation may remain durable after a process crash; recovery must inspect persisted operation state rather than blindly replaying the handler.

## Adapter boundary

`Execution Coordinator → ExecutionReservation / Operation Store → PostgreSQL`

The store is replaceable. PostgreSQL, an embedded local store, or another durable implementation may satisfy this contract if it preserves the invariants.

The coordinator must not depend on PostgreSQL-specific details. PostgreSQL-specific behavior belongs in the persistence adapter.

## Deliberate non-goals

- no broker selection;
- no distributed consensus design;
- no exactly-once claim for arbitrary external side effects;
- no domain-specific conflict merge;
- no authorization policy implementation.

Exactly-once domain effects require cooperation from the side-effect boundary. The operation store alone cannot guarantee exactly-once behavior against an external system.
