# Execution Kernel Contract v1

## Status
Accepted — shared infrastructure boundary for protected execution.

## Canonical execution path
Core authorization → Execution Coordinator → persistent reservation → exactly-one handler entry → durable outcome → operation state + outbox.

## Authorities
- **Core authorization** is the canonical policy authority.
- **Execution Coordinator** is the application execution boundary; it orchestrates and does not implement policy.
- **ExecutionReservation** is the concurrency/lifecycle claim boundary. Production uses `operations.reserve_execution(uuid)`.
- **ExecutionHandler** is entered only after a successful reservation.
- **ExecutionOutcomeRecorder** is the durability boundary. Production uses `operations.record_execution_outcome(...)`.
- **Execution outbox** is a downstream delivery mechanism, not an authorization authority.

## Mandatory invariants
1. Authorization failure prevents reservation and handler entry.
2. Reservation failure prevents handler entry.
3. At most one concurrent contender may successfully reserve the same operation attempt.
4. The authoritative execution attempt is the attempt returned by the reservation boundary; application code must not fabricate it.
5. Every reserved handler execution must produce a durable outcome or fail explicitly as non-durable.
6. Outcome, lifecycle transition, and outbox creation are one database transaction.
7. Direct authenticated mutation of lifecycle, outcome, and outbox state is prohibited.
8. Protected payloads must not be copied into execution audit/outbox records merely for convenience.
9. Tenant/organisation context is evaluated at the database boundary.
10. New surfaces and domain modules must consume these contracts rather than recreate execution policy or lifecycle mutation.

## Prohibited bypasses
Do not add application paths that directly mutate `operations.operations` lifecycle state, `operations.execution_outcomes`, or `operations.execution_outbox`. Do not introduce a second authorization authority for protected execution. Do not invoke a domain handler before reservation succeeds.

## Verification gates
The repository CI must keep the PostgreSQL-backed coordinator E2E, reservation concurrency assertions, durable outcome concurrency assertions, operation-queue invariant tests, SQL security checks, and CodeQL enabled.

## Evolution rule
Changes to these authorities or invariants require an ADR and corresponding positive and negative tests before adoption.

See also: `docs/adr/0007-execution-coordinator-reservation-boundary.md` and `docs/adr/0013-durable-execution-outcome-and-audit-boundary.md`.