# Multisurface Adapter Workstream

## Objective
Make Web, mobile, field, museum, AI and API surfaces independently deployable consumers of shared infrastructure.

## Contract
A surface owns presentation, device integration and local experience. It does not own canonical authorization, tenant isolation, lifecycle, reservation or protected-data mutation policy.

## Failure isolation
Failure of one surface must not imply failure of another surface when both consume durable shared infrastructure.

## Acceptance gate
Adapters are thin, capability-oriented and replaceable. Shared trust invariants remain enforced below the surface layer.
