# Execution Coordinator Contract

## Purpose

The Execution Coordinator is the single runtime composition boundary for operations that can execute locally, remotely, online, or after offline synchronization.

It does not replace authorization, capability leases, operation contracts, transport adapters, or domain handlers. It composes them.

## Canonical pipeline

1. Validate operation shape and lifecycle state.
2. Validate the capability lease: operation, capability, purpose, expiry, and revocation.
3. Reauthorize the requested action against current policy.
4. Resolve idempotency before invoking the domain handler.
5. Execute the domain operation through an injected handler.
6. Record the execution result and audit/provenance outcome.
7. Transition the operation state deterministically.
8. Release the capability lease when its purpose is complete.

For synchronized/offline work, step 3 is mandatory at the receiving execution boundary.

## Required inputs

The coordinator receives:

- immutable operation identity and idempotency key;
- capability/action;
- optional resource;
- identity and organisation context;
- purpose;
- lease reference;
- payload reference/content hash;
- classification and epistemic/provenance metadata;
- an execution handler;
- authorization and lease validators;
- an idempotency store;
- audit/provenance sink.

## Security invariants

- No execution without current authorization.
- A valid lease does not override current policy.
- An expired or revoked lease cannot be revived by retry.
- A lease for one operation/capability/purpose cannot authorize another.
- Unknown actions fail closed.
- Idempotency is checked before side effects.
- A duplicate delivery must not create a second domain side effect.
- Payload integrity is verified before execution when a content hash is supplied.
- Sensitive metadata is not copied into transport or queue records unless required.
- Audit records must not become a covert protected-data disclosure path.
- Release is idempotent and must not broaden authority.
- Authorization is re-evaluated after disconnection; offline authorization is not perpetual.

## Failure classes

`authorization_denied`, `lease_invalid`, `lease_expired`, `lease_revoked`, `operation_invalid`, `operation_expired`, `duplicate`, `payload_integrity_failure`, `conflict`, `retryable`, `non_retryable`, `handler_failure`, `audit_failure`, `release_failure`.

Security-sensitive failures fail closed. A transient infrastructure failure must not be converted into an authorization allow.

## State transitions

The coordinator may request only contract-valid transitions:

`created → authorized → queued → in_flight → acknowledged | retry_wait | blocked | conflict | expired | rejected | completed | cancelled`

A retry may return an operation from `retry_wait` to `queued` only when the operation remains valid and current authorization succeeds.

## Adapter boundary

Transports and domain adapters are not authorization authorities.

`Transport → Coordinator → Domain Handler`

not

`Transport → Authorization → Domain Handler`

and not

`Transport → Domain Handler`

Provider-specific or device-specific credentials remain inside their adapter. They do not become ZENITH canonical identity or authorization semantics.

## Test contract

Minimum tests:

- deny unauthenticated execution;
- deny unknown action;
- deny invalid/expired/revoked lease;
- deny valid lease when current policy denies;
- allow only when both lease and current authorization allow;
- detect duplicate idempotency key before side effects;
- reject integrity mismatch;
- reject stale operation expiry;
- reauthorize after offline synchronization;
- prevent retry from reviving expired authority;
- preserve operation/provenance identifiers;
- make release idempotent;
- ensure handler cannot bypass coordinator in the supported runtime composition.

## Non-goals

This contract does not define:

- a queue implementation;
- a transport protocol;
- a particular database;
- a particular AI provider;
- a particular hardware SDK;
- distributed locking implementation;
- domain-specific conflict resolution.

Those remain replaceable implementations behind the contract.