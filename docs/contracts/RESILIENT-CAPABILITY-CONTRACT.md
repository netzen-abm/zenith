# ZENITH Resilient Capability Contract

## Purpose

This contract defines the minimum behavior required for a ZENITH capability that supports intermittent, constrained, or offline operation.

It is a shared infrastructure contract, not an implementation of a specific transport.

## Lifecycle

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
Persist Locally / Queue
  ↓
Synchronize Opportunistically
  ↓
Verify / Reconcile
  ↓
Release
```

## Required invariants

### R-001 — Explicit operation identity

Every retryable queued operation has a stable operation identifier or idempotency key.

### R-002 — No duplicate side effects

Retrying or replaying an operation must not create unintended duplicate effects.

### R-003 — Authorization is bounded

Every protected operation is associated with an applicable purpose and capability authorization/lease. Offline persistence does not extend that authorization.

### R-004 — Expiry is enforced

An expired or revoked capability lease cannot authorize a new protected action or synchronization-side effect.

### R-005 — Synchronization re-checks policy

The receiving/executing side evaluates current authorization and policy rather than trusting an old offline decision indefinitely.

### R-006 — Provenance survives transport

Queued and synchronized material retains required source, evidence, observation/measurement, provenance, timestamps, authorship/device context, epistemic status, and uncertainty.

### R-007 — Sensitive data remains protected offline

Local queues, caches, exports, and temporary files remain subject to data classification, authorization, retention, and sensitive-heritage policy.

### R-008 — Interrupted transfer is recoverable

Where a capability declares resumability, interruption must permit verified continuation from a checkpoint or equivalent progress marker.

### R-009 — Integrity is verifiable

Where hashes or content addressing are used, received content must be verified before it is accepted as complete.

### R-010 — Conflicts are explicit

Concurrent or incompatible changes must enter a defined reconciliation path. Generic transport code must not silently overwrite domain data.

### R-011 — Transport neutrality

The capability contract cannot require a particular network provider or transport implementation.

### R-012 — Minimum Necessary Information

The capability sends only information necessary for the operation and its verification. Compression or compact encoding must never remove materially necessary provenance or archaeological context.

### R-013 — Silence by default

The implementation should avoid unnecessary polling, heartbeat traffic, background synchronization, telemetry, or AI calls when no operation requires them.

### R-014 — Release after purpose

When the authorized purpose completes, the ZENITH capability lease is released/revoked and active access is terminated. A later use requires a new authorization decision; OS-level permission semantics remain platform-specific.

## Capability declaration

A resilient capability should declare:

```text
capability_id
operation_type
purpose
required_scope
identity_context
organisation_context
authorization_reference
lease_expiry
offline_supported
queue_supported
retryable
idempotent
resumable
integrity_method
required_provenance
retention_policy
sensitivity_class
conflict_policy
transport_adapters
```

## Failure behavior

| Condition | Required behavior |
|---|---|
| No authorization | Deny; do not queue a protected action |
| Lease expired before execution | Re-authorize or fail closed |
| Lease revoked | Stop protected execution; retain only policy-permitted state |
| Network unavailable | Queue only if capability explicitly supports offline operation |
| Duplicate operation | Detect through operation identity/idempotency semantics |
| Partial transfer | Resume if declared resumable; otherwise restart safely |
| Integrity failure | Reject/quarantine according to policy; do not accept as verified |
| Authorization changed during sync | Re-evaluate and pause/deny as required |
| Concurrent incompatible update | Enter explicit reconciliation path |
| Sensitive export requested | Apply classification and policy before release |

## Transport adapter boundary

```text
ZENITH Capability
      ↓
Resilient Capability Contract
      ↓
Transport Adapter
      ↓
Internet / LAN / Bluetooth / Field Link / Reticulum / Satellite / USB
```

The adapter transports operations; it does not define identity, authorization, provenance, epistemic semantics, or domain conflict policy.

## Reference operation states

```text
CREATED
  → AUTHORIZED
  → QUEUED
  → READY
  → TRANSFERRING
  → VERIFIED
  → RECONCILIATION_REQUIRED (if needed)
  → COMMITTED
  → RELEASED
```

Terminal failure states should preserve enough audit information to explain why the operation was denied, rejected, expired, revoked, or failed integrity/conflict checks, subject to applicable privacy and retention policy.

## Design rule

**Connectivity is an implementation condition, not a Core semantic dependency.**

A capability may use real-time connectivity when available, but its correctness must not depend on the network being continuously available unless the capability explicitly requires real-time interaction.
