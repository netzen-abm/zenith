# ADR 0009: Execution Lease and Reconciliation Boundary

- Status: Proposed
- Date: 2026-09-18

## Decision

An operation may be queued with a capability lease, but queued authorization is not sufficient for execution. The execution boundary validates the lease against operation identity, capability, purpose, revocation, and expiry.

Offline or deferred synchronization must also verify payload integrity. Hash mismatch is an explicit conflict and is never silently resolved by last-write-wins.

## Execution contract

`Operation → Lease Validation → Current Authorization → Execute → Audit → Release`

A lease cannot be renewed implicitly by retry.

## Reconciliation contract

`Local Operation → Integrity Check → Authorization Recheck → Apply | Conflict | Reject | Reauthorize`

The receiving side is authoritative for current policy. An offline lease is context, not permanent authority.

## Deliberate non-goals

This contract does not define domain-specific merge algorithms, distributed consensus, database transactions, or a queue broker. Domain conflict resolution remains domain-aware and explicit.
