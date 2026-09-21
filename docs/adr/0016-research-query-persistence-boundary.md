# ADR 0016 — Research Query Persistence Boundary

## Status

Accepted for implementation.

## Finding

The existing research schema already provides durable domain objects for questions, projects, datasets, methods, runs, and outputs in migration 0008. It does not provide a durable record for the canonical provider query contract used by Research Intelligence.

The existing operations store is intentionally minimal and must not become a protected research-payload store.

## Decision

Add one narrow domain table for submitted Research Intelligence queries: `core.research_query_requests`.

It stores the minimum durable query envelope needed to execute and reproduce a provider query. `operations.operations.payload_ref` references its UUID.

The table is tenant-scoped and identity-scoped. Direct authenticated access is limited by RLS. The operation layer remains responsible for lifecycle, reservation, and durable outcome.

## Boundary

ResearchQuery → core.research_query_requests → operations.operations.payload_ref → canonical reservation → provider adapter → durable outcome

The request table is not an operation ledger and does not replace the Research Provider Contract.

## Security

- organisation and identity are mandatory;
- RLS is forced;
- reads require matching current organisation and identity;
- inserts require matching current organisation and identity;
- a referenced research question must belong to the same organisation when supplied;
- protected provider retrieval remains subject to canonical authorization;
- provider results are not stored in the request table;
- secrets, provider credentials, and protected full text are excluded.

## Idempotency

The canonical operation remains the authoritative idempotency boundary. The request UUID is a payload reference, not a second idempotency mechanism.

## Integrity

Fresh-database tests must prove tenant isolation, identity isolation, question scope, authenticated write access, and unauthenticated denial.

The implementation must remain compatible with the existing 180-line source-file rule and must not introduce a competing security or lifecycle engine.
