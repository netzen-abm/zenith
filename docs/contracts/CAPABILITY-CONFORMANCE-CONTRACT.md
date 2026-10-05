# Capability Conformance Contract

**Status:** Adopted baseline  
**Date:** 2026-10-05

## Purpose

The capability layer is the reusable domain boundary of ZENITH. Protected capabilities must consume the shared execution infrastructure rather than recreate authorization, reservation, lifecycle, or durable-outcome behavior.

This contract complements `docs/SHAREABLE-INFRASTRUCTURE-ARCHITECTURE.md` and `tests/architecture/capability-boundary.sh`.

## Canonical protected path

`Identity → Authorization → Tenant/RLS → Capability Contract → Operation → Reservation → Handler → Durable Outcome → Outbox → Provenance`

The execution kernel remains cohesive because authorization, reservation, handler entry and durable outcome are one protected lifecycle with shared invariants.

## Structural conformance gate

Every protected capability entrypoint that exposes an executable `Capability` or `Operation` class must:

1. depend on `ExecutionAuthorization`;
2. depend on `ExecutionReservation`;
3. depend on `ExecutionOutcomeRecorder`;
4. construct and use `ExecutionCoordinator`;
5. route execution through the coordinator;
6. keep domain handler logic behind the coordinator;
7. honor the coordinator's execution decision;
8. avoid direct provider/persistence implementation imports.

The gate is intentionally structural. It is not a line-count rule and does not prescribe arbitrary class decomposition.

## What the static gate does not prove

Static conformance cannot prove database transactionality, RLS isolation, authorization correctness, concurrency behavior, provenance completeness, or provider failure semantics. Those remain the responsibility of the existing PostgreSQL, security, concurrency, provenance and integration test gates.

## Responsibility split rule

Split a capability or execution component only when the split establishes an independent boundary of change, trust, persistence, provider/device dependency, or independent reuse.

Keep responsibilities together when splitting would weaken invariants, duplicate orchestration, create competing lifecycle logic, introduce another authorization authority, or fragment one atomic transaction.

File/class size is a review signal only.

## Definition of done

A new protected capability is ecosystem-ready only when:

- capability conformance passes;
- capability-boundary checks pass;
- positive and negative authorization tests exist;
- tenant/RLS behavior is covered;
- reservation/concurrency behavior is covered where applicable;
- durable outcome behavior is covered;
- provenance behavior is covered when the capability creates or transforms evidence;
- provider/device implementations remain behind adapters;
- fresh-database reconciliation remains green.

Core execution-kernel changes additionally require an ADR and corresponding invariant tests.
