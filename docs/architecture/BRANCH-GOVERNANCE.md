# ZENITH Branch Governance

## Canonical branch set

ZENITH maintains exactly nine active development branches:

1. main
2. feat/knowledge-graph-next
3. feat/space-time-next
4. feat/research-intelligence-next
5. feat/ai-agent-infrastructure
6. feat/multisurface-adapters
7. feat/api-sdk-contracts
8. feat/security-release-engineering
9. feat/field-acquisition

## Retirement rule

Every non-canonical branch must be classified before retirement:

- Converged: work is present in a canonical branch.
- Duplicate: branch contains no unique work.
- Obsolete: work is no longer part of the architecture.
- Unique: work must first be reconciled into a canonical branch.

Retirement is archive-first:

branch SHA -> immutable archive tag -> branch deletion -> recount

A branch is not considered retired until the remote branch ref is gone.

## Open pull requests

A branch with an open pull request is retained until the pull request is merged or explicitly closed. Closed pull requests do not justify retaining the branch.

## Architectural branch rule

Branches represent independent workstreams, not arbitrary code ownership. Code must be split at boundaries of:

- change
- trust
- persistence
- provider dependency
- independent reuse

Do not create branches merely because a file or class is large.

## Enforcement

.github/workflows/branch-hygiene.yml archives and retires non-canonical branches and fails unless exactly nine active branches remain.
