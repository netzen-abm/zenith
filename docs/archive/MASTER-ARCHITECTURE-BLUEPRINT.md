# ZENITH — Master Architecture Blueprint v1.0

## Status
Pre-code architecture baseline. Production application code was intentionally at zero in the source artifact.

## Executive decision
Build a full Past & Heritage Intelligence Ecosystem rather than a standalone archaeology application or disconnected discipline-specific applications. The permanent strategic asset is the shared Past Intelligence Core.

## Foundational rule
**One infrastructure. Many disciplines. Many institutions. Many independent surfaces. One evidence/provenance model. One spatial-temporal foundation.**

## Core
The Past Intelligence Core provides:
- Evidence and provenance
- Knowledge graph
- Spatial and temporal foundation
- Research workflows
- Search/discovery
- Annotation
- Identity and organisation context
- AI capability boundary
- Federation
- Audit and policy

## Experience surfaces
Experience surfaces are independent clients of the shared infrastructure. Initial surfaces include Explore, Research, Field, Museum, Learn, Community, AI and API/developer interfaces. No surface may recreate canonical authorization, evidence, provenance, epistemic or domain logic.

## Canonical epistemic chain
`Source → Evidence → Observation/Measurement → Claim → Interpretation → Hypothesis → Counter-evidence → Confidence/Epistemic Status → Open Question`

## Epistemic statuses
- observed
- documented
- derived
- interpreted
- hypothesized
- traditional_oral
- contested_disputed
- unknown

## Policy/control plane
`Identity → Organisation → Resource → Action → Context → Policy → Obligation → Audit`

Authentication is not authorization. Organisation membership is not blanket permission. Sensitive heritage precision is policy-controlled.

## Hardware independence
`Device → Adapter → Capability Contract → Observation/Measurement → Evidence → Provenance → Core`

Canonical data must not depend on vendor SDK or device representation.

## Interoperability
The architecture is CIDOC CRM-aligned and designed to interoperate with heritage repositories, IIIF, archaeological publishers, museum systems and other authoritative external systems through explicit federation adapters and provenance-preserving mappings.

## First proving vertical
Pattanam/Muziris is the first proving vertical because it exercises archaeology, maritime history, spatial-temporal modelling, evidence/provenance, federation and interdisciplinary research.

## Implementation posture
Start as a modular monolith/shared-core foundation with explicit capability boundaries and federation adapters. Do not begin by splitting the ecosystem into microservices merely for organizational fashion.

## Architecture gate
The source architecture gate reached a conditional implementation-ready state: architecture contracts were mature, but runtime controls could not be marked PASS until real authorization, database, federation, AI, audit and benchmark infrastructure existed.
