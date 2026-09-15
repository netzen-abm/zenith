# ADR 0001 — Canonical Capability Authorization Boundary

- **Status:** Accepted for implementation
- **Date:** 2026-09-15

## Context

ZENITH has shared Core authorization primitives (`can_read_resource` and `can_write_resource`) but application capability consumers need one explicit decision boundary. Without that boundary, individual surfaces could recreate authorization logic and drift apart.

## Decision

Introduce `core.authorize_capability(action, resource_id, purpose)` as the canonical policy-decision entry point for shared capability consumers.

The function delegates resource enforcement to the existing Core authorization primitives. It is `SECURITY INVOKER`, has an empty `search_path`, is not executable by `public`, and is granted only to `authenticated`.

Supported action families in this first bounded implementation are read/discover/search/explore and write/create/update/annotate/research_write. Unknown or malformed actions deny.

## Non-goals

- This is not a complete policy language.
- It does not replace row-level security.
- It does not authorize based on client-controlled user metadata.
- It does not introduce surface-specific policy code.
- It does not expose sensitive heritage coordinates.

## Security

The existing resource RLS and authorization primitives remain the enforcement layer. The new boundary does not grant access by itself; it centralizes capability decisions over those primitives.

## Verification

The dedicated Past Intelligence Core is PostgreSQL 17.6. The migration was applied successfully and the unauthenticated verification path returned `deny_unauthenticated`.

## Follow-up

Before production use, add authenticated positive/negative integration tests, cross-tenant isolation tests, sensitive-resource policy tests, audit-event coverage, and a typed TypeScript adapter consuming this boundary.
