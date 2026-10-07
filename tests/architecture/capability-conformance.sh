#!/usr/bin/env bash
set -euo pipefail

# ZENITH capability-conformance ratchet.
# Protected capability entrypoints must consume the canonical execution kernel.
# This is deliberately structural: it verifies architectural dependencies,
# not arbitrary file size or line-count rules.

failed=0
capability_root="packages/capabilities/src"

while IFS= read -r -d '' file; do
  case "$file" in
    *.test.ts|*.test.tsx|*/test-fixtures/*) continue ;;
  esac

  content="$(cat "$file")"

  # Only inspect protected capability entrypoints: classes that expose execute()
  # and are either Capability classes or explicit *Operation classes.
  if ! grep -Eq 'class [A-Za-z0-9_]+(Capability|Operation)\b' "$file"; then
    continue
  fi
  if ! grep -Eq '(^|[[:space:]])async execute\(' "$file"; then
    continue
  fi

  echo "Checking capability conformance: $file"

  require_pattern() {
    local pattern="$1"
    local message="$2"
    if ! grep -Eq "$pattern" "$file"; then
      echo "ERROR: $message: $file"
      failed=1
    fi
  }

  require_pattern 'ExecutionCoordinator'     "protected capability must consume ExecutionCoordinator"
  require_pattern 'ExecutionAuthorization'     "protected capability must depend on canonical authorization contract"
  require_pattern 'ExecutionReservation'     "protected capability must depend on canonical reservation contract"
  require_pattern 'ExecutionOutcomeRecorder'     "protected capability must depend on canonical durable-outcome contract"
  require_pattern 'new ExecutionCoordinator'     "protected capability must construct the canonical execution boundary"
  require_pattern '\.coordinator\.execute\('     "protected capability must execute through its coordinator"
  require_pattern 'private async handle\('     "protected capability must keep domain handler logic behind reservation"
  require_pattern 'result\.executed'     "protected capability must honor coordinator execution decision"

  # Capability code must not execute authorization directly; the coordinator is the
  # canonical admission boundary.
  if grep -En '\\.(authorize|authorizeCapability)\\(' "$file" >/dev/null; then
    echo "ERROR: protected capability executes authorization directly; use ExecutionCoordinator: $file"
    failed=1
  fi

  # Capability code must not mutate the protected operations lifecycle directly.
  if grep -En 'operations\\.(transition|reserve_execution|record_execution_outcome)\\(' "$file" >/dev/null; then
    echo "ERROR: capability code mutates protected operations lifecycle directly: $file"
    failed=1
  fi

  # Capability code must remain provider/persistence implementation neutral.
  if grep -En "from ['\"](.*core/database|.*adapters|.*infrastructure|.*supabase|pg|postgres)['\"]" "$file" >/dev/null; then
    echo "ERROR: protected capability imports provider/persistence implementation: $file"
    failed=1
  fi
done < <(find "$capability_root" -type f \( -name '*.ts' -o -name '*.tsx' \) -print0)

if [[ "$failed" -ne 0 ]]; then
  echo
  echo "Capability conformance: FAIL"
  echo "A protected capability must use the canonical execution infrastructure."
  exit 1
fi

echo "Capability conformance: PASS"
