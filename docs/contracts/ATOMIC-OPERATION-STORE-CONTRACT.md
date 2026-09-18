# Atomic Operation Store Contract

## Purpose

The operation runtime requires an atomic boundary for idempotency reservation and lifecycle state. A read-then-write sequence is insufficient under concurrent delivery.

## Contract

The store exposes one atomic reservation operation:

`reserve(scope, idempotencyKey, operationId) → reserved | duplicate`

Reservation and duplicate detection MUST be linearizable within the declared scope.

The first successful reservation owns execution for that idempotency key. A duplicate delivery MUST NOT invoke the domain handler.

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
- The store does not make authorization decisions.
- Authorization remains in the canonical policy boundary.
- Sensitive payloads are referenced rather than duplicated where possible.

## Failure semantics

Storage unavailability is not an authorization allow.

If reservation outcome is unknown, execution MUST NOT proceed unless the implementation can establish a safe idempotent condition.

An atomic reservation may remain durable after a process crash; recovery must inspect persisted operation state rather than blindly replaying the handler.

## Adapter boundary

`Execution Coordinator → Operation Store`

The store is replaceable. PostgreSQL, an embedded local store, or another durable implementation may satisfy this contract if it preserves the invariants.

## Deliberate non-goals

- no broker selection;
- no distributed consensus design;
- no exactly-once claim for arbitrary external side effects;
- no domain-specific conflict merge;
- no authorization implementation.

Exactly-once domain effects require cooperation from the side-effect boundary. The operation store alone cannot guarantee exactly-once behavior against an external system.