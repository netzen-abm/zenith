# ZENITH Research Intelligence Capability Contract

## Purpose

This contract defines the application-facing boundary for provider-neutral research execution.

## Canonical flow

`Research Query → Authorization → Operation → Reservation → Provider Adapter → Result → Durable Outcome → Provenance`

The provider adapter never becomes the authority for identity, authorization, tenancy, lifecycle, or epistemic status.

## Query

A canonical query contains:

- `queryId`
- research-question reference
- requester identity
- organisation
- purpose
- query intent/text
- filters and requested fields
- pagination cursor
- open-access constraint where applicable

The query is immutable for an execution attempt.

## Result

A result contains:

- query identity
- provider identity and adapter version
- provider query reference
- retrieval timestamp
- normalized works
- provider identifiers
- pagination state
- partial-result flag
- warnings
- rights/access metadata where supplied

Missing values remain unknown.

## Security boundary

Public discovery metadata may have a different policy path from protected retrieval, retention, export, annotation, or AI processing.

All protected operations use the canonical authorization boundary and database tenant/resource isolation.

## Provider adapter contract

An adapter must:

1. translate canonical queries;
2. normalize metadata without inventing values;
3. preserve provider provenance;
4. report provider errors and rate limits;
5. preserve ambiguous identities;
6. expose rights/access metadata;
7. support deterministic replay semantics where possible;
8. remain replaceable without changing Core semantics.

## Evidence boundary

A citation is not automatically evidence.

Research material becomes ZENITH evidence only through the canonical evidence/provenance contract, with explicit epistemic status and source attribution.

## Failure semantics

- unavailable provider → explicit provider failure;
- rate limited → retry metadata;
- partial response → partial result;
- ambiguous identity → unresolved state;
- missing metadata → unknown;
- unclear rights → no assumed redistribution/AI permission;
- schema change → adapter absorbs change.

## Reproducibility

A research execution records sufficient references to reproduce or audit the operation:

`query → provider → adapter version → retrieval time → provider reference → filters → normalization → selection → output reference`

Protected content itself must not be duplicated into audit or outbox records merely to improve traceability.

## Conformance

The implementation must pass the shared capability conformance gate and keep every source file at or below 180 lines.
