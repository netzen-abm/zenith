# ADR 0017 — Crossref Read-Only Research Provider

## Status
Accepted for a bounded first provider adapter. Durable result persistence is not accepted by this ADR.

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

## Known limitation
The current ResearchOperation records a provider query reference as the operation result reference but does not persist returned `ResearchResult.results` in a durable result/output store. This ADR accepts the adapter and its deterministic contract tests, **not a claim that user-facing Crossref results are durably integrated end-to-end**. A separate result-persistence design must establish trusted server-side writes, tenant/identity reads, provenance, rights metadata, and replay semantics before a production surface exposes these results.

## Verification
CI uses mocked HTTP responses; there is no provider key or live network call. Tests cover DOI/date/license mapping, cursor values, query caching, tenant identifier non-disclosure, rights/filter fail-closed behavior, typed 429 errors, and provider outcome mapping.
