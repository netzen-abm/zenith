# ZENITH Core-Wide Convergence Audit — 2026-09-17

## Scope

Post-Research audit of the consolidated Past Intelligence Core across repository structure, database migrations, live Supabase schema, authorization, RLS, public projections, provenance, research, spatial/temporal infrastructure, and runtime-readiness.

## Verified state

- Foundation, authorization boundary, evidence/provenance, Knowledge Graph, Space/Time, and Research migrations are present on `main`.
- Research reconciliation PR #20 merged as `716e6cc5e376faedd64cb571604a6bd5866938ff`.
- Fresh-DB CI reproduced migrations through Research and reported PASS for foundation, evidence/provenance, Knowledge Graph, Space/Time, and Research assertions.
- Live Supabase Core contains the consolidated schema and RLS boundaries.
- Live Research tables are currently empty.
- Live Auth currently has zero users; therefore authenticated runtime authorization behavior has not yet been demonstrated with real identities.
- Core authorization helper functions use an empty `search_path`; the canonical capability decision function is SECURITY INVOKER.
- Public projections exist for resources, Knowledge Graph relationships, Space/Time surfaces, and research questions.

## Cross-cutting findings

### 1. Highest-leverage architectural gap: organisation context is implicit

`core.identities` currently links identities to `auth.users`, while organisation context is not represented as an explicit identity-to-organisation membership relation. The current organisation helper historically derives context from resource membership. This makes tenant context indirect and ambiguous for an ecosystem that must support users participating in multiple organisations.

**Risk:** authorization, audit attribution, research access, source visibility, and future API/agent actions can depend on an inferred organisation rather than an explicit principal context.

**Disposition:** do not patch live production speculatively. Define the canonical identity → organisation membership and active-organisation context contract first, then implement it through a reviewed migration and runtime tests.

### 2. Runtime authorization evidence remains incomplete

Fresh-DB tests establish schema/security shape, but they cannot prove real authenticated behavior. The live Auth project currently has no users. Runtime integration testing must be added once disposable authenticated identities can be provisioned safely in CI.

### 3. Research authorization is inherited rather than a new security model

Research tables correctly reuse resource-readability boundaries. No broad write policies were introduced during reconciliation. This preserves the shared authorization architecture but means write APIs must later pass through an explicit application/service capability boundary rather than relying on table grants alone.

### 4. Public projections are a deliberate safety boundary

Public views are narrower than researcher/institutional data surfaces. Sensitive spatial precision is gated, and public research questions omit organisation and creator identity. Future public views must follow the same projection-first pattern.

### 5. Provenance continuity is established but runtime workflows are not

The Core can represent source → evidence → observation/measurement → claim → interpretation/hypothesis and research outputs. The next implementation layer should connect these primitives through service/API contracts without creating a second domain model.

## Next architectural sequence

1. Specify canonical organisation membership and active organisation context.
2. Add runtime authenticated integration-test fixtures and prove authorization behavior end-to-end.
3. Define the shared service/API capability boundary over the Core before building substantial application surfaces.
4. Add search/discovery and annotation only after those boundaries consume the existing Core contracts.

## Non-goals of this audit

- No destructive migration rewrite.
- No speculative production DDL.
- No new public exposure of sensitive data.
- No provider-specific architecture lock-in.
- No application-specific replacement for Core primitives.
