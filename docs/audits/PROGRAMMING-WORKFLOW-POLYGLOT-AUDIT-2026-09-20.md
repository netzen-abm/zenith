# ZENITH Programming, Workflow & Polyglot Audit — 2026-09-20

## Scope

This audit covers the executable and repository-control surfaces on `main` at `9b1684d6cbe9068add64c5c4f8970ef3664632a7`, including:

- TypeScript contracts and operation runtime
- PostgreSQL/PostGIS migrations and security boundaries
- database assertions and concurrency harnesses
- Python reference gate harness
- shell CI/reconciliation tooling
- GitHub Actions workflows
- Dependabot configuration
- programming-language architecture
- active execution-related pull requests

This is an architecture/code-control audit, not a claim that the future application surfaces are complete.

## Executive assessment

The repository has a strong security/data foundation, but the application/runtime layer is still deliberately immature.

The principal architectural risk is no longer a missing Core authorization primitive. It is **runtime composition and durability**:

`Identity → Organisation → Core authorization → Capability/lease → Operation → Persistent reservation → Handler → Durable outcome/audit`

The first six boundaries are materially represented. The final runtime composition is only partially integrated.

## Language audit

### Current justified portfolio

| Language | Current role | Decision |
|---|---|---|
| SQL/PostgreSQL/PostGIS | data authority, RLS, authorization predicates, lifecycle/reservation | canonical |
| TypeScript | contracts, operation runtime, orchestration | default application language |
| Python | reference/security harness; future AI/scientific workloads | specialist |
| Shell | CI/reconciliation/concurrency tooling | tooling only |
| Rust | future parser/media/device/WASM/security specialist | approved, not yet justified for implementation |

No empty Rust crate should be introduced merely to make the repository polyglot.

The existing language-governance ADR correctly uses capability boundaries rather than language silos.

## TypeScript audit

### Strengths

- Operation envelope is explicit and minimal.
- Authorization contracts are separated from execution contracts.
- Lifecycle graph is now centralized in `packages/contracts/src/operation-state.ts`.
- Runtime lifecycle code consumes the canonical graph.
- PostgreSQL reservation is represented by a narrow adapter.
- Coordinator does not itself implement authorization policy.

### Finding TS-01 — authorization adapter integration remains incomplete

`ExecutionCoordinator` accepts an injected `ExecutionAuthorization`, but the PostgreSQL E2E currently supplies:

`{ authorize: async () => true }`

Therefore the current E2E proves the reservation/handler contention boundary, but **does not prove that the production coordinator preflight is connected to the canonical `core.authorize_capability(...)` decision**.

This is a material verification gap.

### Finding TS-02 — durable outcome is not yet on main

The coordinator currently returns `executed: true` immediately after the handler resolves. The durable outcome/audit boundary exists on PR #47, but that PR is based on an older main and is therefore not directly mergeable without reconciliation.

The production sequence should ultimately become:

`preflight → reservation → handler → record outcome/outbox → explicit completion/reconciliation`

rather than treating an in-memory handler return as durable truth.

### Finding TS-03 — lease runtime remains contract-level

`validateLease()` exists, but the current production coordinator does not consume an actual persistent ExecutionLease.

Do not add another authorization system to solve this. The lease must remain a capability/execution constraint, while current policy remains owned by Core.

## PostgreSQL audit

### Strengths

- RLS is forced on operations and execution outcome surfaces.
- Direct authenticated lifecycle UPDATE is revoked.
- Lifecycle mutations are routed through narrow database functions.
- `reserve_execution()` locks the operation row and rechecks current policy before claiming it.
- Expiry and not-before conditions are authoritative database checks.
- Attempt count participates in execution state.
- Protected payload bodies are not placed into operation persistence.

### Finding DB-01 — SECURITY DEFINER boundaries require continued invariant testing

`operations.transition()` and `operations.reserve_execution()` are now SECURITY DEFINER because direct authenticated table UPDATE is intentionally revoked.

That is architecturally reasonable, but it increases the importance of:

- empty `search_path`
- explicit tenant predicates
- explicit state predicates
- explicit expiry predicates
- exact EXECUTE grants
- regression tests proving public/unauthorized callers cannot invoke or mutate through the boundary

These should remain mandatory CI invariants.

### Finding DB-02 — durable outcome migration requires reconciliation before merge

PR #47 introduces:

- `operations.execution_outcomes`
- `operations.execution_outbox`
- `operations.record_execution_outcome()`

The design correctly keeps authenticated direct mutation revoked and atomically couples outcome, lifecycle advancement, and outbox creation.

However, the PR is four commits behind current main and must be rebased/reconciled before it can be treated as current architecture.

## Python audit

The Python reference gate harness is appropriately isolated under `tests/reference_gate_harness`.

