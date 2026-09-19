# ADR 0007 — Execution Coordinator Reservation Boundary

## Status
Accepted

## Decision
The Execution Coordinator is the application-level execution boundary. It may perform a current authorization preflight, but it must not implement authorization policy itself.

Immediately before domain-handler entry, the coordinator calls an injected ExecutionReservation. The production implementation is the persistent PostgreSQL operations.reserve_execution(uuid) boundary.

A reservation denial is terminal for that execution attempt: the domain handler MUST NOT be called.

## Invariants

1. Authorization remains canonical in Core.
2. Reservation is concurrency control, not a second authorization authority.
3. Handler entry occurs only after a successful reservation.
4. Concurrent workers may contend for the same operation, but only one successful reservation may enter the handler.
5. The coordinator does not store protected payloads or create an alternate security boundary.

## Verification

packages/operation-queue/src/execution-coordinator.test.ts proves the coordinator handler-entry invariant with concurrent execution attempts and an explicit reservation-denial regression.
core/database/migrations/0014_execution_reservation.sql provides the persistent production reservation boundary.
tests/database/execution-reservation-concurrency.sh proves the PostgreSQL reservation is atomic under concurrent workers.
packages/operation-queue/src/lifecycle.test.ts covers lifecycle transition invariants.
