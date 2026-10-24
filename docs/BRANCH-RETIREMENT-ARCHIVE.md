# Branch Retirement Archive

**Verified:** 24 October 2026  
**Repository:** `netzen-abm/zenith`

This manifest preserves the identity of three dependency-update heads closed to avoid mixing separately versioned CodeQL action components. Each SHA was verified as an addressable GitHub commit after its remote branch reference disappeared. These are audit references to commit objects, not claims that archive tags were created.

| PR | Retired branch | Exact head SHA | Decision |
|---|---|---|---|
| [#105](https://github.com/netzen-abm/zenith/pull/105) | `dependabot/github_actions/github/codeql-action/upload-sarif-4.39.1` | `80e435d0d27a0c163b1eb11ed19d19c6f0584421` | Closed unmerged; consolidated v4.39.1 pin applies in `main` |
| [#106](https://github.com/netzen-abm/zenith/pull/106) | `dependabot/github_actions/github/codeql-action/analyze-4.39.1` | `33a4da55542638c6baabc8c4eac83b5abd8d8d46` | Closed unmerged; consolidated v4.39.1 pin applies in `main` |
| [#107](https://github.com/netzen-abm/zenith/pull/107) | `dependabot/github_actions/github/codeql-action/init-4.39.1` | `80f2e2867eddba1b51bb4e033388f19db2bfab19` | Closed unmerged; consolidated v4.39.1 pin applies in `main` |

## Retirement evidence and rule

- The three PRs were closed after confirming that their single-line changes belonged in one coherent release update.
- GitHub automatically removed their remote branch refs after closure; this reduced the active inventory from twelve to nine.
- Subsequent API lookups verified the exact head commits remained addressable.
- The workflow checks those PR/head pairs and fails closed if the state or SHA changes.
- The workflow enforces the exact nine canonical branch names and count. It does not attempt to create tag refs because the repository’s workflow token returned HTTP 403 for that mutation.
- No branch is force-moved to `main` to satisfy branch-count policy, and no placeholder branch is created.
