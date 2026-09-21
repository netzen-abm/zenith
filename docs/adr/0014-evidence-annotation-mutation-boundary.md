# ADR 0014 — Evidence Annotation Mutation Boundary

## Status

Accepted

## Date

2026-09-20

## Context

ZENITH has a canonical capability authorization boundary and a frozen execution kernel. The first real vertical capability must prove that a domain side effect can compose with those shared boundaries without granting authenticated clients direct write access to protected evidence tables.

Evidence records are protected Core data. The evidence schema currently exposes read access through RLS but intentionally does not expose direct authenticated INSERT privileges.

## Decision

Introduce a durable evidence-annotation request table and a single protected mutation function:

`core.evidence_annotation_requests → core_private.consume_evidence_annotation_request(uuid) → core.evidence`

The request is tenant- and identity-scoped with RLS. The mutation function is a narrowly scoped `SECURITY DEFINER` function because the authenticated role does not receive direct INSERT privilege on `core.evidence`.

The function:

1. resolves the request only for the current identity and organisation;
2. requires the request to be pending;
3. rechecks current write authorization for the target resource;
4. verifies source organisation scope;
5. inserts the evidence with the initiating identity;
6. marks the request consumed in the same transaction.

The function uses an empty `search_path`, fully qualified relations, explicit execute grants, and no anonymous execute privilege.

## Why this does not create a second authorization authority

`core_private.consume_evidence_annotation_request` does not decide general capability policy. It enforces the domain mutation preconditions and calls the existing canonical `core.can_write_resource` policy primitive. General action authorization remains `core.authorize_capability`.

## Consequences

### Positive

- First real domain mutation composes with the frozen execution kernel.
- Protected evidence is not directly writable by clients.
- Payload is durable and referenced by operation identity.
- Current policy is rechecked at the side-effect boundary.
- Request consumption is idempotent at the database boundary.

### Negative

- Adds a domain request table and mutation function.
- Requires conformance tests for both request RLS and mutation behavior.
- The first vertical still relies on the existing operation queue for execution and durable outcome.

## Non-goals

- General-purpose evidence workflow engine.
- Generic CRUD RPC layer.
- Replacement authorization framework.
- Full research-project orchestration.
- Provider integration.

## Verification

- Fresh database schema/security assertions.
- Capability unit/conformance test.
- Execution-kernel conformance suite.
- PostgreSQL execution coordinator E2E and concurrency gates.
