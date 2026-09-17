# ADR 0004: Resilient Offline Capability and Transport Independence

- Status: Proposed
- Date: 2026-09-17

## Context

ZENITH must support archaeology and heritage work across connected, intermittent, constrained, and offline environments without making any transport provider or connectivity assumption part of the Core domain model.

ADR 0003 establishes Minimum Necessary Information, asynchronous-first resilience, transport/provider independence, and purpose-bound capability access. This ADR turns those principles into a bounded workflow contract.

The requirement is not to make every feature offline-first. The requirement is that workflows that legitimately operate in intermittent environments do not treat connectivity loss as an architectural failure.

## Decision

ZENITH will define a transport-neutral **Resilient Capability Contract** for suitable capabilities.

Canonical lifecycle:

`Need → Trigger → Acquire → Authorize / Capability Lease → Act → Persist Locally / Queue → Synchronize Opportunistically → Verify / Reconcile → Release`

### 1. Capability-level resilience

A capability declares whether it supports synchronous, asynchronous, offline, resumable, or store-and-forward operation. Offline support is explicit rather than assumed.

A capability must not silently widen its authorization scope merely because it is operating offline.

### 2. Durable operation identity

Every queued operation that can be retried must have a stable operation identifier or idempotency key. Replaying the same operation must not create unintended duplicate effects.

Where practical, payloads should be hash-verifiable and content-addressable so that integrity can be checked independently of transport.

### 3. Resumability

Large or interruptible transfers should support chunking or checkpoints where the capability benefits from it. A failed transfer should resume from verified progress rather than requiring an unnecessary full restart.

### 4. Store-and-forward

A suitable capability may persist an authorized operation locally, queue it, and transfer it when an appropriate transport becomes available.

The queue is not a policy bypass. Queued data retains its classification, purpose, provenance, retention/expiry information, and authorization context needed for safe processing.

### 5. Authorization at synchronization

An authorization or capability lease obtained earlier must not be treated as permanently valid merely because an operation was queued.

At synchronization or execution, the receiving side must re-check applicable authorization and policy. Expired capability leases must not authorize a new protected action. If renewed authorization is required, the operation must pause or fail closed until that authorization is obtained.

### 6. Provenance preservation

Offline capture must preserve the same epistemic and provenance distinctions required by Core:

`Source → Evidence → Observation / Measurement → Claim → Interpretation → Hypothesis`

The synchronization layer must not collapse source provenance, authorship, timestamps, device context, epistemic status, or uncertainty merely to simplify transport.

### 7. Conflict detection and reconciliation

Synchronization must make conflicts explicit. It must not silently overwrite divergent observations, evidence, annotations, research outputs, or metadata.

Conflict handling should distinguish at least:

- duplicate/idempotent replay;
- compatible additions;
- concurrent edits;
- incompatible values;
- authorization changes;
- expired or revoked operations;
- integrity/hash failure.

Resolution policy belongs to the capability/domain contract, not to a generic transport implementation.

### 8. Minimum Necessary Information and Cost of Context

Resilient messaging should minimize not only bytes but unnecessary context, energy, compute, storage, attention, privacy exposure, and operational complexity.

The system should prefer:

`Need → Trigger → Acquire → Act → Release`

over unnecessary polling, heartbeats, background synchronization, telemetry, or AI invocation.

This principle does not permit removal of archaeological context or provenance that is materially necessary for interpretation, verification, or future research.

### 9. Transport adapters

The Core contract remains transport-neutral. Implementations may provide adapters for:

- HTTPS / Internet;
- LAN;
- Bluetooth or local device transfer;
- field radio or other constrained links;
- Reticulum, if later justified by a measured use case;
- satellite or other intermittent links;
- USB/offline export and import.

No adapter becomes the canonical ZENITH network layer merely by being implemented first.

### 10. Security and sensitive heritage

Disconnected operation must not imply unrestricted local storage or export. Sensitive heritage data remains subject to classification, authorization, policy, retention, and audit requirements.

Caches and queues must not expose precise locations, restricted documentation, or other sensitive material simply because the device is offline.

## Contract requirements

An implementation conforming to this ADR should expose, directly or through its capability contract, enough information to answer:

1. What operation is being performed?
2. What purpose authorizes it?
3. What minimum data is required?
4. What identity and organisation context applies?
5. What capability lease or authorization decision applies?
6. When does that authorization expire?
7. Is the operation retryable and idempotent?
8. Can it resume after interruption?
9. What provenance and epistemic status must travel with it?
10. What policy applies to local persistence and export?
11. How is synchronization verified?
12. What happens when authorization, integrity, or conflict checks fail?

## Non-goals

- Making all ZENITH features offline-first.
- Replacing PostgreSQL/PostGIS or the Core system of record with a transport layer.
- Making Reticulum a ZENITH-wide network dependency.
- Requiring one binary wire format for all capabilities.
- Treating an offline authorization as permanently valid.
- Silently resolving domain conflicts with last-write-wins.
- Removing provenance or context solely to reduce payload size.

## Consequences

Positive:
- Field workflows can survive intermittent connectivity.
- Transport choice remains replaceable.
- Retry and synchronization become explicit engineering contracts.
- Authorization and privacy remain valid across disconnected operation.
- Evidence and provenance survive transport boundaries.
- Future hardware and constrained-network adapters can integrate without changing Core semantics.

Costs:
- Queue and operation lifecycle state must be designed and tested.
- Idempotency and reconciliation add implementation complexity.
- Local storage requires explicit retention and protection policies.
- Domain capabilities must define their own conflict semantics.
