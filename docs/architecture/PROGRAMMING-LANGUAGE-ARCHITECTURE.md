# ZENITH Programming Language & Repository Architecture v1

## Decision

ZENITH is **language-independent at the architecture boundary** and **language-selective at implementation boundaries**.

The repository must not be organized as a collection of language silos such as `typescript/`, `python/`, and `rust/`. It is organized by **capability, domain, and deployment boundary**, with each implementation language used where it has a concrete technical advantage.

The rule is:

> **Choose the language at the capability boundary, not the language first and the architecture second.**

## Canonical language portfolio

| Language | Status | Primary use | Do not use it for |
|---|---|---|---|
| TypeScript | Default | API/application orchestration, SDKs, web/desktop surfaces, capability contracts, control-plane services | CPU-heavy scientific workloads, low-level device/security primitives |
| SQL / PostgreSQL / PostGIS | Core | System of record, relational integrity, RLS, authorization predicates, spatial/temporal constraints, transactional state transitions | General application orchestration |
| Rust | Approved specialist | Security-sensitive parsers, binary formats, high-performance processing, device/edge adapters, cryptographic primitives where appropriate, WASM, memory-sensitive components | Ordinary CRUD/API code that TypeScript handles well |
| Python | Approved specialist | AI/ML, OCR/HTR, computer vision, statistics, scientific computing, research notebooks/pipelines | Core authorization, transactional lifecycle authority, ordinary API services |
| Shell | Tooling only | CI, migration/reconciliation harnesses, local orchestration | Production business logic |
| Kotlin | Conditional | Native Android surface only when native Android capability materially requires it | Shared backend/control-plane logic |
| Swift | Conditional | Native Apple surface only when native platform capability materially requires it | Shared backend/control-plane logic |
| Elixir | Deferred | Only a demonstrated high-concurrency/event-processing requirement that cannot be met cleanly by existing services | General-purpose application code |
| Other languages | Prohibited by default | Only through an ADR demonstrating a material capability gap | Convenience, novelty, or developer preference alone |

## Current ZENITH implementation

At the present repository maturity, only these implementation languages are justified:

1. **TypeScript**
   - contracts
   - operation queue/runtime
   - execution orchestration
   - future APIs/SDKs
   - application control-plane logic

2. **SQL/PostgreSQL/PostGIS**
   - canonical data model
   - RLS
   - Core authorization boundary
   - operation persistence
   - atomic lifecycle transitions
   - execution reservation
   - spatial integrity

3. **Python**
   - reference/test harness currently present
   - future AI/ML, OCR/HTR, computer vision and scientific research workloads

4. **Shell**
   - CI and database/concurrency test harnesses

**Rust is approved but is intentionally not added yet.** The current codebase does not contain a concrete low-level component whose requirements justify introducing Rust today. Adding an empty Rust crate would increase maintenance and CI complexity without delivering a capability.

The first likely justified Rust boundaries are:
- archaeology-specific binary/document parsers where memory safety and throughput matter;
- high-performance image/point-cloud/mesh processing;
- hardware/field-device adapters;
- WASM components for browser-side heavy processing;
- security-sensitive native components where a memory-safe systems implementation is materially preferable.

Each such component must be isolated behind a stable capability contract.

## Repository organization

The canonical repository structure is capability/domain oriented:

```text
zenith/
├── apps/                    # independent experience surfaces
│   ├── explore/
│   ├── research/
│   ├── field/
│   ├── museum/
│   ├── learn/
│   └── community/
│
├── core/                    # authoritative shared infrastructure
│   ├── database/            # PostgreSQL/PostGIS system of record
│   ├── identity/
│   ├── authorization/
│   ├── evidence/
│   ├── provenance/
│   ├── knowledge/
│   ├── spatial/
│   ├── temporal/
│   └── operations/
│
├── packages/                # language-neutral capability contracts + TS implementations
│   ├── contracts/
│   └── operation-queue/
│
├── services/                # independently deployable application services
│
├── domains/                 # archaeological/research domain modules
│   ├── archaeology/
│   ├── collections/
│   ├── fieldwork/
│   └── research/
│
├── adapters/                # provider/device/transport boundaries
│   ├── hardware/
│   ├── storage/
│   ├── identity/
│   ├── ai/
│   ├── mapping/
│   └── federation/
│
├── ai/                      # AI gateway and specialist pipelines
│
├── crates/                  # Rust components; created only when first Rust component is justified
│
├── python/                  # shared Python research/AI tooling only when it becomes substantial
│
├── data/                    # schemas, fixtures, controlled sample data; never secrets
│
├── tests/                   # cross-language/integration/security/reconciliation tests
│
├── infra/                   # deployment/runtime infrastructure
│
├── scripts/                 # repository tooling
│
└── docs/
```

