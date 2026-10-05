#!/usr/bin/env bash
set -euo pipefail

OUTPUT_DIR="${1:-.tmp/contract-snapshot}"
: "${DATABASE_URL:?DATABASE_URL must be set}"
mkdir -p "$OUTPUT_DIR"
PSQL=(psql --dbname="$DATABASE_URL" -v ON_ERROR_STOP=1 -X)

run_snapshot() {
  local name="$1"
  local query="$2"
  "${PSQL[@]}" -Atc "$query" > "$OUTPUT_DIR/$name"
}

run_snapshot server-version "select current_setting('server_version')"

run_snapshot extensions "
select format('%s:%s', extname, extversion)
from pg_extension
where extname in ('postgis','pgcrypto')
order by 1"

run_snapshot relations "
select format('%s.%s:%s:rls=%s:forced=%s',
  n.nspname, c.relname, c.relkind::text,
  c.relrowsecurity::text, c.relforcerowsecurity::text)
from pg_class c
join pg_namespace n on n.oid=c.relnamespace
where n.nspname in ('core','audit')
  and c.relkind in ('r','v','m','f','p')
order by 1"

run_snapshot columns "
select format('%s.%s:%s:%s:notnull=%s',
  n.nspname, c.relname, a.attname,
  pg_catalog.format_type(a.atttypid,a.atttypmod),
  a.attnotnull::text)
from pg_attribute a
join pg_class c on c.oid=a.attrelid
join pg_namespace n on n.oid=c.relnamespace
where n.nspname in ('core','audit')
  and c.relkind in ('r','v','m')
  and a.attnum > 0
  and not a.attisdropped
order by 1"

run_snapshot functions "
select format('%s.%s(%s):definer=%s:config=%s',
  n.nspname, p.proname,
  pg_get_function_identity_arguments(p.oid),
  p.prosecdef::text,
  coalesce(p.proconfig::text,''))
from pg_proc p
join pg_namespace n on n.oid=p.pronamespace
where n.nspname in ('core','audit')
order by 1"

run_snapshot function-definitions "
select pg_get_functiondef(p.oid)
from pg_proc p
join pg_namespace n on n.oid=p.pronamespace
where n.nspname in ('core','audit')
order by n.nspname,p.proname,pg_get_function_identity_arguments(p.oid)"

run_snapshot policies "
select format('%s.%s:%s:%s:qual=%s:check=%s',
  schemaname, tablename, policyname, cmd,
  coalesce(qual,''), coalesce(with_check,''))
from pg_policies
where schemaname in ('core','audit')
order by 1"

run_snapshot grants "
select format('%s.%s:%s:%s:%s',
  table_schema, table_name, grantee, privilege_type, is_grantable)
from information_schema.role_table_grants
where table_schema in ('core','audit')
order by 1"

run_snapshot constraints "
select format('%s.%s:%s:%s',
  n.nspname, c.relname, con.conname, pg_get_constraintdef(con.oid))
from pg_constraint con
join pg_class c on c.oid=con.conrelid
join pg_namespace n on n.oid=c.relnamespace
where n.nspname in ('core','audit')
order by 1"

run_snapshot indexes "
select format('%s.%s:%s:%s',
  schemaname, tablename, indexname, indexdef)
from pg_indexes
where schemaname in ('core','audit')
order by 1"

run_snapshot triggers "
select format('%s.%s:%s:%s',
  n.nspname, c.relname, t.tgname, pg_get_triggerdef(t.oid))
from pg_trigger t
join pg_class c on c.oid=t.tgrelid
join pg_namespace n on n.oid=c.relnamespace
where n.nspname in ('core','audit')
  and not t.tgisinternal
order by 1"

run_snapshot views "
select format('%s.%s:%s',
  schemaname, viewname, definition)
from pg_views
where schemaname in ('core','audit')
order by 1"

printf 'Contract snapshot written to %s\n' "$OUTPUT_DIR"
