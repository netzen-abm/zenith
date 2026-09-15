# Language-Independent Architecture

## Status
Accepted architectural principle.

## Decision
ZENITH is capability-oriented, not language-oriented. No single programming language is the architectural authority for the ecosystem.

A programming language is selected according to the bounded capability being implemented, its technical requirements, security properties, operational characteristics, ecosystem maturity, interoperability, maintenance burden, and replacement/exit strategy.

## Canonical rule
> Choose the language according to the capability, not the capability according to the language.

## Language allocation

| Domain | Preferred implementation options | Boundary rule |
|---|---|---|
| Application/API/SDK | TypeScript or another suitable language | Must consume language-neutral contracts |
| Systems/security/performance | Rust or another suitable systems language | Vendor/runtime details remain behind adapters |
| AI/ML/CV/OCR/HTR/statistics | Python or another suitable scientific language | Models and providers remain replaceable |
| System of record / spatial | PostgreSQL/PostGIS/SQL | Database remains authoritative for data integrity and RLS |
| Real-time/distributed workloads | Elixir or another suitable runtime | Use only where concrete workload requirements justify it |
| Browser/edge | WASM or suitable target runtime | Must preserve capability and contract semantics |
| Future specialist capabilities | Any technically justified language | Requires an architecture decision record when material |

These are recommendations, not mandatory technology choices.

## Language-neutral contracts

The following must not depend semantically on one implementation language:

- domain concepts and identifiers;
- ontology and semantic relationships;
- evidence and provenance;
- epistemic status;
- capability contracts;
- authorization semantics;
- privacy, safety and security obligations;
- federation/interoperability contracts;
- hardware observation/measurement representations.

Language-specific types may provide ergonomic bindings, but they are adapters to the canonical contract rather than replacements for it.

## Dependency direction

```text
                 ZENITH DOMAIN
                      |
          Language-neutral contracts
                      |
        +-------------+-------------+
        |             |             |
   TypeScript        Rust         Python
        |             |             |
        +-------------+-------------+
                      |
              Capability Boundary
                      |
             Policy / Data Boundary
                      |
             PostgreSQL / PostGIS
```

Other languages may participate at any layer where justified.

## Replacement test

A language choice is architecturally acceptable only if replacing the implementation language does not require changing the canonical domain model, ontology, evidence/provenance semantics, authorization model, or external interoperability contract.

## New-language gate

Before introducing a materially new language, document:

1. capability/workload requiring it;
2. why existing languages are insufficient or materially inferior;
3. security and supply-chain implications;
4. runtime and operational cost;
5. interoperability strategy;
6. maintenance and staffing implications;
7. test/observability strategy;
8. replacement and exit strategy;
9. licensing implications where relevant.

A lightweight ADR is sufficient for low-risk additions; a full architecture review is required when the language creates a new trust, runtime, data, or deployment boundary.

## Non-goals

This decision does not require every component to use multiple languages, nor does it prescribe polyglot development for its own sake. The goal is freedom of implementation without loss of architectural coherence.
