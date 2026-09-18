# ADR 0011 — Atomic Operation Store Boundary

**Status:** Proposed
**Date:** 2026-09-18

## Context

The Execution Coordinator currently separates duplicate detection from reservation. Concurrent workers can race if those operations are implemented as independent reads and writes.

## Decision

Define an atomic Operation Store boundary before choosing persistent infrastructure.

The canonical primitive is an atomic reservation scoped by idempotency key. Lifecycle state changes use compare-and-set or equivalent atomic semantics.

The store persists operation lifecycle state but does not make authorization decisions.

## Important limitation

An operation store cannot provide exactly-once effects for arbitrary external side effects. External handlers must provide their own idempotency or transactional integration when that guarantee is required.

## Consequences

- concurrent delivery can converge on one execution reservation;
- queue implementations remain replaceable;
- local/offline stores can satisfy the same contract;
- authorization remains centralized;
- persistent state can be introduced without coupling the Core to a specific broker.

## Rejected shortcut

An `isDuplicate()` followed by `markStarted()` pair is insufficient because the check and reservation can race. The runtime must use one atomic storage boundary.