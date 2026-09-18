# ADR 0007: Operation Runtime Boundary

- Status: Proposed
- Date: 2026-09-18

## Decision

The first executable Operation/Queue primitive is a provider-neutral TypeScript contract and deterministic state machine.

It does not select a queue broker, database queue, transport, or synchronization protocol.

## Boundary

`Intent → Authorization/Lease → Operation Envelope → State Machine → Queue Adapter → Execution → Reauthorization → Reconcile → Release`

The operation layer owns lifecycle semantics. Delivery infrastructure owns transport mechanics.

## Invariants

1. Operation identity is immutable.
2. Idempotency keys prevent duplicate execution within their declared scope.
3. Expired operations and leases cannot be resurrected by retry.
4. Execution re-checks authorization at the execution boundary.
5. Integrity failures fail closed.
6. Retry applies only to explicitly retryable failures.
7. Conflicts are explicit; domain records do not silently use last-write-wins.
8. Provenance and epistemic metadata remain attached to deferred work.
9. Terminal operations cannot transition back into executable states.
10. Transport adapters cannot redefine Core operation semantics.

## Deliberate non-goals

- No Redis, Kafka, RabbitMQ, Supabase queue, or vendor broker dependency.
- No background polling requirement.
- No universal binary payload format.
- No database migration until runtime behavior and persistence requirements are demonstrated.

## Next implementation boundary

Add deterministic idempotency and retry-policy functions with unit tests. Only after those contracts are stable should a persistence adapter be introduced.
