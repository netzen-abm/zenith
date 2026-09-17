# ADR 0003: Explicit Organisation Context and Scarcity/Resilience Principles

- Status: Proposed
- Date: 2026-09-17

## Context

ZENITH currently has identity, organisation, resource-membership, authorization, evidence/provenance, spatial/temporal, and research primitives. The Core-wide audit identified that organisation context is inferred rather than represented by an explicit identity-to-organisation membership and active-context contract.

Research supplied for this ADR includes Reticulum's design philosophy and ecosystem, plus GrapheneOS privacy controls and open-source/device-hardening practices. The research is useful as architectural input, not as a specification to copy.

## Decision

### 1. Explicit principal context

ZENITH should represent organisation membership explicitly and treat the active organisation as authorization context rather than inferring it from resource membership.

Canonical flow:

`Auth User → ZENITH Identity → Organisation Membership(s) → Active Organisation Context → Authorization/Policy → Action`

The design must support identities with multiple organisation memberships, explicit membership role/status, auditable context selection, and fail-closed behavior when no valid active context exists for an organisation-scoped action.

Existing resource memberships remain resource-level authorization and must not be repurposed as organisation membership.

### 2. Cost-aware information design

ZENITH should adopt a **Minimum Necessary Information** principle for every transport and interface, independent of whether the underlying medium is a cloud API, mobile network, LAN, field radio, mesh, or store-and-forward link.

Before transmission, a capability should be able to answer:

- What intent must be conveyed?
- What is the minimum information needed?
- What context is already shared and therefore need not be repeated?
- Can the message be represented as a compact typed code rather than verbose metadata?
- Can larger payloads be deferred, referenced, compressed, summarized, or transferred opportunistically?

This becomes an optimization and resilience principle, not a requirement to use binary protocols everywhere.

### 3. Asynchronous-first resilience

For field and intermittent environments, ZENITH should treat delay tolerance, retryability, idempotency, resumability, and store-and-forward delivery as first-class capabilities rather than exceptional failure paths.

A transport adapter may provide a best-effort real-time path, but Core workflows must not assume continuous connectivity when the use case does not require it.

### 4. Transport/provider independence

Reticulum should be treated as a candidate transport adapter for constrained/offline/mesh environments, not as ZENITH's canonical network layer. The Core data model and capability contracts must remain transport-neutral.

Potential future flow:

`Core Capability → Transport Adapter → Internet / LAN / Reticulum / Field Link`

Reticulum-specific concepts such as portable cryptographic identity, announce/discovery, delay-tolerant messaging and compact framing may inform adapter design without becoming requirements of every deployment.

### 5. Privacy-preserving capability design

The permission model should minimize access scope, support purpose-bound leases, and release access after the purpose is complete. The GrapheneOS examples reinforce a useful principle: access can be made more granular than an all-or-nothing permission whenever the platform permits it.

ZENITH must distinguish:

`OS permission ≠ ZENITH capability authorization ≠ data access policy`

and must not claim that every platform permits programmatic OS-level revocation.

### 6. Public protocol vs implementation rights

The supplied Reticulum material highlights a useful architectural distinction between an open protocol and rights governing a reference implementation. ZENITH should preserve its existing layered licensing model rather than adopting Reticulum's license unchanged.

Software licenses, protocol specifications, datasets/cultural materials, models, trademarks, and hosted services remain separate governance layers.

### 7. Harm/safety principle

The supplied Harm Principle is useful as a design prompt: infrastructure should include explicit safety constraints and prevent dangerous capability from becoming invisible or default. ZENITH will express this through technical policy controls, capability authorization, auditability, sensitive-heritage protection, and safety governance rather than copying a third-party license restriction without legal review.

## Consequences

Positive:
- Correct multi-organisation authorization semantics.
- Better auditability and fail-closed behavior.
- Lower payload and battery/network costs in constrained environments.
- Better operation under intermittent connectivity.
- Transport and device independence remain intact.
- Privacy controls become composable and purpose-aware.

Costs:
- Additional Core schema and runtime-context complexity.
- More explicit protocol design and message contracts.
- Need for integration tests around organisation switching and authorization.
- Additional implementation work for queued/offline workflows.

## Research adoption matrix

| Research idea | ZENITH treatment |
|---|---|
| Cost of a byte / minimum information | **Adopt** as a cross-cutting efficiency principle |
| Store-and-forward / delay tolerance | **Adopt** for suitable field/offline workflows |
| Portable cryptographic identity | **Adopt conceptually**; integrate with Core identity rather than replacing it |
| Zero-trust / hostile transport assumptions | **Adopt** as a threat-modeling principle |
| Transport independence | **Adopt**; Reticulum becomes an optional adapter candidate |
| Compact binary messaging | **Study/pilot** where measurable benefit exists |
| Reticulum as universal ZENITH network | **Do not adopt**; would violate provider/transport neutrality |
| Reticulum license | **Do not copy**; retain ZENITH's layered licensing policy |
| Harm Principle as license clause | **Study as governance input**; legal review required before any licensing effect |
| GrapheneOS granular scopes | **Adopt conceptually** for capability design where platform APIs permit |
| Open-source mobile distribution resilience | **Study/adopt** for deployment strategy |

## Non-goals

- Replacing PostgreSQL/PostGIS or Supabase with a decentralized transport.
- Making every ZENITH message binary or aggressively compressed.
- Treating offline mode as mandatory for every feature.
- Copying Reticulum's protocol, implementation, or license into ZENITH without a separate technical and legal decision.
