# ADR 0005: Research Intelligence Provider Abstraction

- Status: Proposed
- Date: 2026-09-17

## Context

ZENITH needs research capabilities that can discover, normalize, connect, and trace scholarly material without making any external scholarly provider part of the Core semantic model.

Existing services provide complementary capabilities: scholarly graph discovery, full-text aggregation, open-access resolution, reference management, and bibliometric analysis. ZENITH should integrate these capabilities rather than reproduce them as separate applications.

The Core already treats provenance, evidence, epistemic status, knowledge graph, research, identity, authorization, policy, and audit as shared infrastructure. Research Intelligence should therefore become a provider-neutral capability built on those primitives.

## Decision

ZENITH will define a canonical **Research Intelligence Provider Contract**. External scholarly services are adapters behind that contract.

Canonical flow:

`Research Intent → Query Contract → Provider Adapter(s) → Normalization → Identity Resolution → Provenance → Research/Evidence Graph`

### 1. Provider independence

No external provider is canonical. Initial adapters may include OpenAlex, Semantic Scholar, CORE, DOAJ, Unpaywall, and Zotero, but the Core model must remain usable if any provider disappears, changes API behavior, changes pricing, or is replaced.

### 2. Canonical research objects

The contract should normalize, where available:

- research queries;
- works/publications;
- authors;
- organisations/institutions;
- journals/sources/venues;
- identifiers and identifier mappings;
- versions and access locations;
- citations and references;
- datasets and other research outputs;
- annotations;
- claims and evidence relationships;
- rights/access metadata.

Provider-specific fields may be retained as extension data, but provider-specific schemas must not become required Core semantics.

### 3. Provenance-first ingestion

Every imported object must retain enough lineage to answer:

1. Which provider supplied it?
2. Which provider identifier was used?
3. When was it retrieved?
4. What transformation or normalization occurred?
5. Which canonical ZENITH object resulted?
6. What rights/access information accompanied it?

Importing a citation does not automatically establish independent evidence for a claim.

### 4. Citation is not evidence

ZENITH must distinguish at least:

- cites;
- references;
- supports;
- challenges/contradicts;
- derives_from;
- replicates;
- discusses;
- interpreted_as;
- documents.

A citation relationship alone must never be promoted automatically to an evidence relationship.

### 5. Identifier resolution

Where identifiers exist, ZENITH should resolve and preserve DOI, PMID, OpenAlex ID, Semantic Scholar ID, repository identifiers, Zotero item identifiers, and other provider identifiers without requiring any one identifier namespace to be universal.

Identity resolution must be deterministic where possible and must expose ambiguity rather than silently merging distinct works, authors, organisations, or versions.

### 6. Research query contract

A query should be representable independently of a provider and should preserve, where applicable:

- research intent/question;
- free-text query;
- structured concepts;
- date bounds;
- source/type filters;
- language;
- geography;
- open-access requirements;
- evidence/study-type constraints;
- paging/cursor requirements;
- requested fields;
- result limits;
- requester identity and organisation context;
- purpose and authorization reference where protected data or actions are involved.

Provider adapters translate this contract into provider-specific queries and return normalized results plus provider metadata.

### 7. Rights and access are distinct

`discoverable`, `accessible`, `reusable`, `redistributable`, and `AI-processable` are distinct states. Open-access metadata does not by itself grant ZENITH rights to redistribute protected content.

Full-text acquisition must obey source terms, applicable licences, access controls, and ZENITH retention/export policy.

### 8. Research reproducibility

Research executions should be able to preserve:

`Research Question → Query → Provider(s) → Retrieval Time → Filters → Results → Selection/Exclusion → Analysis → Output`

This creates a reproducible research trail without requiring permanent retention of material that policy or rights prohibit retaining.

### 9. AI boundary

Research AI consumes normalized, authorized research context. It must preserve source provenance and epistemic status and must distinguish source-derived material from model-generated synthesis or inference.

The AI layer is not the source of truth for bibliographic identity, evidence provenance, or claim status.

### 10. Interoperability

ZENITH should support import/export with established research workflows where practical, including Zotero, BibTeX, RIS, CSL-JSON, GraphML/GEXF, and other documented formats. Interoperability formats are exchange boundaries, not Core semantics.

## Non-goals

- Rebuilding OpenAlex, Semantic Scholar, CORE, DOAJ, Unpaywall, Zotero, ResearchRabbit, Connected Papers, Consensus, or VOSviewer.
- Making one provider mandatory.
- Treating citation count as evidence quality.
- Treating AI summaries as primary evidence.
- Copying provider-specific licensing or terms into ZENITH.
- Automatically importing or redistributing every discovered full text.

## Consequences

Positive:
- provider replacement remains practical;
- research workflows become composable;
- provenance and epistemic safety remain first-class;
- literature can connect to archaeological evidence and field observations;
- existing researcher tools remain interoperable;
- AI can reason over a normalized evidence graph rather than isolated search results.

Costs:
- normalization and identity resolution require explicit engineering;
- provider adapters need maintenance;
- rights metadata and retention rules require careful handling;
- reproducibility requires additional metadata and storage policy.
