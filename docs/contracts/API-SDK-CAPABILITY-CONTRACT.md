# API and SDK Capability Contract

**Status:** Adopted baseline  
**Date:** 2026-10-07

## Purpose

The API/SDK boundary is an independent reuse boundary for ZENITH. It exposes canonical capability contracts to external and internal consumers without exposing database, provider, authorization implementation, or execution-kernel internals.

The API is a consumer of the Past Intelligence Core. It is not a second application backend and not a second security or workflow authority.

## Canonical boundary

`Consumer → API/SDK Contract → Capability Contract → Operation → Execution Kernel → Durable Outcome`

The API/SDK layer may translate transport-specific requests into canonical capability requests and translate canonical results into stable response envelopes.

It must not bypass the shared protected path:

`Identity → Authorization → Tenant/RLS → Capability Contract → Operation → Reservation → Handler → Durable Outcome → Outbox → Provenance`

## Contract responsibilities

The API/SDK contract owns:

- versioned request and response envelopes;
- capability identifiers and operation identity exposure;
- idempotency-key semantics at the API boundary, delegating execution authority to the canonical operation infrastructure;
- stable error taxonomy;
- pagination and cursor semantics;
- provenance references and evidence references;
- compatibility and versioning rules;
- SDK-neutral serialization.

The API/SDK contract does **not** own:

- authorization policy decisions;
- tenant isolation;
- operation lifecycle;
- reservation or attempt numbering;
- durable outcome persistence;
- outbox publication;
- provider-specific persistence;
- evidence epistemic authority.

## Security and tenancy

Every protected API request must resolve through the same canonical identity, authorization and database-enforced tenant/resource isolation used by native surfaces.

An API caller must never be able to:

- write protected lifecycle/outcome/outbox records directly;
- supply or override an authoritative execution attempt count;
- bypass canonical authorization;
- bypass RLS/tenant isolation;
- select a provider implementation as a substitute for a canonical capability.

## Idempotency

API idempotency keys are request-level coordination metadata. They must map to the canonical operation identity/lifecycle rather than create an independent idempotency engine.

The API layer must not independently decide that an operation has completed when the durable operation/outcome boundary says otherwise.

## Errors

Errors exposed by the API must distinguish at minimum:

- invalid request;
- unauthenticated;
- unauthorized;
- tenant/resource scope violation;
- conflict/reservation rejection;
- provider failure;
- retryable execution failure;
- durable-outcome failure;
- unavailable dependency.

Transport-specific status codes are projections of the canonical error semantics; they must not redefine the underlying lifecycle meaning.

## Pagination

Pagination uses opaque, versionable cursors. Cursors must not expose database implementation details or permit cross-tenant traversal.

A cursor is valid only within its declared resource/query scope and authorization context.

## Provenance and evidence

When a capability returns evidence, derived knowledge, research results, or provenance-bearing records, the API should expose stable references to the canonical evidence/provenance model rather than copying protected payloads into API-specific audit structures.

AI-generated or inferred content must preserve the canonical epistemic status and provenance metadata.

## Versioning

Breaking contract changes require a new API contract version or an explicitly versioned capability contract.

Internal provider changes, database migrations, or execution-kernel refactoring must not require consumer changes when the canonical contract remains compatible.

## SDK portability

SDKs are generated or maintained against the versioned contract. SDK implementation language must not alter authorization, tenancy, lifecycle, reservation, outcome, or provenance semantics.

The same contract must be consumable by web, mobile, field, museum, learning, community, AI-agent, and third-party integrations.

## Conformance gate

An API/SDK implementation is ecosystem-compatible only when tests demonstrate:

1. canonical authentication and authorization;
2. tenant/RLS isolation;
3. canonical capability invocation;
4. durable operation identity;
5. reservation before handler execution;
6. authoritative attempt propagation;
7. durable outcome recording;
8. provenance/evidence continuity where applicable;
9. provider independence;
10. no direct protected lifecycle/outcome/outbox mutation;
11. no alternate authorization or idempotency authority;
12. stable negative-path behavior.

## Architectural rule

The API/SDK boundary is a legitimate independent boundary because it has a distinct reason to change and an independent reuse surface.

It must remain thin enough that business/domain orchestration does not migrate into transport code.

Do not split capability or execution code further merely to make the API layer appear modular. Responsibility should be separated only where the separation creates an actual boundary of change, trust, persistence, provider dependency, or independent reuse.

## Relationship to the execution kernel

The execution coordinator remains cohesive. API/SDK integration consumes it; it does not decompose, replace, or duplicate it.

Any change to the execution kernel requires the execution-kernel contract and invariant tests to remain green.

## Source of truth

This contract is subordinate to:

- `docs/contracts/EXECUTION-KERNEL-CONTRACT.md`
- `docs/contracts/CAPABILITY-CONFORMANCE-CONTRACT.md`
- `docs/SHARED-PLATFORM-ARCHITECTURE.md`
- `docs/ARCHITECTURE-GOVERNANCE.md`

Where a transport concern conflicts with a protected Core invariant, the Core invariant wins.
