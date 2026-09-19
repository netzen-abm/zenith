# ZENITH

**Past & Heritage Intelligence Infrastructure**

ZENITH is a shared interdisciplinary infrastructure for discovering, researching, connecting, and understanding the human past.

## Architectural principle

> One ecosystem. One shared infrastructure. Many independent surfaces. Multiple languages where functionally justified. Hardware-independent core. Vendor-portable architecture. Layered licensing. Privacy, safety, and security by design and by default.

## Core

**ZENITH Core** provides the shared foundation for:

- Evidence and provenance
- Knowledge graph
- Space and time
- Research workflows
- Search and discovery
- Annotation
- Identity and organisations
- AI gateway
- Federation and interoperability
- Audit and policy

## Initial surfaces

- Explore
- Research
- Field
- Museum
- Learn
- Community
- AI
- API

## Trust invariants

ZENITH treats the following as architectural invariants:

1. Privacy by Design
2. Safety by Design
3. Secure by Default
4. Epistemic safety
5. Hardware independence
6. Vendor and provider portability

AI must preserve provenance and epistemic status and may receive only the minimum authorized context required for a task.

## Programming-language policy

ZENITH is deliberately polyglot, but not language-heavy.

- **TypeScript** — default for application, API, SDK, contracts and orchestration
- **SQL/PostgreSQL/PostGIS** — canonical data integrity, RLS, authorization predicates and transactional boundaries
- **Rust** — approved specialist language for memory-safe parsers, high-performance processing, device/edge components, WASM and security-sensitive native boundaries; introduced only when a concrete requirement justifies it
- **Python** — AI/ML, OCR/HTR, computer vision, statistics and scientific/research workloads
- **Shell** — CI and repository/database tooling
- **Kotlin / Swift** — conditional native mobile implementation only when platform-specific capability requires it
- **Elixir** — deferred; only with an ADR demonstrating a concrete concurrency/distribution requirement not well served by the existing stack

**Current implementation:** TypeScript + SQL + Python + Shell. Rust is approved but intentionally not added until the first concrete Rust-worthy workload appears.

See `docs/architecture/PROGRAMMING-LANGUAGE-ARCHITECTURE.md` for the complete language-selection and repository-structure policy.

## Repository structure

```text
zenith/
├── apps/
├── core/
├── services/
├── domains/
├── adapters/
├── ai/
├── packages/
├── data/
├── docs/
├── tests/
├── infra/
└── scripts/
```

## Licensing

ZENITH uses a layered licensing strategy. Apache-2.0 is the default for appropriate open-core libraries and interoperability tooling. AGPL-3.0 may be applied selectively to appropriate network-facing collaborative server components. Commercial enterprise and hosted capabilities may be proprietary under commercial terms/EULA. Data, research materials, models, hardware designs, documentation, and trademarks are governed separately according to their rights and provenance.

## Canonical architecture and imported history

The repository now contains a consolidated archival layer under `docs/archive/`. It preserves the architecture, ontology, federation, security, UX, gate, implementation and research decisions produced before the repository bootstrap, including source-derived material from the supplied Word/PPTX/Excel packages and the portable Past Intelligence Core security/gate artifacts.

**Rule:** archived/source-derived artifacts are retained for traceability. They do not silently override the current canonical ZENITH contracts. Any substantive change must be reviewed and, where architectural, captured in an ADR.

Key references:
- `docs/archive/ARTIFACT-REGISTER.md`
- `docs/archive/MASTER-ARCHITECTURE-BLUEPRINT.md`
- `docs/archive/IMPLEMENTATION-CONTRACT-FREEZE.md`
- `docs/archive/ARCHITECTURE-GATE-TEST-SPECIFICATION.md`
- `docs/archive/ONTOLOGY-AND-FEDERATION-BASELINE.md`
- `docs/archive/SECURITY-FEDERATION-AND-UX-BASELINE.md`
- `docs/research/PATTANAM-KEEZHADI-RESEARCH-BASELINE.md`
- `core/database/migrations/0001_security_kernel.sql`
- `tests/reference_gate_harness/`

## Naming note

ZENITH remains the working-selected ecosystem identity, but the bare name is not treated as legally exclusive or cleared. Namespace/domain/package/trademark due diligence remains a governance item before legal lock.

## Status

Architecture and implementation contracts are frozen for controlled application implementation. The initial repository scaffold and historical architecture corpus are now established. Runtime implementation and final production gate evidence remain future work.

See `docs/ARCHITECTURE-GOVERNANCE.md` and `docs/LICENSING.md`.
