# ADR 0002 — Language-Neutral Implementation Strategy

- Status: Accepted
- Scope: ZENITH ecosystem implementation

## Decision

ZENITH does not adopt a single programming language as an architectural dependency. A language is selected according to the capability, operational constraints, security properties, ecosystem maturity, and interoperability requirements of that bounded area.

The canonical domain model, capability contracts, evidence/provenance model, authorization semantics, and interoperability boundaries MUST remain language-neutral.

## Current allocation guidance

- TypeScript: application/API/SDK implementations where its ecosystem and typing are advantageous.
- Rust: systems, security-sensitive, performance-critical, parsing, native and WASM boundaries where justified.
- Python: AI/ML, computer vision, OCR/HTR, statistics, scientific and research workloads where justified.
- PostgreSQL/PostGIS/SQL: authoritative relational and spatial data layer.
- Elixir: distributed/realtime workloads only when an ADR demonstrates a concrete requirement and acceptable operational cost.
- Other languages: permitted when a bounded capability has a demonstrated technical reason to use them.

## Rules

1. No language-specific implementation may become the canonical semantic model.
2. Cross-language communication MUST use explicit, versioned contracts.
3. Vendor and hardware SDKs MUST remain behind adapters.
4. Replacing an implementation language MUST NOT require redesigning the domain ontology or security model.
5. Every additional language requires an ADR covering capability fit, security, operations, maintenance, interoperability, and exit strategy.
6. Shared infrastructure must prefer stable protocol/data contracts over language-specific coupling.

## Consequence

The ZENITH repository may contain multiple language ecosystems. Repository structure, CI, dependency management, security review, and developer documentation must therefore be capability-oriented rather than organized around one language's dominance.
