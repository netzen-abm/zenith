#!/usr/bin/env bash
set -euo pipefail

# Explicitly pins the migration sequence used by fresh-db-reconciliation.sh.
# Historical migration filenames are immutable unless a deployment-aware
# compatibility plan explicitly authorizes a migration-ledger transition.
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
MIGRATIONS_DIR="$ROOT_DIR/core/database/migrations"

expected=(
  "0001_security_kernel.sql"
  "0002_capability_policy_boundary.sql"
  "0003_core_foundation_reconciliation.sql"
  "0004_core_foundation_security_reconciliation.sql"
  "0005_evidence_provenance_reconciliation.sql"
  "0006_knowledge_graph_reconciliation.sql"
  "0007_space_time_reconciliation.sql"
  "0008_research_reconciliation.sql"
  "0009_identity_organisation_context.sql"
  "0011_operations_persistence.sql"
  "0012_operations_schema_grants.sql"
  "0013_restore_authenticated_rls_helper_execution.sql"
  "0014_execution_reservation.sql"
  "0015_operation_store_mutation_boundary.sql"
  "0016_durable_execution_outcome_audit.sql"
  "0017_conflict_terminal_transition.sql"
  "0017_evidence_annotation_vertical.sql"
  "0018_durable_operation_idempotency.sql"
  "0018_research_query_requests.sql"
  "0019_knowledge_graph_relationship_requests.sql"
  "0020_space_time_representation_requests.sql"
  "0021_field_observation_requests.sql"
  "0022_space_time_payload_idempotency.sql"
  "0023_space_time_mutation_receipt.sql"
)

mapfile -t actual < <(find "$MIGRATIONS_DIR" -maxdepth 1 -type f -name '*.sql' -printf '%f\n' | sort)

if [[ "${#actual[@]}" -ne "${#expected[@]}" ]]; then
  printf 'Migration inventory changed: expected %d files, found %d. Review and update the declared sequence deliberately.\n' "${#expected[@]}" "${#actual[@]}" >&2
  diff -u <(printf '%s\n' "${expected[@]}") <(printf '%s\n' "${actual[@]}") || true
  exit 1
fi

for index in "${!expected[@]}"; do
  if [[ "${actual[$index]}" != "${expected[$index]}" ]]; then
    printf 'Migration order mismatch at position %d: expected %s, found %s\n' "$((index + 1))" "${expected[$index]}" "${actual[$index]}" >&2
    exit 1
  fi
done

printf 'Migration inventory/order contract: PASS (%d migrations; duplicate prefixes explicitly sequenced)\n' "${#expected[@]}"
