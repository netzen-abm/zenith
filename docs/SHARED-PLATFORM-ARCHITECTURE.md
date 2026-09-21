# ZENITH Shareable Platform Architecture v1

## 1. Purpose

This document defines the reusable infrastructure boundary for the wider ZENITH ecosystem. It separates cross-cutting platform primitives from archaeological domain capabilities and independent experience surfaces.

The platform is designed so a new capability can reuse identity, authorization, tenant isolation, execution, provenance, policy, and observability without recreating those controls.

## 2. Canonical platform flow

`Identity → Authorization → Tenant/RLS → Capability Contract → Operation → Reservation → Handler → Durable Outcome → Outbox`

This is the only canonical protected-execution path.

## 3. Platform layers

### Identity
Provider-neutral identity and organisation context. Provider adapters translate external identity into the canonical identity contract.

### Authorization
One policy authority for capability/resource decisions. RLS remains a database enforcement layer and is not replaced by application checks.

### Tenant and resource isolation
Organisation and resource scope are enforced at the database boundary. Application context is advisory; database policy is authoritative.

### Capability contracts
Stable, language-neutral contracts describe inputs, outputs, permissions, evidence requirements, sensitivity, and lifecycle expectations.

### Operations
Every durable execution receives an operation identity. Operation state is the lifecycle authority.

### Reservation
Persistent reservation admits exactly one concurrent handler attempt. The database is authoritative for attempt numbering.

### Execution
The shared coordinator reauthorizes immediately before reservation and invokes the handler only after successful reservation.

### Durable outcome
Handlers return explicit outcomes. The canonical recorder atomically persists the outcome, lifecycle advancement, and outbox event.

### Outbox
External publication is derived from durable state. Domain code must not create parallel event/audit paths.

## 4. Evidence and provenance plane

Evidence is a first-class cross-cutting concern.

Each capability that creates or transforms knowledge should preserve, where applicable:

- source identity;
- acquisition context;
- creator or actor;
- timestamp;
- method;
- transformation history;
- rights and access constraints;
- epistemic status;
- confidence or uncertainty;
- links to derived artefacts.

Sensitive heritage information must carry policy metadata so public projections can be safer than restricted research views.

## 5. Policy and safety plane

The shared policy layer must support:

- sensitivity classification;
- purpose/context;
- consent requirements;
- geographic or temporal disclosure controls;
- redaction/generalisation;
- retention and deletion rules;
- export controls;
- public-safe projection rules.

A surface must not implement its own security interpretation when a shared policy contract exists.

## 6. AI and agent boundary

AI is a consumer of authorized context, not an authorization authority.

The AI layer must receive the minimum necessary authorized context and preserve provenance and epistemic status through retrieval, reasoning, generation, and publication.

Agent actions must use the same capability contracts and execution kernel as human-initiated operations.

Model/provider selection remains replaceable behind an adapter.

## 7. Adapter architecture

Independent surfaces may include web, mobile, field, museum, learning, community, API, CLI, and agent interfaces.

Each surface owns presentation and interaction concerns only.

Adapters translate surface-specific protocols into canonical capability contracts. Failure of one surface must not invalidate another surface.

## 8. Provider portability

External providers are replaceable adapters:

- identity provider;
- object/file storage;
- database services;
- search/index services;
- AI/model providers;
- maps/geospatial services;
- messaging;
- institutional repositories.

Provider-specific identifiers must not become canonical domain identifiers unless an ADR establishes a justified interoperability boundary.

## 9. Language portability

TypeScript remains the default application and contract language.

Python, Rust, SQL, and other languages enter only at bounded capability boundaries where they provide a concrete technical advantage.

The canonical domain model, authorization semantics, evidence model, and capability contracts remain language-neutral.

## 10. Shareability rule

A platform primitive is shareable only when it has:

1. a stable contract;
2. explicit ownership;
3. tenant and authorization semantics;
4. failure semantics;
5. positive and negative tests;
6. conformance coverage;
7. migration/versioning rules;
8. provider-independent interfaces where practical.

A feature that cannot meet these conditions remains domain-local until proven reusable.

## 11. Evolution rule

Do not generalize prematurely.

First prove a capability with the existing kernel. Promote a domain pattern into shared infrastructure only when multiple capabilities demonstrate the same invariant or boundary.

Any new cross-cutting primitive requires an ADR and executable conformance evidence.

## 12. Security invariants

The platform must never:

- bypass canonical authorization;
- bypass database tenant isolation;
- execute a handler before reservation;
- fabricate attempt counts in application code;
- write protected lifecycle/outcome data through direct client mutation;
- copy protected payloads into audit/outbox merely for convenience;
- create a second idempotency or execution engine;
- allow AI or a surface adapter to become a policy authority.

## 13. Initial capability map

The platform is intended to support archaeology/research capabilities including:

- evidence annotation;
- research intelligence;
- knowledge graph;
- space/time;
- field data acquisition;
- collection and museum workflows;
- provenance and rights;
- discovery/search;
- learning and public interpretation.

These are capabilities, not competing infrastructure stacks.

## 14. Acceptance gate

Before a new capability is considered platform-compatible, verify:

- authorization is canonical;
- tenant isolation is database-enforced;
- operation identity is durable;
- reservation precedes handler entry;
- attempt count is authoritative;
- concurrent admission is single-entry;
- outcome is durable;
- protected mutation uses its canonical boundary;
- provenance is preserved where relevant;
- no alternate security or lifecycle path exists.

## 15. Architectural objective

ZENITH should behave as one infrastructure with many independent capabilities and surfaces:

`Shared Trust Infrastructure + Independent Capabilities + Independent Surfaces`

The objective is reuse without centralising domain logic, and independence without duplicating security-critical infrastructure.
