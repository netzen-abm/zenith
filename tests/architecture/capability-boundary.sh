#!/usr/bin/env bash
set -euo pipefail

# ZENITH capability-boundary ratchet.
# Capabilities may depend on contracts and execution interfaces, but must not
# introduce new provider/persistence implementations or alternate trust paths.
#
failed=0


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

  if grep -En "(context\\.)?authorization\\.authorize\\(|this\\.authorization\\.authorize\\(" "$file" >/dev/null; then
    echo "ERROR: capability source owns authorization execution; use ExecutionCoordinator."
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
