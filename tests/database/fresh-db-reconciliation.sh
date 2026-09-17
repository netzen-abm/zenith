#!/usr/bin/env bash
set -euo pipefail

# Reproduces the repository migration baseline in an isolated PostGIS database.
# If DATABASE_URL is set, the caller owns database lifecycle (used by CI).
# Otherwise this script starts a disposable local PostGIS container.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CONTAINER="zenith-reconciliation-postgres"
IMAGE="postgis/postgis:16-3.4"
DB="zenith"
USER="postgres"
PASSWORD="postgres"
PORT="55432"
LOCAL_DB_URL="postgresql://${USER}:${PASSWORD}@127.0.0.1:${PORT}/${DB}"

cleanup() {
  if [ -z "${DATABASE_URL:-}" ]; then docker rm -f "$CONTAINER" >/dev/null 2>&1 || true; fi
}
trap cleanup EXIT

if [ -z "${DATABASE_URL:-}" ]; then
  command -v docker >/dev/null || { echo "DATABASE_URL or docker is required" >&2; exit 2; }
  docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
  docker run -d --name "$CONTAINER" -e POSTGRES_DB="$DB" -e POSTGRES_USER="$USER" \
    -e POSTGRES_PASSWORD="$PASSWORD" -p "$PORT:5432" "$IMAGE" >/dev/null
  for attempt in $(seq 1 60); do
    if docker exec "$CONTAINER" pg_isready -U "$USER" -d "$DB" >/dev/null 2>&1; then break; fi
    [ "$attempt" -eq 60 ] && { echo "PostGIS database did not become ready" >&2; exit 1; }
    sleep 2
  done
  DATABASE_URL="$LOCAL_DB_URL"
fi

: "${DATABASE_URL:?DATABASE_URL must be set}"
PSQL=(psql --dbname="$DATABASE_URL" -v ON_ERROR_STOP=1 -X)
echo "==> waiting for database connectivity"
for attempt in $(seq 1 30); do
  if "${PSQL[@]}" -Atc "select 1" >/dev/null 2>&1; then
    echo "==> database connectivity ready"
    break
  fi
  if [ "$attempt" -eq 30 ]; then
    echo "DATABASE_URL did not become queryable" >&2
    "${PSQL[@]}" -Atc "select 1" || true
    exit 1
  fi
  sleep 2
done

"${PSQL[@]}" -f "$ROOT_DIR/tests/database/fresh-db-auth-shim.sql"
for migration in "$ROOT_DIR"/core/database/migrations/*.sql; do
  echo "==> applying $(basename "$migration")"
  "${PSQL[@]}" -f "$migration"
done

"${PSQL[@]}" -f "$ROOT_DIR/tests/database/fresh-db-foundation-assertions.sql"
"${PSQL[@]}" -f "$ROOT_DIR/tests/database/evidence-provenance-assertions.sql"
"${PSQL[@]}" -f "$ROOT_DIR/tests/database/knowledge-graph-assertions.sql"
"${PSQL[@]}" -f "$ROOT_DIR/tests/database/space-time-assertions.sql"
"${PSQL[@]}" -f "$ROOT_DIR/tests/database/research-assertions.sql"

snapshot_dir="$ROOT_DIR/.tmp/fresh-db-reconciliation"
rm -rf "$snapshot_dir"
mkdir -p "$snapshot_dir"
run_snapshot() {
  local name="$1"
  local query="$2"
  echo "==> snapshot: $name"
  "${PSQL[@]}" -Atc "$query" > "$snapshot_dir/$name"
}
run_snapshot server-version "select version()"
run_snapshot extensions "select format('%s:%s', extname, extversion) from pg_extension where extname in ('postgis','pgcrypto') order by 1"
run_snapshot relations "select format('%s.%s:%s', n.nspname, c.relname, c.relkind::text) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('core','audit') and c.relkind in ('r','v','m','f','p') order by 1"
run_snapshot functions "select format('%s.%s(%s):%s:%s', n.nspname, p.proname, pg_get_function_identity_arguments(p.oid), p.prosecdef::text, coalesce(p.proconfig::text,'')) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('core','audit') order by 1"
run_snapshot rls-policies "select format('%s.%s:%s:%s:%s', schemaname, tablename, policyname, coalesce(cmd,''), coalesce(qual,'') || ':' || coalesce(with_check,'')) from pg_policies where schemaname in ('core','audit') order by 1"
run_snapshot columns "select format('%s.%s:%s:%s:%s', n.nspname, c.relname, a.attname, pg_catalog.format_type(a.atttypid,a.atttypmod), a.attnotnull::text) from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('core','audit') and c.relkind in ('r','v','m') and a.attnum > 0 and not a.attisdropped order by 1"
printf '\n==> snapshot files\n'
for snapshot in "$snapshot_dir"/*; do
  printf '\n--- %s ---\n' "$(basename "$snapshot")"
  cat "$snapshot"
done
printf '\nFresh repository database reproduction, foundation, evidence/provenance, Knowledge Graph, Space/Time, and Research assertions completed.\n'
