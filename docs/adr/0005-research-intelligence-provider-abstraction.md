# ADR 0005: Research Intelligence Provider Abstraction

- Status: Proposed
- Date: 2026-09-17

## Decision summary

ZENITH Research Intelligence will use a provider-neutral contract. External scholarly services are adapters and are never canonical Core dependencies.

Canonical flow:

`Research Intent → Query Contract → Provider Adapter(s) → Normalization → Identity Resolution → Provenance → Research/Evidence Graph`

## Scope

The abstraction covers research queries, works, authors, organisations, venues, identifiers, versions, access locations, citations, datasets/outputs, annotations, claims/evidence relationships, and rights/access metadata where available.

Provider-specific fields may be retained as extensions but cannot become required Core semantics.

## Architectural rules

1. **Provider independence** — OpenAlex, Semantic Scholar, CORE, DOAJ, Unpaywall, Zotero, or any future provider may be replaced without changing Core semantics.
2. **Provenance-first ingestion** — preserve provider, provider identifier, retrieval time, adapter version, transformation, and resulting canonical object lineage.
3. **Citation ≠ evidence** — citation/reference edges must remain distinct from supports/challenges/derives-from and other epistemic relationships.
4. **Identifier ambiguity is explicit** — DOI and provider IDs are identifiers, not permission to silently merge distinct works, authors, organisations, or versions.
5. **Rights are explicit** — discoverable, accessible, reusable, redistributable, and AI-processable are separate states.
6. **Reproducibility** — research executions should preserve question, query, provider, retrieval time, filters, selection/exclusion, normalization version, analysis, and outputs as permitted by retention/rights policy.
7. **AI is downstream** — AI consumes authorized normalized research context; it does not become the bibliographic or epistemic source of truth.
8. **Interoperability** — Zotero, BibTeX, RIS, CSL-JSON, GraphML/GEXF, and similar formats are exchange boundaries, not Core semantics.
9. **Resilience** — queued research operations conform to the Resilient Capability Contract and re-check authorization at synchronization/execution.

## Non-goals

- Rebuilding scholarly discovery/reference-management products.
- Making citation counts an evidence-quality score.
- Treating AI summaries as primary evidence.
- Automatically retaining or redistributing every discovered full text.

## Consequences

This gives ZENITH a stable research boundary while allowing multiple external scholarly sources to contribute complementary data. The implementation cost is explicit normalization, identity resolution, provider maintenance, rights handling, and reproducibility metadata.

## Related contract

See `docs/contracts/RESEARCH-PROVIDER-CONTRACT.md`.
