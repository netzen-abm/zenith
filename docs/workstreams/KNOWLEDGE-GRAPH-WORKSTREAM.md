# Knowledge Graph Workstream

## Objective
Build the archaeology knowledge graph as a capability over the shared ZENITH execution kernel.

## Scope
- canonical entities and relationships
- identity resolution for sites, artefacts, people, places, periods and sources
- provenance links from graph assertions to evidence
- temporal and spatial qualifiers
- uncertainty and epistemic status
- import/export and federation boundaries

## Non-goals
This workstream does not create a second authorization, tenant, operation, reservation, lifecycle, or audit system.

## Acceptance gate
Every graph mutation must use the canonical capability and execution contracts, preserve provenance, enforce tenant/RLS policy, and remain independently consumable by Explore, Research, Field and API surfaces.
