# API and SDK Workstream

## Objective
Expose stable capability contracts to internal and external consumers without leaking database internals or security-sensitive implementation details.

## Scope
- versioned capability contracts
- typed request/response envelopes
- operation identity
- idempotency semantics
- error taxonomy
- pagination and cursors
- provenance references
- SDK portability

## Boundary
API consumers invoke capabilities; they do not write protected lifecycle, outcome or outbox tables directly.

## Acceptance gate
Contract tests prove API behavior against the same canonical authorization and execution kernel used by native surfaces.
