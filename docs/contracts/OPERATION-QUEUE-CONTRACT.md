# ZENITH Operation and Queue Lifecycle Contract

## Purpose

This contract defines the provider- and transport-neutral lifecycle for deferred, offline-capable, retryable ZENITH operations.

The queue is a resilience primitive, not a second authorization system and not a domain-specific database.

## Canonical lifecycle

```text
Need
 ↓
Trigger
 ↓
Acquire
 ↓
Authorize / Capability Lease
 ↓
Act
 ↓
Persist locally / Queue
 ↓
Synchronize opportunistically
 ↓
Verify / Reconcile
 ↓
Release
```

An operation may be created online or offline. Execution and synchronization must independently enforce the applicable authorization and policy boundary.

## Canonical operation envelope

```text
operation_id
idempotency_key
capability
resource_id
organisation_id
identity_id
purpose
created_at
not_before
expires_at
state
attempt_count
payload_ref
content_hash
classification
epistemic_status
provenance_ref
lease_ref
parent_operation_id
error_code
```

Fields are contract concepts rather than a mandatory storage schema. Implementations may add transport- or provider-specific extensions without changing Core semantics.

## State model

The canonical states are:

`created → authorized → queued → in_flight → acknowledged → completed`

Alternative transitions include:

- `created → rejected | cancelled`
- `authorized → rejected | expired | cancelled`
- `queued → blocked | expired | cancelled | in_flight`
- `in_flight → retry_wait | conflict | acknowledged | rejected`
- `retry_wait → queued | expired | rejected`
- `blocked → queued | cancelled | expired`
- `acknowledged → completed`

Terminal states are `completed`, `rejected`, `expired`, `cancelled`, and `conflict` unless a reconciliation workflow explicitly reopens a conflict through a new operation.

## Mandatory invariants

1. `operation_id` is globally unique and immutable.
2. Idempotency keys are scoped so retries cannot accidentally execute a different operation.
3. No operation executes without a valid authorization decision at the execution boundary.
4. A capability lease cannot become valid again merely because an operation is retried.
5. Expired authorization or lease state blocks execution and synchronization until reauthorization where required.
6. Payload integrity is verified before execution when a content hash is supplied.
7. Provenance, classification, epistemic status, purpose, and applicable retention information remain attached to deferred work.
8. Domain conflicts are detected explicitly; silent last-write-wins is not a canonical reconciliation policy.
9. Only retryable failures enter retry flow; permanent failures become rejected or blocked with an explicit reason.
10. Large payloads may be chunked and resumed through manifests without changing the operation identity.
11. Local queues and caches minimize sensitive metadata and use platform-appropriate protection for sensitive material.
12. Retention and expiry policy applies to queued, failed, and completed operations.
13. A queue must not disclose sensitive heritage information merely because it is disconnected or awaiting synchronization.
14. Receiving systems re-check authorization and policy rather than trusting stale offline authorization indefinitely.

## Retry and backoff

Adapters should use bounded retries with exponential backoff and jitter for transient failures. Retry metadata must be observable through the operation record or audit trail. Implementations should define a dead-letter or operator-review path for exhausted retries rather than retrying indefinitely.

## Idempotency

A retry must be safe to repeat at the protocol boundary. Where the underlying action is not naturally idempotent, the adapter must use an idempotency key or equivalent deduplication mechanism before committing the action.

## Conflict and reconciliation

Conflict is an explicit epistemic and operational condition, not an error to hide. Reconciliation must preserve competing versions, provenance, timestamps, actor context, and relevant evidence. Resolution should produce an auditable decision or a new derived operation rather than silently overwriting history.

## Transport independence

The contract must work across HTTPS, LAN, Bluetooth, LoRa, Reticulum, satellite, USB/offline export, and future transports. No transport defines the canonical operation model.

Transport adapters may optimize framing, compression, batching, discovery, or delivery semantics, but they must preserve operation identity, integrity, authorization context, provenance, and expiry semantics.

## Capability lease interaction

A purpose-bound capability lease authorizes a bounded use of a capability. The operation queue may carry a reference to that lease, but the queue must never treat the reference alone as sufficient authority.

At execution or synchronization:

```text
Operation
 ↓
Lease / authorization lookup
 ↓
Current policy decision
 ↓
Allow → execute
Deny / expired → block or reauthorize
```

This keeps capability authorization separate from delivery mechanics.

## Offline and minimum-information rules

Offline support is asynchronous-first, delay-tolerant, retryable, resumable, and store-and-forward. Implementations should minimize bytes, energy, compute, storage, attention, privacy exposure, and operational complexity while retaining information necessary for archaeological provenance and reproducibility.

The principle is **Minimum Necessary Information**, not minimum information at any cost.

## Audit and provenance

Significant lifecycle transitions should be auditable, including authorization, enqueue, execution attempt, synchronization, rejection, conflict, completion, and release. Provenance must identify the originating operation and transformations sufficiently to reconstruct what happened, subject to privacy and retention policy.

## Non-goals

- Making a particular database, broker, queue, or transport canonical.
- Making offline operation mandatory for every feature.
- Treating a queue as a replacement for Core authorization or policy.
- Implementing silent conflict resolution as a universal default.
- Requiring a single programming language or vendor SDK.

## Relationship to other contracts

- `docs/contracts/RESILIENT-CAPABILITY-CONTRACT.md` defines the broader resilience and transport principles.
- `docs/contracts/RESEARCH-PROVIDER-CONTRACT.md` requires queued research operations to follow this lifecycle.
- The canonical authorization boundary remains the policy decision point for protected actions.
