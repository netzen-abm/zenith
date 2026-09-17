# ZENITH Research Provider Contract

## Purpose

This contract defines the provider-neutral boundary between ZENITH Research Intelligence and external scholarly data/services.

## Design principle

**Providers supply research material; ZENITH owns canonical provenance, normalization, authorization, and epistemic relationships.**

No provider-specific object model may become a required Core semantic.

## Contract objects

### ResearchProvider

```text
provider_id
name
version_or_api_revision
capabilities
identifier_namespaces
rights_model
rate_limit_metadata
availability_metadata
adapter_version
```

### ResearchQuery

```text
query_id
research_question_id
intent
text
concepts
filters
sort
page_size
cursor
requested_fields
open_access_requirement
created_at
requester_identity_id
organisation_id
purpose
authorization_reference
```

### ResearchResult

```text
query_id
provider_id
provider_query_reference
retrieved_at
results[]
next_cursor
partial
warnings[]
```

Each result should expose normalized identity plus provider provenance.

### ResearchWork

```text
canonical_work_id
title
work_type
publication_date
authors[]
organisations[]
venues[]
identifiers[]
versions[]
access_locations[]
rights_metadata
source_provenance
provider_extensions
```

### ResearchCitation

```text
source_work_id
target_work_id
relationship_type
provider_provenance
retrieved_at
```

`relationship_type` must not imply evidentiary support unless independently established.

### ResearchEvidence

```text
evidence_id
source_reference
work_or_output_reference
claim_reference
relationship_type
location_or_excerpt_reference
provenance
epistemic_status
uncertainty
```

Evidence relationships belong to ZENITH's epistemic model, not to a provider's citation graph by default.

## Required adapter behavior

An adapter must:

1. translate canonical queries into provider-specific requests;
2. normalize returned identifiers and metadata;
3. preserve provider identifiers and retrieval provenance;
4. report pagination, partial results, rate limits, and provider errors explicitly;
5. avoid silently inventing missing fields;
6. preserve ambiguity in identity resolution;
7. expose rights/access metadata when supplied;
8. avoid retaining or redistributing content beyond applicable policy and rights;
9. remain replaceable without changing Core semantics.

## Provider capability examples

```text
OpenAlex       → scholarly works, authors, sources, concepts, citations
Semantic Scholar → scholarly graph, papers, authors, citations, related metadata
CORE           → scholarly metadata/full-text aggregation where permitted
DOAJ           → open-access journal/article discovery
Unpaywall      → DOI-based open-access location/status resolution
Zotero         → researcher collections, references, metadata, annotations/files where authorized
```

These are adapter capabilities, not mandatory canonical dependencies.

## Normalization rules

- Missing provider data remains missing; do not infer it as fact.
- Provider assertions remain attributable to the provider until independently verified.
- Duplicate works should be merged only through deterministic or reviewable identity resolution.
- Different versions of a work must remain distinguishable.
- Citation relationships must remain separate from evidence relationships.
- Full text must remain subject to access, licence, retention, and export policy.

## Reproducibility envelope

A research execution should be able to record:

```text
research_question
query_contract
provider_ids
adapter_versions
retrieval_timestamps
provider_query_references
filters
selection/exclusion decisions
normalization version
analysis/output references
```

## Failure behavior

| Condition | Required behavior |
|---|---|
| Provider unavailable | Return explicit provider failure; allow alternate provider if policy permits |
| Rate limited | Preserve retry metadata; do not busy-loop |
| Partial provider response | Mark partial and preserve retrieval metadata |
| Ambiguous identity | Preserve ambiguity; route to resolution workflow |
| Missing metadata | Preserve null/unknown state |
| Rights unclear | Do not assume redistribution or AI-processing rights |
| Full text inaccessible | Retain discoverability metadata only if permitted |
| Provider schema change | Adapter absorbs change; Core contract remains stable |
| Duplicate replay | Idempotent import/update semantics |

## Security and authorization

Research discovery of public metadata and access to protected research material are distinct operations. Protected retrieval, local retention, annotation, export, or AI processing must pass the applicable ZENITH authorization and policy boundary.

Where a research operation is queued for intermittent connectivity, it also conforms to the Resilient Capability Contract, including lease expiry, synchronization-time authorization checks, provenance preservation, and explicit reconciliation.

## Interoperability

Adapters may expose exchange formats such as DOI metadata, BibTeX, RIS, CSL-JSON, and other documented formats. Exchange formats must not replace the canonical contract.

## Acceptance criteria

A conforming adapter can be replaced by another adapter without requiring changes to:

- Core evidence semantics;
- Core identity/organisation context;
- authorization/policy primitives;
- knowledge-graph semantics;
- research question/project semantics;
- downstream AI contracts.
