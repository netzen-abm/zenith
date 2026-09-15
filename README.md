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

- **TypeScript** — primary application/API/contracts language
- **Rust** — systems, performance, security-sensitive boundaries
- **Python** — AI/ML, OCR/HTR, computer vision, statistics, scientific workloads
- **SQL/PostgreSQL/PostGIS** — system of record and spatial integrity
- **Elixir** — conditional; introduced only through an architecture decision demonstrating concrete need

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

See `docs/ARCHITECTURE-GOVERNANCE.md` and `docs/LICENSING.md`.

## Status

Architecture and implementation contracts are frozen for controlled application implementation. The initial repository scaffold is being established before feature expansion.
