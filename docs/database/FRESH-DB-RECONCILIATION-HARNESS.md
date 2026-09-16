# Fresh Database Reconciliation Harness

**Status:** Initial harness — baseline reproduction

## Purpose

This harness creates a disposable PostgreSQL/PostGIS database, applies every committed ZENITH Core migration in filename order, and emits a deterministic catalog snapshot covering:

- PostgreSQL/PostGIS version and required extensions
- Core/Audit relations
- Core/Audit functions and security-definer configuration
- Core/Audit RLS policies
- Core/Audit columns and types

It is a repository reproducibility test. It does **not** connect to or modify the Supabase production project.

## Run

From the repository root:

```bash
bash tests/database/fresh-db-reconciliation.sh
```

Requirements: Docker with the ability to run `postgis/postgis:16-3.4`.

The script removes its disposable container on exit and writes temporary snapshots under `.tmp/fresh-db-reconciliation/`.

## Current expected finding

The repository currently contains only the historical security-kernel migration and the canonical capability-boundary migration. The live Core contract contains additional generations and has materially diverged from the historical repository schema.

The harness is intentionally strict: if a committed migration cannot be applied to a fresh database, execution stops rather than masking the incompatibility. The known example is the historical resource authorization function signature versus the canonical capability-boundary call shape. That is evidence of migration/schema drift to reconcile, not a reason to weaken either migration or the test.

## Comparison phase

After the repository migration set becomes self-applying, the same snapshot outputs can be compared with `docs/database/LIVE-CORE-CONTRACT-INVENTORY.md`.

The comparison must separately classify:

1. repository-only objects;
2. live-only objects;
3. materially divergent definitions/security properties;
4. platform-managed objects that should not be recreated;
5. intentionally different production data values.

The harness must never treat matching object names alone as parity. Definitions, constraints, RLS, grants, function security context, views, and sensitive-coordinate behavior are part of the contract.

## Security boundary

Do not add production credentials, service-role keys, or Supabase connection strings to this script. Production validation belongs to the reviewed Supabase verification workflow. Authenticated authorization tests also require real Auth identities; the absence of test users must remain an explicit limitation rather than a fabricated pass.
