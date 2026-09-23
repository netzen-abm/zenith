# ZENITH Shareable Infrastructure Architecture

**Status:** Adopted baseline  
**Date:** 2026-09-23

## 1. Architectural objective

ZENITH is a Past & Heritage Intelligence ecosystem. The permanent asset is a secure, provider-neutral, shareable Past Intelligence Core that can support independent applications, domain capabilities, research workflows, field acquisition, museums, learning surfaces, APIs/SDKs, AI agents and future adapters without recreating security or execution policy.

## 2. Canonical shared-infrastructure chain

`Identity → Authorization → Tenant/RLS → Capability Contract → Operation → Reservation → Handler → Durable Outcome → Outbox → Provenance`

Each capability consumes this chain. A domain capability may add domain semantics, validation and provider contracts, but it must not create a competing authorization authority, tenant-isolation mechanism, operation lifecycle, reservation system, durable-outcome path, or protected mutation path.

## 3. Responsibility boundaries

### Core authority
Owns identity context, authorization policy, tenant/resource isolation and protected database mutation boundaries.

### Capability layer
Owns domain contracts, validation and capability semantics. It remains provider-neutral and must not import provider/infrastructure implementations directly.

### Operation kernel
Owns the protected execution lifecycle:
Authorization → Reservation → exactly-one handler entry → Durable Outcome → lifecycle transition + outbox.

The coordinator remains cohesive because these responsibilities share invariants and transaction semantics. They are not split merely because the file/class becomes large.

### Persistence boundary
Owns durable operation state, reservation claims, outcomes and domain request persistence. Database security functions remain narrow and explicit.

### Provider/device boundary
Adapters own external systems, transports and devices. They are replaceable and cannot become authorities for identity, authorization, tenancy or lifecycle.

### Provenance boundary
Owns evidence continuity, source attribution, epistemic status and reproducibility. Provenance is evidence about what happened or was asserted; it is not an execution authorization mechanism.

## 4. Split rule

Split code only when separation creates an independent architectural boundary of:

- change;
- trust;
- persistence;
- provider/device dependency; or
- independent reuse.

Keep tightly coupled responsibilities together when splitting would:

- weaken invariants;
- duplicate orchestration;
- create competing lifecycle logic;
- introduce another authorization path; or
- require fragile cross-module coordination for one atomic transaction.

File/class size is a review signal, not an architectural boundary. The repository's 180-line source guideline must never force a split that damages cohesion.

## 5. Shareable surface model

Independent surfaces consume the same contracts and authorities:

- Web/application surfaces
- Android/iOS or other clients
- Research
- Field acquisition
- Museum/collection
- Learning
- Community
- API/SDK
- AI/agent services
- provider and device adapters
- future federation surfaces

A surface may fail independently without invalidating the Core or another surface.

## 6. Security invariants

1. Authorization is evaluated before protected execution.
2. Tenant/organisation context is enforced at the database boundary.
3. RLS remains enabled and forced on protected data.
4. Direct authenticated lifecycle mutation is prohibited.
5. Reservation is the concurrency claim boundary.
6. A handler is entered only after successful reservation.
7. Reserved execution produces a durable outcome or an explicit non-durable failure.
8. Outcome, lifecycle transition and outbox creation remain one database transaction.
9. Protected payloads are not copied into audit/outbox records for convenience.
10. Provider/device adapters cannot bypass Core authorization.
11. Sensitive spatial information follows explicit precision and authorization policy.
12. New capabilities reuse the shared contracts rather than recreating security or execution infrastructure.

## 7. Evolution rule

Every new shared capability must identify:

- its domain responsibility;
- its authorization boundary;
- its persistence boundary;
- its provider/device dependencies;
- its provenance requirements;
- its reuse surface;
- its tests for positive and negative authorization;
- its durable execution and concurrency behavior.

Changes to Core authorities or execution-kernel invariants require an ADR plus corresponding positive and negative tests.

## 8. Repository topology

No root `src/` directory is required. Top-level architectural boundaries remain visible:

`apps/ · core/ · domains/ · packages/ · services/ · adapters/ · ai/ · data/ · tests/ · infra/ · docs/ · scripts/`

Package-level `src/` directories remain valid when a package is itself an independent build or distribution boundary.

## 9. Definition of done

A capability is not ecosystem-ready merely because its domain code works. It must consume the shared identity, authorization, tenant/RLS, capability, operation, reservation, durable outcome, outbox and provenance infrastructure and pass the relevant architecture, security, fresh-database, concurrency and integration gates.
