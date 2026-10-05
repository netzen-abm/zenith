# Live-vs-Fresh Database Contract Verification

**Status:** Implemented harness — parity closure remains open until a reviewed live target is available.

## Objective

Convert database migration parity from a documentation assertion into a repeatable, measurable comparison.

The verification model is:

`repository migrations → fresh database → deterministic contract snapshot`

compared with:

`verified live Core → deterministic contract snapshot`

The comparison is read-only and does not require production credentials to be committed.

## Contract surface

The snapshot compares application-owned:

- Core/Audit relations and RLS flags
- columns and types
- functions, security-definer configuration and definitions
- RLS policies
- table grants
- constraints
- indexes
- triggers
- views and definitions

Server-version differences are reported but are not treated as application-schema drift. Required extension presence is contract-critical and fails comparison when the extension set differs; extension-version differences are reported separately because platform-managed versions may legitimately differ.

## Procedure

### 1. Fresh database

Run the existing repository reconciliation harness. It now emits the canonical contract snapshot at `.tmp/fresh-db-reconciliation/contract/` before the disposable database is removed.

### 2. Live verification target

Against a reviewed non-production/live Core target:

```bash
DATABASE_URL='REDACTED-OUTSIDE-REPOSITORY' \
  bash tests/database/contract-snapshot.sh .tmp/live-contract
```

Never commit `DATABASE_URL`, service-role keys, access tokens, or other credentials.

### 3. Compare

```bash
python3 tests/database/compare-contract-snapshots.py \
  .tmp/fresh-db-reconciliation/contract \
  .tmp/live-contract
```

### 4. Classify differences

Every difference must be classified as:

1. repository defect;
2. live contract defect requiring a reviewed forward migration;
3. intentional architectural difference with an ADR;
4. Supabase/platform-managed difference;
5. environment/version difference.

Only application-owned contract differences count against parity.

## Auth-backed verification

Schema parity is necessary but insufficient. After structural convergence, run the existing Auth integration contract for unauthorized protected writes, authorized positive paths, cross-tenant isolation, sensitive-coordinate exposure, self-only identity access, and public/anonymous projection safety.

Do not convert missing Auth identities into a fabricated pass.

## Current limitation

The historical Past Intelligence Core Supabase project is currently inactive in the connected environment, so a live SQL snapshot cannot be collected during this audit. The harness is therefore implemented, but parity closure is **not claimed**.

## Architectural boundary

The snapshot/comparison responsibility is deliberately separate from the execution kernel. It is a verification boundary, not a runtime authority. Capability code must not import it or use it for authorization decisions.
