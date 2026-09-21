# ADR 0015 — Research Intelligence Capability Boundary

## Status

Accepted for implementation on `feat/research-intelligence-capability`.

## Context

ZENITH already has a provider-neutral Research Provider Contract. The next step must prove that research workflows consume the shared execution kernel rather than create a second lifecycle, authorization, or provenance system.

Research providers are replaceable adapters. Their identifiers, metadata, citation graphs, availability, rights, and failures are provider-attributed inputs, not canonical ZENITH semantics.

## Decision

Implement Research Intelligence as a domain capability with four boundaries:

1. **Query contract** — validates a canonical research query and records requester, organisation, purpose, requested fields, and policy-relevant constraints.
2. **Provider adapter** — translates the canonical query into a provider request and returns normalized results plus provider provenance.
3. **Execution boundary** — queued provider work uses the canonical operation/reservation/handler/durable-outcome path.
4. **Evidence boundary** — research results become evidence only through the canonical evidence/provenance model; citation relationships do not automatically become evidentiary support.

## Security

- Authorization is evaluated before protected operation creation and again at execution through the shared coordinator.
- Tenant/resource isolation is enforced at the database boundary.
- Protected retrieval, retention, export, annotation, and AI processing require their applicable policy decision.
- Provider rights metadata is preserved; unclear rights never become implicit permission.
- Provider failures and partial responses are explicit and never converted into fabricated facts.
- Sensitive research material is not copied into operation audit/outbox records merely for convenience.

## Idempotency and provenance

Every queued research execution has durable operation identity and follows the canonical reservation boundary. Provider references, adapter version, retrieval time, query parameters, normalization version, and selection decisions remain attributable and reproducible.

Duplicate provider responses must not create duplicate canonical records when the same operation is replayed.

## Non-goals

This capability does not:

- create a new authorization engine;
- create a second operation lifecycle;
- make one provider mandatory;
- infer scholarly truth from citation relationships;
- silently resolve ambiguous identities;
- grant redistribution or AI-processing rights;
- introduce a graph database solely for research.

## Acceptance gate

Implementation is conformant only when tests demonstrate:

- authorization denial;
- tenant isolation;
- reservation before provider handler execution;
- authoritative attempt propagation;
- durable success/failure outcome;
- idempotent replay;
- explicit partial/provider failure;
- provenance preservation;
- no direct protected-table mutation;
- source files at or below the repository's 180-line limit.

## Consequence

Research Intelligence becomes a proving vertical for ZENITH's reusable infrastructure. New providers can be added without changing Core semantics, and future Explore, Field, Museum, Education, and AI surfaces can consume the same research contracts.
