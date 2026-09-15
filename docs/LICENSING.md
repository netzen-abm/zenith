# ZENITH Layered Licensing Policy

ZENITH is intentionally **not** governed by one license across the entire ecosystem.

## Software layers

| Layer | Default treatment | Rationale |
|---|---|---|
| Core SDKs, schemas, contracts | Apache-2.0 | Broad reuse and interoperability |
| Generic infrastructure libraries | Apache-2.0 | Open ecosystem adoption |
| Interoperability/adapters | Apache-2.0 where appropriate | Avoid lock-in |
| Developer tooling | Apache-2.0 | Community contribution |
| Selected network-facing collaborative services | AGPL-3.0 where appropriate | Preserve reciprocal freedoms for network use |
| Enterprise/hosted commercial capabilities | Proprietary / Commercial EULA | Commercial differentiation and managed service terms |

## Non-software layers

- Research datasets and cultural materials: dataset/institution/community-specific rights.
- AI models and weights: model-specific license and usage terms.
- Hardware/firmware: hardware-appropriate license if developed.
- Documentation: appropriate content license where separation is useful.
- Brand and trademarks: separately controlled trademark policy.

## Rules

1. Never imply that a software license grants rights over third-party cultural heritage data.
2. Never relicense third-party material without establishing the underlying rights.
3. Preserve attribution and provenance requirements.
4. Record license/provenance metadata at ingestion where available.
5. Do not invent a custom open-source license merely to combine Apache-2.0 and AGPL-3.0.
6. Commercial EULA terms must not misrepresent components that remain under open-source licenses.
7. License changes require an architecture/legal review and an ADR.

This document is an architecture policy, not legal advice. Final commercial and rights language requires legal review before distribution.
