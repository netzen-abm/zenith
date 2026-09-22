# Capability Boundary

**Status:** Canonical architecture rule  
**Scope:** `packages/capabilities`

## Purpose

A capability is a reusable domain boundary. It owns domain behavior and orchestration, not a specific database, provider, transport, or trust implementation.

### Dependency direction

```
Applications / UX
      ↓
API / SDK / Surfaces
      ↓
Capabilities
      ↓
Execution boundary
      ↓
Contracts
      ↓
Adapters / Infrastructure
```

## Responsibility boundaries

Capabilities may own:

- domain models and invariants
- domain validation
- capability-level orchestration
- composition of stable contracts
- provider-neutral request/response semantics

Capabilities must not become the authority for:

- authorization policy
- persistence implementation
- PostgreSQL/PostGIS/Supabase details
- external provider SDKs
- transport protocols
- alternate execution lifecycles
- direct operation-state mutation

## Split rule

Split code when the split creates an independent boundary of:

1. change
2. trust
3. persistence
4. provider dependency
5. independent reuse

Do **not** split merely because a file or class is large.

The canonical execution coordinator remains cohesive because authorization, reservation, handler entry, and durable outcome form one security-sensitive lifecycle. Its interfaces are separated; its orchestration is not.

## Persistence rule

A capability should depend on a repository/store contract. PostgreSQL, PostGIS, Supabase, local stores, and other persistence implementations belong behind that contract.

A persistence adapter may use database-specific SQL. The capability must not need to know that SQL exists.

## Provider rule

A capability should depend on a provider contract. Provider SDKs, retry mechanics specific to a provider, and vendor-specific translation belong in adapters.

## Trust rule

Authorization is a shared security boundary. A capability may request an authorization decision through the canonical contract but must not implement a competing authorization authority.

## Ratchet

CI enforces this boundary. A small, explicit legacy allow-list is retained only for capability persistence implementations already being converged on canonical branches. The allow-list must shrink, never grow, unless an ADR documents a deliberate architectural exception.
