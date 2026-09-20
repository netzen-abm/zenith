# Evidence Annotation Capability Contract

## Status

Accepted — first ZENITH vertical capability proving reuse of the shared execution kernel.

## Purpose

Evidence Annotation allows an authenticated researcher to attach a new evidence record to an authorized Core resource while preserving the source, epistemic status, sensitivity, identity, organisation, operation, and provenance boundaries.

It is a proving capability, not a second policy engine.

## Canonical flow

`Identity → Organisation Context → Core Authorization → Durable Request Payload → Operation → Reservation → Handler → Protected Evidence Mutation → Durable Outcome → Outbox`

## Boundaries

- **Core authorization** remains the canonical policy authority through `core.authorize_capability`.
- **Operation lifecycle** remains owned by `operations.transition` and `operations.reserve_execution`.
- **Request payload** is durable and referenced by `operations.operations.payload_ref`; protected payload fields are not copied into the operation audit/outbox.
- **Evidence mutation** is owned by `core.consume_evidence_annotation_request`.
- **Execution durability** remains owned by `operations.record_execution_outcome`.
- **Outbox** remains downstream delivery infrastructure, not authorization.

## Security invariants

1. Authorization is checked before the request payload or operation is created.
2. Execution reauthorizes immediately before reservation through the shared coordinator.
3. Request identity and organisation must match the active Core context.
4. The resource must remain writable at request creation and at evidence mutation.
5. The source must belong to the same organisation or be organisation-neutral.
6. The protected `core.evidence` table is not directly writable by the authenticated role.
7. Evidence creation and request consumption are atomic.
8. A consumed request cannot create a second evidence record.
9. `payload_ref` identifies durable request data; it is not an authorization grant.
10. No transport or UI surface may recreate these checks independently.

## Failure semantics

| Condition | Behavior |
|---|---|
| Initial authorization denied | No operation or request is created |
| Request creation fails | No executable operation is created |
| Reservation denied | Handler does not run |
| Request no longer writable | Handler returns rejected outcome |
| Source scope mismatch | Handler returns rejected outcome |
| Duplicate/consumed request | Handler returns rejected outcome |
| Evidence created | Handler returns acknowledged with evidence reference |
| Durable outcome fails | Coordinator does not report successful execution |

## Evolution rule

Any new evidence mutation, alternate operation path, or authorization implementation must consume these boundaries or introduce an ADR and corresponding positive/negative conformance tests.
