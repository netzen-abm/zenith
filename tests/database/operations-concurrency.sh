#!/usr/bin/env bash
set -euo pipefail
: "${DATABASE_URL:?DATABASE_URL must be set}"
PSQL=(psql --dbname="$DATABASE_URL" -v ON_ERROR_STOP=1 -X)
TENANT="00000000-0000-0000-0000-0000000000a1"
IDENTITY="00000000-0000-0000-0000-0000000000a2"
AUTH_USER="00000000-0000-0000-0000-0000000000a3"
OP_ID="00000000-0000-0000-0000-0000000000e1"
"${PSQL[@]}" <<SQL
begin;
insert into auth.users(id) values ('$AUTH_USER') on conflict do nothing;
insert into core.organisations(id,name,slug) values ('$TENANT','Concurrency Test','concurrency-test') on conflict do nothing;
insert into core.identities(id,auth_user_id,display_name) values ('$IDENTITY','$AUTH_USER','Concurrency Identity') on conflict do nothing;
insert into core.identity_organisation_memberships(identity_id,organisation_id,membership_role) values ('$IDENTITY','$TENANT','member') on conflict do nothing;
delete from operations.operations where id='$OP_ID' or (organisation_id='$TENANT' and idempotency_key='concurrency-idem');
commit;
SQL
for n in 1 2; do
  "${PSQL[@]}" >"/tmp/zenith-op-race-$n.out" 2>&1 <<SQL &
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','$AUTH_USER',true);
select set_config('app.organisation_id','$TENANT',true);
select pg_sleep(0.5);
insert into operations.operations(organisation_id,identity_id,idempotency_key,action,purpose,expires_at) values ('$TENANT','$IDENTITY','concurrency-idem','annotate','concurrency-test',clock_timestamp()+interval '1 hour');
commit;
SQL
done
wait || true
successes=0; failures=0
for n in 1 2; do grep -q '^INSERT 0 1$' "/tmp/zenith-op-race-$n.out" && successes=$((successes+1)) || true; grep -q 'duplicate key value violates unique constraint' "/tmp/zenith-op-race-$n.out" && failures=$((failures+1)) || true; done
test "$successes" -eq 1
test "$failures" -eq 1
count=$("${PSQL[@]}" -Atc "select count(*) from operations.operations where organisation_id='$TENANT' and idempotency_key='concurrency-idem'")
test "$count" -eq 1
"${PSQL[@]}" <<SQL
begin;
insert into operations.operations(id,organisation_id,identity_id,idempotency_key,action,purpose,expires_at) values ('$OP_ID','$TENANT','$IDENTITY','cas-race','annotate','concurrency-test',clock_timestamp()+interval '1 hour') on conflict (id) do update set state='created',expires_at=excluded.expires_at;
commit;
SQL
for n in 1 2; do
  "${PSQL[@]}" >"/tmp/zenith-cas-race-$n.out" 2>&1 <<SQL &
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','$AUTH_USER',true);
select set_config('app.organisation_id','$TENANT',true);
select pg_sleep(0.5);
select operations.transition('$OP_ID','created','authorized');
commit;
SQL
done
wait || true
cas_successes=0; cas_conflicts=0
for n in 1 2; do grep -q 'authorized' "/tmp/zenith-cas-race-$n.out" && cas_successes=$((cas_successes+1)) || true; grep -q 'operation_transition_conflict' "/tmp/zenith-cas-race-$n.out" && cas_conflicts=$((cas_conflicts+1)) || true; done
test "$cas_successes" -eq 1
test "$cas_conflicts" -eq 1
state=$("${PSQL[@]}" -Atc "select state from operations.operations where id='$OP_ID'")
test "$state" = authorized
rm -f /tmp/zenith-op-race-*.out /tmp/zenith-cas-race-*.out
echo "Operations concurrency assertions completed successfully."
