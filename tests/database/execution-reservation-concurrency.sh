#!/usr/bin/env bash
set -euo pipefail
: "${DATABASE_URL:?DATABASE_URL must be set}"
PSQL=(psql --dbname="$DATABASE_URL" -v ON_ERROR_STOP=1 -X)
TENANT="00000000-0000-0000-0000-0000000000a1"
IDENTITY="00000000-0000-0000-0000-0000000000a2"
AUTH_USER="00000000-0000-0000-0000-0000000000a3"
RESOURCE="00000000-0000-0000-0000-0000000000d1"
OP_ID="00000000-0000-0000-0000-0000000000e4"

${PSQL[@]} <<SQL
begin;
insert into auth.users(id) values ('$AUTH_USER') on conflict do nothing;
insert into core.organisations(id,name,slug) values ('$TENANT','Reservation Concurrency Test','reservation-concurrency-test') on conflict do nothing;
insert into core.identities(id,auth_user_id,display_name) values ('$IDENTITY','$AUTH_USER','Reservation Concurrency Identity') on conflict do nothing;
insert into core.identity_organisation_memberships(identity_id,organisation_id,membership_role) values ('$IDENTITY','$TENANT','member') on conflict do nothing;
insert into core.resources(id,organisation_id,resource_type,title,epistemic_status,sensitivity) values ('$RESOURCE','$TENANT','test','Reservation Concurrency Resource','documented','public') on conflict do nothing;
insert into core.resource_memberships(resource_id,identity_id,membership_role) values ('$RESOURCE','$IDENTITY','owner') on conflict (resource_id,identity_id) do nothing;
delete from operations.operations where id='$OP_ID';
insert into operations.operations(id,organisation_id,identity_id,idempotency_key,action,resource_id,purpose,expires_at,state) values ('$OP_ID','$TENANT','$IDENTITY','reservation-concurrency','annotate','$RESOURCE','reservation concurrency',clock_timestamp()+interval '1 hour','queued');
commit;
SQL

for n in 1 2; do
  "${PSQL[@]}" -At >"/tmp/zenith-reservation-race-$n.out" 2>&1 <<SQL &
begin;
set local role authenticated
select set_config('request.jwt.claim.sub','$AUTH_USER',true);
select set_config('app.organisation_id','$TENANT',true);
select pg_sleep(0.5);
select * from operations.reserve_execution('$OP_ID');
commit;
SQL
done
wait || true

allows=0
denied=0
for n in 1 2; do
  grep -q '|allow|' "/tmp/zenith-reservation-race-$n.out" && allows=$((allows+1)) || true
  grep -Eq '\|(deny_state|operation_transition_conflict)\|' "/tmp/zenith-reservation-race-$n.out" && denied=$((denied+1)) || true
done
test "$allows" -eq 1
test "$denied" -eq 1
state=$("${PSQL[@]}" -Atc "select state from operations.operations where id='$OP_ID'")
attempts=$("${PSQL[@]}" -Atc "select attempt_count from operations.operations where id='$OP_ID'")
test "$state" = in_flight
test "$attempts" -eq 1
rm -f /tmp/zenith-reservation-race-*.out
echo "Persistent execution reservation concurrency assertions completed successfully."
