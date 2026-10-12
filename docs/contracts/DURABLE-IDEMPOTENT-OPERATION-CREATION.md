# Durable Idempotent Operation Creation Contract

## Purpose
Repeated delivery of one logical request must resolve to one persisted operation identity before execution reservation. Reservation by operation ID alone cannot deduplicate requests that accidentally create new IDs.

## API
`operations.create_or_get(...)` atomically creates or resolves an operation by `(organisation_id, idempotency_key)`.

- The first request creates a `created` operation with attempt count zero.
- A repeated request with matching immutable identity returns the canonical existing operation and a `created=false` result.
- Reusing a key with a different action, identity, purpose, or payload reference fails closed with `operation_idempotency_conflict`.
- A tenant-scoped advisory transaction lock serializes concurrent attempts for the same key, including the no-row-yet case.
- The function requires the current tenant and identity context and has no authority to authorize or execute the operation.

## Required order
1. Validate the domain request.
2. Persist/resolve the idempotent operation identity.
3. Persist or retrieve the minimal domain payload under an immutable query identity.
4. Apply canonical Core authorization.
5. Reserve the canonical operation ID.
6. Invoke the handler only after successful reservation.
7. Record the outcome atomically with lifecycle and outbox.

## Safety
- Never generate a new operation identity merely because a caller retried the same idempotency key.
- Never treat a create-or-get result as authorization.
- Storage errors, identity mismatch, or immutable-request mismatch fail closed.
- Do not retry an ambiguous provider side effect unless provider idempotency or outcome lookup proves the retry safe.
- Cross-store atomicity between domain payload and operation record is not implied; the caller must handle a missing payload explicitly without invoking the provider.

## Non-goals
No provider SDK, generic recovery service, exactly-once external side-effect guarantee, or second authorization authority.
