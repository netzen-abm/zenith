#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL must be set}"
psql_args=(psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -X -qAt)
op="00000000-0000-0000-0000-0000000000f1"
auth_user="00000000-0000-0000-0000-0000000000b3"
org="00000000-0000-0000-0000-0000000000b1"
identity="00000000-0000-0000-0000-0000000000b2"
resource="00000000-0000-0000-0000-0000000000d2"

"${psql_args[@]}" <<SQL
begin;
insert into auth.users(id) values ('$auth_user') on conflict do nothing;
insert into core.organisations(id,name,slug) values ('$org','Outcome Concurrency','outcome-concurrency') on conflict do nothing;
insert into core.identities(id,auth_user_id,display_name) values ('$identity','$auth_user','Outcome Concurrency Identity') on conflict do nothing;
insert into core.identity_organisation_memberships(identity_id,organisation_id,membership_role) values ('$identity','$org','member') on conflict do nothing;
insert into core.resources(id,organisation_id,resource_type,title,epistemic_status,sensitivity) values ('$resource','$org','test','Outcome Concurrency Resource','documented','public') on conflict do nothing;
insert into core.resource_memberships(resource_id,identity_id,membership_role) values ('$resource','$identity','owner') on conflict do nothing;
insert into operations.operations(id,organisation_id,identity_id,idempotency_key,action,resource_id,purpose,expires_at)
values ('$op','$org','$identity','outcome-concurrency','annotate','$resource','outcome concurrency',clock_timestamp()+interval '1 hour')
on conflict (id) do nothing;
commit;
SQL

"${psql_args[@]}" <<SQL
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','$auth_user',true);
select set_config('app.organisation_id','$org',true);
select operations.transition('$op','created','authorized');
select operations.transition('$op','authorized','queued');
select (operations.reserve_execution('$op')).allowed;
commit;
SQL

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

for n in 1 2; do
  (
    while [ ! -f "$tmp/go" ]; do sleep 0.01; done
    "${psql_args[@]}" >"$tmp/$n" <<SQL
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','$auth_user',true);
select set_config('app.organisation_id','$org',true);
select (recorded || '|' || decision)
from operations.record_execution_outcome(
  '$op',1,'acknowledged',null,'result://race-$n','hash-race-$n'
);
commit;
SQL
  ) &
done

sleep 0.1
touch "$tmp/go"
wait

recorded=$(grep -h '^t|recorded$' "$tmp"/1 "$tmp"/2 | wc -l | tr -d ' ')
[ "$recorded" -eq 1 ] || {
  echo "expected exactly one recorded outcome; got $recorded"
  cat "$tmp"/1 "$tmp"/2
  exit 1
}

state=$("${psql_args[@]}" -c "select state from operations.operations where id='$op'")
outcomes=$("${psql_args[@]}" -c "select count(*) from operations.execution_outcomes where operation_id='$op'")
outbox=$("${psql_args[@]}" -c "select count(*) from operations.execution_outbox where operation_id='$op'")

[ "$state" = "acknowledged" ] || { echo "unexpected final state: $state"; exit 1; }
[ "$outcomes" = "1" ] || { echo "unexpected outcome count: $outcomes"; exit 1; }
[ "$outbox" = "1" ] || { echo "unexpected outbox count: $outbox"; exit 1; }

echo "execution outcome concurrency assertions passed"
