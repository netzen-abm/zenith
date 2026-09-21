# ZENITH Architecture Governance v1

## 1. Purpose

This document governs architectural evolution of ZENITH and prevents accidental coupling to a programming language, hardware vendor, cloud provider, AI provider, database product, or single license model.

## 2. Non-negotiable invariants

- Privacy by Design
- Safety by Design
- Secure by Default
- Epistemic safety
- Evidence and provenance continuity
- Hardware independence
- Vendor/provider portability
- Independent experience surfaces over shared capabilities
- No direct bypass of policy, authorization, audit, or public-safe projections

## 3. Language governance

| Language | Canonical role | Entry condition |
|---|---|---|
| TypeScript | Application, API, SDK, contracts, orchestration | Default |
| Rust | Systems, performance, security-sensitive, parsers, WASM/edge | ADR demonstrating benefit |
| Python | AI/ML, OCR/HTR, CV, statistics, scientific computing | Functional boundary |
| SQL | Data integrity, relational logic, PostGIS | Data boundary |
| Elixir | Concurrency/distributed/event workloads | ADR demonstrating concrete need |

A new language requires an ADR covering capability fit, operational cost, security, hiring/maintenance impact, interoperability, and exit strategy.

## 4. Hardware independence

Canonical flow:

`Device → Adapter → Capability Contract → Observation/Measurement → Evidence → Provenance → Core`

The Core must not depend on manufacturer SDKs or device-specific schemas. Anticipated devices include GNSS/GPS, total stations, LiDAR, UAVs, photogrammetry cameras, scanners, microscopes, multispectral/hyperspectral systems, environmental sensors, magnetometers, GPR, mobile/field devices, XR and laboratory instruments.

## 5. Provider portability

No essential capability may require a single cloud, AI model/provider, storage provider, database vendor, mapping provider, identity provider, or external repository. Provider-specific functionality must enter through an adapter/capability boundary wherever practical.

## 6. Trust and safety control plane

Sensitive heritage locations, human remains, vulnerable community knowledge, restricted collections, consent-bound interviews, personal data, and security-sensitive information require policy-aware access. Public projections must be deliberately safer than researcher/institutional views.

The system may refuse, generalize, redact, delay, or require authorization for information where disclosure creates foreseeable harm, including looting, illegal excavation, trafficking, vandalism, trespass, or cultural harm.

## 7. AI governance

AI receives minimum necessary authorized context. Outputs must preserve provenance and epistemic status and distinguish documented fact, observation, derivation, interpretation, hypothesis, tradition/oral knowledge, contested claims, and unknowns. AI must never silently promote uncertainty into fact.

## 8. Licensing governance

License selection follows the layer rather than applying one license to the entire ecosystem. See `docs/LICENSING.md`. Data and cultural materials require rights/provenance-aware treatment independent of software licensing.

## 9. Architecture decision gate

Any material change involving a new language, hardware dependency, external provider, database technology, AI provider/model, data-rights regime, public exposure of sensitive information, or license requires an ADR before implementation.

## 10. Implementation rule

Feature work must consume the shared capability contracts. New surfaces must not recreate Core primitives. New domain modules must extend the canonical model rather than fork it.

## 11. Repository and branch governance

ZENITH maintains a strict active-development branch budget of nine. The budget represents real concurrent workstreams, not placeholder branches.

The lifecycle is:

`create → develop → prove → review → merge → delete`

A branch must have a current, evidenced purpose. Historical, superseded, duplicate, or already-integrated branches must not be retained as active development lines.

Branch retirement rules:

1. Merge only work that is unique, validated, and not already represented in `main`.
2. Delete branches whose work is already represented, superseded, abandoned, or merged.
3. Never force-update a branch to `main` as a substitute for deletion.
4. Never create placeholder branches solely to satisfy the nine-branch budget.
5. A completed branch releases its slot immediately after merge and verification.
6. Repository state must be verified from the remote branch inventory; local assumptions are insufficient.

The target steady state is exactly nine genuine active branches. When fewer than nine genuine workstreams exist, no artificial branches are created.

## 12. Shared infrastructure boundary

Cross-cutting platform concerns are canonical shared infrastructure:

`Identity → Authorization → Tenant/RLS → Capability Contract → Operation → Reservation → Handler → Durable Outcome → Outbox`

Domain capabilities consume these contracts. They must not create competing authorization, tenant-isolation, operation-lifecycle, idempotency, reservation, audit, or protected-mutation mechanisms.

A new shared primitive requires evidence that an existing contract cannot satisfy the capability, followed by an ADR, implementation, positive tests, negative tests, and conformance coverage.

The execution kernel is treated as frozen infrastructure unless a concrete capability demonstrates a missing invariant or boundary.

## 13. Capability conformance gate

Every new domain capability must demonstrate:

- canonical authorization before protected work;
- database-enforced tenant/resource isolation;
- durable operation identity;
- execution reservation before handler entry;
- authoritative attempt propagation;
- exactly-once admission under concurrency;
- durable outcome recording;
- protected mutation through the canonical boundary;
- provenance/evidence continuity where applicable;
- no alternate security or lifecycle path.

A capability that bypasses a canonical boundary is non-conformant even if its functional tests pass.

