# Live Migration Generation Mapping

**Status:** In progress — repository reconciliation re-baselined 2026-10-05

## Mapping rule

The deployed Supabase Core contains 14 historical migration generations. Repository `main` now contains bounded forward reconciliation units through `0021_field_observation_requests.sql`. Filename parity with the historical 14 generations is not the acceptance criterion; behavioral and security parity is.

Historical generations must not be recreated merely to repair numbering.

## Current generation map

| Live generation | Repository representation | Status |
|---|---|---|
| 1 security kernel | `0001` | Represented; hardened by `0003`/`0004` |
| 2 public data surface | `0003`/`0004` | Represented |
| 3 public RLS read path | `0004` | Represented; fresh DB green |
| 4 anonymous public policy | `0004` | Represented; fresh DB green |
| 5 PostGIS public surface | `0004` + platform classification | Represented; residual tracked separately |
| 6 PostGIS extension privileges | Platform-managed classification | No speculative application DDL |
| 7 evidence/provenance kernel | `0005` | Represented; fresh DB green |
| 8 evidence runtime gate | tests + `0005` | Structural gate green; Auth behavior open |
| 9 knowledge graph kernel | `0006` + `0019` | Represented; fresh DB/security green |
| 10 space/time kernel | `0007` + `0020` | Represented; exact live-contract comparison open |
| 11 research workflow kernel | `0008` + `0018` | Represented; exact live-contract comparison open |
| 12 authorization helper execution context | `0004` | Represented; Auth verification open |
| 13 authorization EXECUTE boundary | `0002` + `0004` | Represented; Auth verification open |
| 14 canonical capability boundary | `0002` | Represented; security gate green |

## Repository migration units

`0001`–`0009`, `0011`–`0016`, and `0017`–`0021` are committed. `0010` is absent. No replacement `0010` should be invented merely to make the sequence contiguous.

The current set covers foundation, security, evidence/provenance, Knowledge Graph, Space/Time, Research, identity context, operation infrastructure, Evidence Annotation, and Field Acquisition.

## Closure sequence

1. Provision a fresh non-production database from repository migrations.
2. Compare schema, constraints, indexes, functions, triggers, views, grants and RLS with the verified live contract.
3. Run public/anonymous safety tests.
4. Run authenticated positive/negative tests with real Auth identities.
5. Run cross-tenant isolation and sensitive-coordinate exposure tests.
6. Separately classify Supabase-managed platform residuals.

**Migration parity remains OPEN.** Green CI is necessary evidence, not proof of complete live-database parity.