It must remain:

- reference-only
- non-production
- incapable of authorizing real requests
- useful for policy/model regression tests

It should not become a second production policy engine.

## Workflow audit

### Current workflow set

- `.github/workflows/ci.yml`
- `.github/workflows/codeql.yml`
- `.github/workflows/scorecard.yml`
- `.github/dependabot.yml`

No workflow was found that should simply be deleted.

### Workflow finding WF-01 — mutable CodeQL action references

CI and Scorecard already used immutable commit pins, but CodeQL used floating `@v4` references.

This was corrected on PR #50 by pinning CodeQL init/analyze to the verified v4.37.9 commit already used by the repository's SARIF upload step.

### Workflow finding WF-02 — absence of a pinning invariant

A workflow can regress from an immutable SHA to a mutable tag unless CI prevents it.

PR #50 therefore adds a repository-integrity check that rejects mutable third-party action references.

Dependabot remains responsible for proposing SHA updates.

### Workflow finding WF-03 — source-size rule

The 190-line rule is currently applied to TS/JS/Python/Rust/Elixir source but not SQL.

This is reasonable because SQL migrations are declarative database evolution units and several current migrations exceed 190 lines.

The rule should remain a maintainability heuristic, not become an artificial code-minification constraint.

## Dependabot

Dependabot is now correctly configured for the repository's actual dependency surface:

`github-actions`

There is currently no justified package-manager configuration for npm, Cargo, pip, Go, etc.

Do not create empty package manifests simply to enable Dependabot ecosystems.

## Rust decision

Rust is **approved but not yet implemented**.

The first justified Rust component should be driven by a real workload such as:

1. specialist archaeological binary/document parsing;
2. point-cloud/mesh/image processing;
3. field-device/native hardware integration;
4. browser WASM acceleration;
5. a concrete security-sensitive native primitive.

Until such a workload exists, adding Rust increases maintenance surface without increasing system capability.

## Pull-request convergence audit

### PR #38

Superseded execution-boundary work. Current main already contains the relevant reservation architecture.

**Action:** close as superseded after preserving history.

### PR #42

The PostgreSQL-backed coordinator E2E is represented in current main.

**Action:** close as superseded after preserving history.

### PR #44

Contains the programming-language architecture decision, but its branch is substantially behind current main.

**Action:** preserve its useful architectural content in current main's governance documentation, then close as superseded rather than merging stale history.

### PR #47

Contains the next material runtime boundary: durable execution outcome + audit/outbox.

Its design is architecturally relevant, but its branch is behind current main.

**Action:** reconcile the implementation against current main before merge; do not force-merge the stale branch.

## Priority order

### P0 — protect current main

1. Complete PR #50 CI/CodeQL verification.
2. Merge only after all checks are green.

### P1 — close runtime authorization verification gap

Create a production-style PostgreSQL authorization adapter so the E2E path proves:

`ExecutionCoordinator → canonical Core authorization → PostgreSQL reservation → exactly-one handler`

The current `authorize: async () => true` fixture is insufficient as final evidence.

### P2 — reconcile durable execution outcome

Rebase/reconstruct PR #47 onto current main.

Then verify:

- authenticated direct outcome mutation denied;
- exactly one outcome per operation/attempt;
- outcome + lifecycle + outbox are atomic;
- concurrent writers converge to one recorded outcome;
- failure paths cannot accidentally become authorization success.

### P3 — lease runtime

Only after the above is green:

- persistent lease issuance;
- binding to operation/capability/purpose;
- expiry/revocation;
- execution validation;
- release/reconciliation.

### P4 — archaeological application surfaces

Only after the control plane is durable:

- Explore
- Research
- Field
- Museum
- Learn
- Community
- Pattanam/Muziris proving vertical
- provider/device/federation adapters

## Architectural recommendation

Do **not** respond to current gaps by adding more languages, more frameworks, or another security subsystem.

The correct architecture is becoming clearer:

`Core = authority`

`Operations = durable execution state`

`Coordinator = runtime composition`

`Adapters = transport/provider/device boundaries`

`Handlers = domain work`

`Outcome/Outbox = durable execution evidence`

`Provenance = archaeological/research evidence continuity`

Rust, Python, TypeScript and SQL then become implementation tools behind those boundaries rather than competing architectural centers.

## Audit conclusion

ZENITH should now move from **security-boundary construction** toward **runtime-boundary integration**.

The highest-value next implementation is not another feature surface. It is proving that the complete execution path cannot bypass Core authorization, cannot double-reserve an operation, cannot lose its durable outcome, and cannot silently turn a handler result into an unrecorded state transition.

That is the foundation required before scaling ZENITH into multiple archaeological experience surfaces and specialist processing languages.
