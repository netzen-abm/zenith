# Operation Persistence / Supabase Boundary Audit — 2026-09-18

## Scope

Audit the live Past Intelligence Core before adding persistent operation state. The objective is to determine placement, tenancy, RLS, atomic idempotency, retention, and offline synchronization boundaries without changing the live database.

## Live database observations

- `core.organisations`, `core.identities`, `core.resources`, and `core.resource_memberships` exist and have RLS enabled.
- The explicit identity-to-organisation context is represented by the organisation-membership contract in the repository.
- `audit.events` exists with RLS enabled.
- Existing domain tables in `core` are consistently RLS-enabled; current policies are predominantly authenticated read policies, with a separate anonymous public resource read path.
- The live migration history currently ends at the canonical capability policy boundary migration; no operation-store migration exists.
- Live Core currently has no operation persistence tables.
- The live Core has no seeded identities/resources in the previously verified environment, so authenticated runtime behavior is not claimed here.

## Placement decision

Operation lifecycle is cross-domain infrastructure, not archaeological domain data. It should not be added to `core.resources` or embedded in domain tables.

Recommended placement: a dedicated `operations` schema for lifecycle records and execution coordination metadata, with explicit foreign keys to `core.organisations` and `core.identities` where appropriate.

`audit.events` remains the audit sink. Operation records should reference audit/provenance context rather than duplicating arbitrary protected payloads.

## Tenant and identity semantics

Each tenant-owned operation carries an explicit `organisation_id`. An optional `identity_id` records the initiating ZENITH identity.

Organisation context must be explicit; operation records must never infer an organisation from resource creation order or incidental memberships.

System-level operations may use a documented null organisation only when their authorization contract explicitly permits it. Null must not become a shortcut around tenant isolation.

## Atomic idempotency

Use a database-enforced unique constraint over the declared idempotency scope and key. The reservation operation must be atomic.

Preferred logical key:

`(organisation_id, idempotency_key)`

Global/system operations require an explicit separate scope rather than overloading tenant semantics.

Do not implement `SELECT` then `INSERT` as the correctness mechanism.

## RLS and authorization

Operation RLS must restrict tenant-owned rows to the active organisation context and applicable identity policy.

The operation store must not become an authorization authority. Execution still requires the canonical authorization boundary plus capability lease validation.

Database service-role access, if ever used by a trusted execution worker, must be isolated from end-user authorization and must not be exposed to clients.

## State integrity

Persist lifecycle state with an explicit transition mechanism. Terminal states must not be resurrected.

State updates should use optimistic compare-and-set semantics or a transactionally equivalent mechanism.

Attempt count, expiry, and lease reference belong to the operation lifecycle record.

## Offline synchronization

Offline queues may use local persistence, but synchronization must converge into the same canonical operation model.

The receiving side must:

1. verify operation/payload integrity;
2. verify operation expiry;
3. validate the lease;
4. reauthorize current policy;
5. perform atomic idempotency reservation;
6. execute or explicitly reconcile conflict.

An offline client must never be able to create authority merely by replaying a previously authorized operation.

## Retention and sensitive data

Operation metadata should be retained only as long as needed for execution, audit, reconciliation, legal obligations, or research reproducibility.

Sensitive archaeological payloads should normally remain in protected evidence/storage systems and be referenced by content hash/object reference rather than copied into queue rows.

Expiry of an operation does not imply deletion of evidentiary material; domain retention rules remain authoritative.

## Migration boundary

No live migration is applied by this audit.

Before migration, the repository must contain:

- migration SQL;
- fresh-DB reconciliation assertions;
- RLS tests;
- atomic idempotency tests;
- tenant-isolation tests;
- expiry/state-transition tests;
- authorization recheck tests;
- retention/classification assertions.

## Architectural conclusion

Supabase/PostgreSQL is compatible with the operation-store contract because it can provide transactional uniqueness, row-level security, compare-and-set style updates, and durable state.

However, the canonical ZENITH contract must remain database-neutral. A local/offline implementation must be able to satisfy the same semantics.

Therefore: define the schema contract first, implement the PostgreSQL adapter second, and introduce queue/transport adapters only after the persistence contract is verified.

## Decision gate

Next implementation should be a dedicated operation schema migration plus fresh-DB/RLS/idempotency tests. Do not modify existing `core` authorization helpers unless the tests expose a concrete integration defect.