# ZENITH — Ontology & Federation Baseline

## Ontology principle
The canonical model is a shared interdisciplinary foundation. Discipline-specific concepts are additive extensions rather than separate application silos.

## Core semantic concerns
- People and organisations
- Places and spatial entities
- Time periods and temporal intervals
- Sites and archaeological contexts
- Objects/materials/collections
- Sources and documents
- Evidence and observations/measurements
- Claims, interpretations and hypotheses
- Research questions/projects/methods/runs/outputs
- Digital representations and media
- External identifiers and federated records
- Rights, consent and policy obligations

## Evidence semantics
Every important assertion should remain traceable to source/evidence and carry an explicit epistemic status. Conflicting evidence must remain representable; disagreement must not be flattened into a single authoritative fact merely for UX simplicity.

## Semantic interoperability
CIDOC CRM is the semantic foundation/application-profile direction. Scientific observation/measurement extensions may use the appropriate CRM scientific modelling. IIIF is the preferred interoperability boundary for image/manuscript/inscription/compound digital objects where applicable.

## Federation contract
Federated data must preserve:
- external source authority
- external identifier
- mapping/provenance
- rights and access constraints
- synchronization state
- conflict status
- withdrawal/deprecation information

ZENITH should integrate/federate with existing heritage infrastructures rather than recreate generic repository or heritage-management functions without a clear capability gap.

## Candidate ecosystem integrations
The prior architecture work identified Arches, Open Context, tDAR, BharatSHRI, Gyan Bharatam, NMMA, Museums of India/JATAN and Kerala/Muziris/Pattanam resources as relevant integration/reference systems. Each external integration requires current schema/API/rights verification before implementation.
