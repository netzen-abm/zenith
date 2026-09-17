# ADR 0006: Operation and Queue Lifecycle

- Status: Proposed
- Date: 2026-09-17

## Decision summary

ZENITH will define deferred work through a canonical Operation and Queue Lifecycle that is independent of transport, queue technology, database vendor, device, and programming language.

The queue is a delivery and resilience mechanism. Authorization and policy remain separate control-plane concerns.

## Decision

Use the lifecycle:

`Need → Trigger → Acquire → Authorize / Capability Lease → Act → Persist locally / Queue → Synchronize opportunistically → Verify / Reconcile → Release`

Operations carry immutable identity, scoped idempotency, purpose, authorization reference, expiry, integrity, classification, epistemic status, and provenance sufficient for safe deferred execution.

Execution and synchronization must re-check current authorization and policy. An expired capability lease cannot authorize a retry.

## Architectural principles

1. **Asynchronous-first** — work may be delayed without changing its semantic identity.
2. **Store-and-forward** — disconnected clients can persist authorized work locally and synchronize later.
3. **Idempotency** — retries must not duplicate externally visible effects.
4. **Resumability** — large work may be chunked without losing operation identity or provenance.
5. **Explicit conflict** — competing domain states are preserved and reconciled explicitly.
6. **Transport independence** — HTTPS, LAN, Bluetooth, LoRa, Reticulum, satellite, USB/offline export, and future transports are adapters.
7. **Authorization separation** — the queue cannot grant authority merely by carrying a lease reference.
8. **Minimum Necessary Information** — deferred work should minimize bytes, energy, compute, storage, attention, privacy exposure, and complexity without discarding archaeological context required for provenance or reproducibility.
9. **Auditability** — lifecycle transitions that affect protected data or actions are attributable and reconstructable subject to policy.
10. **Silence is a capability** — unnecessary polling, heartbeat traffic, telemetry, and background synchronization should not be required by the canonical contract.

## Consequences

This creates a shared primitive usable by Field, Research, Explore, AI, hardware adapters, and future surfaces without coupling them to a specific queue or transport implementation. It also makes offline behavior a controlled capability rather than an exception implemented separately by each surface.

The implementation cost includes state-transition validation, idempotency handling, retry policy, local protection, conflict reconciliation, audit integration, and transport adapters.

## Non-goals

- Selecting a specific queue broker or offline database at the architecture level.
- Making Reticulum or any other transport mandatory.
- Creating a second authorization framework inside the queue.
- Applying universal last-write-wins reconciliation.
- Requiring every operation to support offline execution.

## Related contracts

See `docs/contracts/RESILIENT-CAPABILITY-CONTRACT.md` and `docs/contracts/OPERATION-QUEUE-CONTRACT.md`.