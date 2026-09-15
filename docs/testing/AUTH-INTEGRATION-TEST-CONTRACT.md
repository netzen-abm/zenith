# Authentication & Authorization Integration Test Contract

**Status:** Accepted as the integration-test foundation

## Purpose

This document defines the minimum runtime contract for verifying ZENITH authorization against the real Supabase Auth + PostgreSQL/PostGIS + RLS boundary.

It deliberately does **not** introduce a test framework, package manager, application runtime, service account, or repository secret. The repository currently has no established application runtime that would justify adding those dependencies solely to prove the database authorization layer.

## Why this exists

The canonical capability boundary is implemented by `core.authorize_capability(action, resource_id, purpose)`. Its unit/static coverage can prove malformed/unknown/unauthenticated behavior, but authenticated authorization, tenant isolation, and sensitive-resource policy require a real trusted identity context and real RLS evaluation.

Passing unit tests alone is therefore not an architecture gate pass.

## Runtime under test

The eventual integration harness MUST exercise these real boundaries rather than mocking them:

1. Supabase Auth creates/owns the test identities.
2. A real authenticated session supplies the JWT identity context.
3. `core.identities.auth_user_id` maps the authenticated user to a Core identity.
4. Core resource membership and RLS determine tenant/resource authorization.
5. `core.authorize_capability(...)` is the canonical decision boundary.
6. Sensitive/public projections are checked for disclosure behavior.
7. Audit behavior is verified where the exercised capability produces an audit event.

## Environment contract

The future executable adapter MUST obtain configuration from the test environment, never from committed files containing secrets.

Required configuration:

- `SUPABASE_URL` — test Supabase project URL.
- `SUPABASE_PUBLISHABLE_KEY` (or the project-supported equivalent) — client-safe key for Auth/session establishment.
- `SUPABASE_TEST_USER_A_EMAIL` / `SUPABASE_TEST_USER_A_PASSWORD` — disposable test identity A.
- `SUPABASE_TEST_USER_B_EMAIL` / `SUPABASE_TEST_USER_B_PASSWORD` — disposable test identity B.

Production credentials MUST NOT be used.

## Fixture requirements

The harness MUST create or provision disposable fixtures representing at least:

- two distinct organisations/tenants;
- one identity in each tenant;
- one protected resource owned by tenant A;
- one protected resource owned by tenant B;
- one public-safe resource/projection;
- one sensitive-heritage resource whose precise spatial representation is not public;
- memberships sufficient to exercise viewer/editor/owner decisions.

Fixtures MUST use supported Auth mechanisms for managed `auth.users` relationships. Tests MUST NOT insert fake rows directly into `auth.users` or bypass the Auth boundary with fabricated JWT claims.

## Mandatory acceptance cases

### AUTH-001 — authenticated identity resolution

A valid disposable Auth session resolves to the expected Core identity. No session means no authenticated identity.

### AUTH-002 — authenticated allowed read

An identity with permitted membership can read the resource through the canonical authorization boundary.

### AUTH-003 — authenticated denied read

An authenticated identity without permission cannot read a protected resource.

### AUTH-004 — authenticated allowed write

An identity with editor/owner permission can perform the permitted write path through the canonical boundary.

### AUTH-005 — authenticated denied write

A viewer or otherwise unauthorized identity cannot perform the protected write path.

### AUTH-006 — cross-tenant isolation

Tenant A cannot read or write tenant B's protected resource merely because the user is authenticated.

### AUTH-007 — public-safe disclosure

Public discovery/read behavior exposes only the intentionally public representation and never precise sensitive heritage coordinates.

### AUTH-008 — sensitive-heritage policy

A protected sensitive resource is generalized, denied, or otherwise policy-constrained according to the applicable heritage-safety policy. Existence of precise coordinates in storage is not sufficient authorization to disclose them.

### AUTH-009 — unknown capability fail-closed

Unknown or unsupported capability/action families remain denied in an authenticated session.

### AUTH-010 — purpose/context preservation

When a purpose is supplied, the authorization decision retains it as decision/audit context. Purpose MUST NOT itself grant access.

### AUTH-011 — auditability

Where the exercised capability is required to produce an audit event, the test verifies that the event records sufficient decision context without leaking protected payloads.

## Cleanup and isolation

- Test identities and fixtures MUST be disposable.
- Cleanup MUST be idempotent and scoped to test-owned fixtures.
- A failed test MUST NOT leave reusable privileged credentials in the repository or CI logs.
- Tests MUST run against a dedicated non-production project/environment.
- Parallel test execution must not allow one test run to consume another run's fixtures; deterministic run-scoped identifiers are preferred.

## What this contract does not permit

- No direct SQL seeding into managed `auth.users` to fake authentication.
- No fabricated JWT claims as a substitute for a real Auth session.
- No service-role credential in client-side test code.
- No disabling RLS to make tests pass.
- No weakening `core.authorize_capability`, `can_read_resource`, or `can_write_resource` solely for testability.
- No user-metadata-based authorization.
- No production data or production credentials in integration tests.

## Implementation boundary

The eventual executable test adapter should be introduced only when ZENITH has an established application/test runtime. At that point it should consume the typed authorization contract rather than creating a second authorization model.

The same harness should subsequently become the reusable verification foundation for:

- authorization and policy;
- RLS and tenant isolation;
- sensitive-heritage disclosure controls;
- provenance and evidence access;
- audit events;
- capability adapters;
- representative user journeys.

## Current verification state

The repository currently has executable SQL/static coverage for malformed, unknown, and unauthenticated authorization behavior. Authenticated positive/negative and cross-tenant cases remain **pending real Auth-backed integration execution**. This is intentional: no fake identity or bypass has been introduced to manufacture a green result.