### Important structural rule

Do **not** create:

```text
typescript/
python/
rust/
sql/
```

as top-level architectural silos.

Instead:

```text
capability/domain
      ↓
contract
      ↓
best-fit implementation language
      ↓
adapter/interface
```

This preserves the ecosystem architecture even when implementation languages differ.

## Language selection gates

### TypeScript → default

Use TypeScript when:
- the component is application/control-plane logic;
- it is API-facing;
- it implements a capability contract;
- it is ordinary orchestration;
- portability and developer velocity dominate.

### Rust → specialist

Use Rust only when at least one is materially true:
- memory safety is a major requirement;
- sustained CPU throughput matters;
- binary/native processing is required;
- a hardware/edge integration requires systems-level control;
- WASM is an important deployment target;
- a security-sensitive primitive benefits materially from Rust's memory-safety model.

A Rust component must expose a language-neutral contract rather than forcing the rest of ZENITH to depend on Rust.

### Python → scientific/AI boundary

Use Python when:
- the workload is ML/AI;
- OCR/HTR;
- computer vision;
- statistical analysis;
- scientific/research computing;
- experimental research pipelines.

Python must not become the canonical authorization or transaction-state authority.

### SQL → data authority

SQL owns:
- relational constraints;
- transactional invariants;
- RLS;
- canonical database authorization predicates;
- lifecycle CAS;
- atomic reservations;
- spatial integrity.

Application code must not duplicate these rules merely for convenience.

## Cross-language contract rule

A Rust/Python/TypeScript component may communicate through:

- HTTP/JSON
- typed event envelopes
- database contracts where explicitly justified
- protobuf/other IDL only when scale or compatibility requires it
- WASM interfaces where appropriate

The semantic contract belongs to ZENITH, not to the implementation language.

## Security rule

No language may create a parallel authorization authority.

Canonical path:

```text
Identity
  ↓
Organisation context
  ↓
Core authorization
  ↓
Capability
  ↓
Operation
  ↓
Persistent execution reservation
  ↓
Domain handler
  ↓
Audit / provenance / outcome
```

A Rust adapter, Python AI service, TypeScript API, or future native application must enter this path through the same capability boundary.

## Rust adoption roadmap

Rust should enter ZENITH in this order only when the workload is actually present:

1. **Parser/ingestion boundary** — binary and specialist archaeological formats.
2. **High-performance spatial/media processing** — point clouds, meshes, large image operations.
3. **Field/device adapter boundary** — where native hardware integration requires it.
4. **WASM acceleration** — only for a demonstrated browser-side performance bottleneck.
5. **Security-sensitive native components** — only where a concrete threat model justifies the additional implementation boundary.

Do not implement all five pre-emptively.

## Language retirement rule

A language can be removed if:
- its only component is no longer needed;
- another approved language can replace it without loss of required capability;
- its operational/maintenance cost exceeds its benefit;
- it creates architectural duplication.

Removing a language is preferable to keeping a language merely because it was previously introduced.

## ADR requirement

Any introduction of Rust, Python beyond the established AI/research boundary, Kotlin, Swift, Elixir, or another new language requires an ADR documenting:

- problem;
- required capability;
- why existing languages are insufficient;
- security implications;
- performance evidence where relevant;
- deployment/runtime impact;
- testing strategy;
- observability;
- maintenance/hiring impact;
- interoperability contract;
- exit/replacement strategy.

## Current recommendation

**Keep the active portfolio at TypeScript + SQL + Python + Shell.**

**Approve Rust as the next specialist language, but do not add Rust code until the first concrete parser, processing, device, WASM, or security-sensitive requirement is identified.**

This gives ZENITH genuine multi-language capability without turning the repository into a polyglot maintenance burden.
