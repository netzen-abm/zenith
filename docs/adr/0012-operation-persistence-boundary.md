# ADR 0012 — Operation Persistence Boundary

**Status:** Proposed
**Date:** 2026-09-18

## Decision

Persistent operation lifecycle records should live in a dedicated `operations` schema rather than in the archaeological `core` domain schema.

The operation record carries explicit organisation and initiating identity context, lifecycle state, idempotency information, expiry, capability lease reference, and minimal provenance/integrity references.

`audit.events` remains the audit sink.

## Why a separate schema

Operations are shared execution infrastructure. Keeping them separate prevents queue lifecycle concerns from contaminating archaeological resource models while still permitting explicit foreign-key relationships to Core identity and organisation primitives.

## Database semantics

The PostgreSQL implementation must provide:

- atomic idempotency reservation;
- tenant-aware RLS;
- explicit organisation context;
- transactional or compare-and-set state transitions;
- terminal-state protection;
- authoritative expiry checks;
- minimal sensitive-data storage.

## Authorization boundary

RLS protects operation rows, but the operation store does not decide whether an action is permitted. The Execution Coordinator remains responsible for current authorization and capability-lease validation.

## Offline boundary

Local stores are permitted. Synchronization must enter through the same canonical operation contract and repeat integrity, expiry, lease, authorization, and idempotency checks.

## Consequence

Supabase/PostgreSQL is the first persistence adapter to evaluate, but the operation contract remains database-neutral and portable to embedded/local stores.