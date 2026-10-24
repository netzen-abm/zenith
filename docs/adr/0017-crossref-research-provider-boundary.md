# ADR 0017 — Crossref Read-Only Research Provider

## Status
Accepted for a bounded read-only provider adapter and the metadata-only durable result-set boundary. Production exposure still requires the full real-PostgreSQL recovery E2E and downstream surface authorization review.

## Context
ZENITH has a provider-neutral ResearchProvider contract but no concrete scholarly metadata provider. The first provider should require no paid API account, add no SDK dependency, and remain replaceable. Crossref offers a public REST API and its polite pool uses a `mailto` contact parameter.

## Decision
Implement `CrossrefResearchProvider` under `packages/adapters/src/research` as read-only metadata discovery using native `fetch`. The adapter uses a bounded in-memory cache, serializes request starts, applies a conservative 350 ms request interval by default, and enforces a timeout. It requests DOI, title, type, dates, license metadata, and source URL; it does not request abstracts or full text.

## Error and rights contract
- Network failures, HTTP 408/425/429, and 5xx are typed retryable provider errors.
- HTTP 429 preserves parsed `Retry-After` seconds in the provider error. Automatic HTTP retries are not performed.
- Invalid response shape, unsupported intent, and unverifiable `openAccessRequired` are non-retryable; ResearchOperation maps those to `rejected`.
- Retryable typed provider errors map to the existing `retry_wait` outcome; unknown transport exceptions retain the existing retry-wait behavior.
- Unsupported provider filters are explicit warnings and mark the result partial.
- Provider-supplied license URLs are provenance, not definitive proof that an item satisfies an open-access request.
- Tenant and identity identifiers are never sent to Crossref. Secrets, abstracts, and full-text content are not fetched or persisted by this adapter.

## Boundary
`ResearchProvider contract → Crossref adapter → normalized ResearchResult`. The existing Core authorization, operation identity, reservation, durable outcome, and outbox boundaries are unchanged.

## Result persistence and recovery boundary

Research results are persisted by `PostgresResearchResultStore` into immutable `core.research_query_result_sets` snapshots, using the security-definer `core_private.persist_research_query_result_set` write boundary. The function verifies tenant/identity, operation payload hash, in-flight reservation, provider/query identity, payload-size bound, and an allowlist that excludes abstracts/full text. Reads are tenant-and-identity scoped.

The existing `ResearchOperation` uses the shared execution kernel; if the provider succeeds and the outcome write fails, the next request can recover only from a matching durable snapshot. It does not call the provider again. If no valid snapshot exists, the operation remains fail-closed. The real PostgreSQL E2E is the acceptance evidence for these semantics; unit tests alone are not sufficient.

## Verification
CI uses mocked HTTP responses; there is no provider key or live network call. Tests cover DOI/date/license mapping, cursor values, query caching, tenant identifier non-disclosure, rights/filter fail-closed behavior, typed 429 errors, and provider outcome mapping.
