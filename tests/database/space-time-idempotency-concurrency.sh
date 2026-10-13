#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL must be set}"
psql_args=(psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -X -qAt)
auth_user="00000000-0000-0000-0000-0000000002e3"
org="00000000-0000-0000-0000-0000000002e1"
identity="00000000-0000-0000-0000-0000000002e2"
resource="00000000-0000-0000-0000-0000000002e4"
key="space-time-concurrent-idempotency"

# Seed the fixture as the database owner. Each contender below then runs as
# authenticated in its own transaction, sharing only the tenant-scoped key.
"${psql_args[@]}" <<SQL
begin;
insert into auth.users(id) values ('$auth_user') on conflict do nothing;
insert into core.organisations(id,name,slug) values ('$org','Space-Time Concurrent Idempotency','space-time-concurrent-idempotency') on conflict do nothing;
insert into core.identities(id,auth_user_id,display_name) values ('$identity','$auth_user','Space-Time Concurrent Identity') on conflict do nothing;
insert into core.identity_organisation_memberships(identity_id,organisation_id,membership_role) values ('$identity','$org','member') on conflict do nothing;
insert into core.resources(id,organisation_id,resource_type,title,epistemic_status,sensitivity) values ('$resource','$org','site','Space-Time Concurrent Resource','documented','public') on conflict (id) do nothing;
insert into core.resource_memberships(resource_id,identity_id,membership_role) values ('$resource','$identity','owner') on conflict (resource_id,identity_id) do nothing;
commit;
SQL

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

run_contender() {
  local operation_id="$1"
  "${psql_args[@]}" >"$tmp/$operation_id" <<SQL
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','$auth_user',true) \\gset
select set_config('app.organisation_id','$org',true) \\gset
select created::text || '|' || operation_id::text
from operations.create_or_get_with_payload_hash(
  '$operation_id', '$org', '$key',
  'space_time.spatial_representation_create', '$identity', 'integration-test',
  clock_timestamp() + interval '1 hour', '$resource', 'request://space-time-concurrent',
  jsonb_build_object(
    'action','space_time.spatial_representation_create',
    'organisationId','$org','identityId','$identity','purpose','integration-test',
    'resourceId','$resource','representationType','point','geom','POINT(10 20)',
    'precisionLevel','generalized','coordinateConfidence',0.8,'sourceEvidenceId',null
  )
);
commit;
SQL
}

run_contender "00000000-0000-0000-0000-0000000002e5" &
pid1=$!
run_contender "00000000-0000-0000-0000-0000000002e6" &
pid2=$!
wait "$pid1"
wait "$pid2"

result1="$(cat "$tmp/00000000-0000-0000-0000-0000000002e5")"
result2="$(cat "$tmp/00000000-0000-0000-0000-0000000002e6")"
id1="${result1#*|}"
id2="${result2#*|}"
created_count="$(printf '%s\n%s\n' "$result1" "$result2" | awk -F'|' '$1 == "true" {n++} END {print n+0}')"

[ -n "$id1" ] && [ "$id1" = "$id2" ] || {
  echo "concurrent same-key requests resolved to different operation IDs"
  printf 'contender 1: %s\ncontender 2: %s\n' "$result1" "$result2"
  exit 1
}
[ "$created_count" -eq 1 ] || {
  echo "expected exactly one creator; got $created_count"
  printf 'contender 1: %s\ncontender 2: %s\n' "$result1" "$result2"
  exit 1
}

count="$("${psql_args[@]}" -c "select count(*) from operations.operations where organisation_id='$org' and idempotency_key='$key'")"
[ "$count" = "1" ] || { echo "expected one canonical operation row, got $count"; exit 1; }

echo "Space-Time concurrent idempotency assertions passed"
