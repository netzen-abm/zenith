# Application Capability Boundary

**Status:** Adopted baseline  
**Date:** 2026-10-05

## Purpose

The application/API layer is a transport-neutral boundary over the Past Intelligence Core. It exposes capability contracts without becoming a second authorization or execution authority.

## Boundary

The application boundary accepts a `CapabilityInvocation`, derives the canonical `AuthorizationRequest`, and submits an already-admitted `CapabilityExecution` to the shared operation infrastructure.

The transport is deliberately outside this contract. HTTP, GraphQL, mobile RPC, SDK calls, messaging and future federation protocols are adapters to this boundary.

## Canonical path

`Transport Adapter → Capability Gateway → Core Authorization → Operation → Reservation → Handler → Durable Outcome → Provenance`

A transport adapter must not:

- implement authorization policy;
- mutate operation lifecycle directly;
- bypass reservation;
- write protected persistence directly;
- become a provenance authority;
- encode provider-specific semantics into the canonical capability contract.

## Separation rule

This boundary exists because transport is an independent provider/change boundary. The execution kernel remains separate because it owns protected lifecycle invariants. Domain capabilities remain separate because they own domain semantics.

Do not introduce additional managers merely to divide these interfaces by file size.

## Multi-surface requirement

The same capability contract must be consumable by independent surfaces. A failure in one transport or application surface must not invalidate Core execution or another surface.

## Security requirements

Every protected invocation must retain:

- actor identity;
- organisation/tenant context where applicable;
- purpose;
- requested time;
- action;
- resource scope where applicable.

Authorization remains canonical. Tenant/RLS enforcement remains at the database boundary. The API boundary is not trusted as a substitute for database policy.

## Provider independence

External providers and devices are adapters below the capability boundary. Their identifiers, errors and metadata remain provider-specific until normalized by the relevant adapter contract.

## Definition of done

A new API-facing capability requires:

1. a domain capability contract;
2. canonical authorization;
3. shared operation execution;
4. reservation and durable outcome;
5. provenance requirements where applicable;
6. positive and negative authorization tests;
7. transport-independent tests;
8. provider/device adapters where required;
9. tenant/RLS verification;
10. no direct protected database mutation from transport code.
