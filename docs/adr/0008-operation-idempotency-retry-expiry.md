# ADR 0008: Operation Idempotency, Retry and Expiry

- Status: Proposed
- Date: 2026-09-18

## Decision

Operation execution uses explicit idempotency scope, classified failures, bounded exponential retry, and expiry-aware scheduling.

## Rules

1. Idempotency keys are interpreted within an explicit scope; organisation scope is preferred for tenant-owned work.
2. A retry is permitted only for an explicitly retryable failure.
3. Authorization, permission, integrity, and other non-retryable failures do not retry automatically.
4. Conflicts are surfaced as conflicts and require reconciliation rather than blind replay.
5. Retry delay grows exponentially from a bounded base and is capped.
6. A retry whose scheduled execution would reach or pass operation expiry is rejected as expired.
7. Maximum attempts are enforced before scheduling another retry.
8. Retry never renews or extends a capability lease.
9. Execution must reauthorize independently of the original enqueue decision.
10. Idempotency must be enforced by the eventual execution/persistence boundary; this package defines semantics, not storage.

## Deliberate non-goals

This ADR does not choose a database, broker, distributed lock, scheduler, or transport. It also does not define domain-specific conflict resolution.
