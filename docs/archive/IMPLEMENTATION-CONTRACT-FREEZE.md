# ZENITH — Implementation Contract Freeze v1.0

## Purpose
Freeze the minimum shared contracts required before production schema creation and application coding.

## Canonical boundaries
- Transactional system of record: PostgreSQL + PostGIS.
- Semantic interoperability: CIDOC CRM-aligned application profile.
- Evidence model: Source → Evidence → Observation/Measurement → Claim → Interpretation → Hypothesis → Counter-evidence → Epistemic status.
- Policy boundary: Identity → Organisation → Resource → Action → Context → Policy → Obligation → Audit.
- Federation: source registry → external identifier → mapping → rights/provenance → synchronization/conflict/withdrawal handling.
- Experience: independent surfaces consuming shared capability contracts.

## Non-negotiable rules
1. No client bypass of authorization or policy.
2. Authentication never substitutes for authorization.
3. Provenance and epistemic status survive every transformation.
4. Sensitive heritage precision is an explicit policy decision, not a UI choice.
5. AI is a capability, not the system of record.
6. Hardware/vendor representation does not leak into canonical data contracts.
7. Domain extensions are additive and versioned.
8. Federation preserves external authority and identifiers.
9. Auditability is required for protected operations.
10. Runtime gate claims require executable evidence, not documentation alone.

## Initial capability families
- Explore/discovery
- Research
- Field capture
- Museum/collection
- Learning
- Community
- AI-assisted research
- Developer/API

## Contract freeze posture
The freeze is a boundary contract, not a prohibition on future evolution. New capabilities require explicit versioning and, where architecture changes, an ADR.
