#!/usr/bin/env bash
set -euo pipefail

# ZENITH capability-boundary ratchet.
# Capabilities may depend on contracts and execution interfaces, but must not
# introduce new provider/persistence implementations or alternate trust paths.
#
# Known legacy persistence implementations are temporarily allow-listed while
# their canonical branches converge them behind repository ports.

legacy_persistence=(
  "packages/capabilities/src/knowledge-graph-operation.ts"
  "packages/capabilities/src/space-time-operation.ts"
)

failed=0

is_legacy() {
  local file="$1"
  for allowed in "${legacy_persistence[@]}"; do
    [[ "$file" == "$allowed" ]] && return 0
  done
  return 1
}

while IFS= read -r -d '' file; do
  case "$file" in
    *.test.ts|*.test.tsx) continue ;;
  esac

  if grep -En "from ['\"](.*core/database|.*adapters|.*infrastructure|.*supabase|pg|postgres)['\"]" "$file" >/dev/null; then
    echo "ERROR: capability source imports infrastructure/provider implementation: $file"
    grep -En "from ['\"](.*core/database|.*adapters|.*infrastructure|.*supabase|pg|postgres)['\"]" "$file" || true
    failed=1
  fi

  if grep -En "require\(['\"](.*core/database|.*adapters|.*infrastructure|.*supabase|pg|postgres)['\"]\)" "$file" >/dev/null; then
    echo "ERROR: capability source requires infrastructure/provider implementation: $file"
    failed=1
  fi

  if is_legacy "$file"; then
    continue
  fi

  if grep -En "db\.query\(|\.transaction\(.*=>|TransactionExecutor|type Db =" "$file" >/dev/null; then
    echo "ERROR: capability source owns persistence orchestration: $file"
    grep -En "db\.query\(|\.transaction\(.*=>|TransactionExecutor|type Db =" "$file" || true
    failed=1
  fi
done < <(find packages/capabilities/src -type f \( -name '*.ts' -o -name '*.tsx' \) -print0)

if [[ "$failed" -ne 0 ]]; then
  echo
  echo "Capability boundary violation."
  echo "Use a repository/provider contract at the capability boundary and place"
  echo "PostgreSQL/Supabase/provider implementations behind adapters/infrastructure."
  exit 1
fi

echo "Capability boundary: PASS"
