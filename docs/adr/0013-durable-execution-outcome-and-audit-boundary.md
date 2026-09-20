# ADR 0013: Durable Execution Outcome and Audit/Outbox Boundary

- Status: Proposed
- Date: 2026-09-19

## Decision

ZENITH records the result of every reserved execution attempt through a canonical database boundary rather than treating an in-memory handler result as durable truth.

The boundary is:

`ExecutionCoordinator → Handler → operations.record_execution_outcome() → operation state + outcome + outbox event`

The function records the outcome, advances the operation from `in_flight` to a lifecycle-valid post-execution state, and creates an outbox event in the same transaction.

## Allowed outcomes

The first implementation permits:

- `acknowledged`
- `retry_wait`
- `conflict`
- `rejected`

`completed` remains a separate lifecycle transition from `acknowledged`, preserving the canonical state graph.

## Security invariants

- Direct authenticated INSERT/UPDATE access to outcome and outbox tables is denied.
- The recording function is the narrow mutation boundary.
- The function is SECURITY DEFINER only because authenticated clients cannot directly mutate these tables.
- Tenant, operation state, and attempt-count checks remain explicit inside the function.
- An outcome is bound to exactly one operation and execution attempt.
- Duplicate outcome recording is rejected.
- The outbox event is created atomically with the outcome and lifecycle update.
- Result payloads are referenced by `result_ref`; protected payloads are not copied into the operation/outbox tables.

## Audit model

The outcome table is the durable execution record. The outbox table is the delivery mechanism for downstream audit/provenance/indexing consumers.

The outbox is not itself the authorization authority and does not replace the canonical operation record.

## Completion model

A successful handler acknowledgement does not automatically imply durable domain completion. `acknowledged → completed` remains an explicit lifecycle step so domain/application reconciliation can distinguish transport/handler acknowledgement from durable domain completion.

## Failure and retry

Retryable handler failures record `retry_wait`; permanent failures record `rejected`; domain/integrity conflicts record `conflict`.

No failure may silently become an authorization allow.

## Non-goals

This ADR does not yet define:

- an external message broker;
- distributed event delivery guarantees beyond the database outbox;
- domain-specific result schemas;
- a full immutable cryptographic audit ledger;
- lease acquisition/release runtime.

Those are subsequent boundaries and must not be folded into the outcome function without a separate architectural decision.
