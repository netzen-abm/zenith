import { strict as assert } from 'node:assert';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { ExecutionCoordinator } from '../../packages/operation-queue/src/execution-coordinator.ts';
import { PostgresCoreAuthorization } from '../../packages/operation-queue/src/postgres-core-authorization.ts';
import { PostgresExecutionReservation } from '../../packages/operation-queue/src/postgres-execution-reservation.ts';
import { PostgresExecutionOutcomeRecorder } from '../../packages/operation-queue/src/postgres-execution-outcome-recorder.ts';

const execFileAsync = promisify(execFile);
const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) throw new Error('DATABASE_URL is required');

const operationId = '00000000-0000-0000-0000-0000000000f1';
const organisationId = '00000000-0000-0000-0000-0000000000a1';
const identityId = '00000000-0000-0000-0000-0000000000a2';
const authUserId = '00000000-0000-0000-0000-0000000000a3';
const resourceId = '00000000-0000-0000-0000-0000000000d1';

async function psql(sql: string): Promise<string> {
  const result = await execFileAsync('psql', [
    '--dbname', dbUrl, '-v', 'ON_ERROR_STOP=1', '-X', '-At', '-F', '\t', '-c', sql,
  ]);
  return result.stdout.trim();
}

await psql(`
insert into auth.users(id) values ('${authUserId}') on conflict do nothing;
insert into core.organisations(id,name,slug)
  values ('${organisationId}','Coordinator E2E','coordinator-e2e')
  on conflict (id) do nothing;
insert into core.identities(id,auth_user_id,display_name)
  values ('${identityId}','${authUserId}','Coordinator E2E Identity')
  on conflict (id) do nothing;
insert into core.identity_organisation_memberships(identity_id,organisation_id,membership_role)
  values ('${identityId}','${organisationId}','member')
  on conflict (identity_id,organisation_id) do nothing;
insert into core.resources(id,organisation_id,resource_type,title,epistemic_status,sensitivity)
  values ('${resourceId}','${organisationId}','test','Coordinator E2E Resource','documented','public')
  on conflict (id) do nothing;
insert into core.resource_memberships(resource_id,identity_id,membership_role)
  values ('${resourceId}','${identityId}','owner')
  on conflict (resource_id,identity_id) do nothing;
delete from operations.execution_outbox where operation_id = '${operationId}';
delete from operations.execution_outcomes where operation_id = '${operationId}';
delete from operations.operations where id = '${operationId}';
insert into operations.operations(
  id,organisation_id,identity_id,idempotency_key,action,resource_id,purpose,expires_at
) values (
  '${operationId}','${organisationId}','${identityId}','coordinator-e2e',
  'annotate','${resourceId}','coordinator e2e',clock_timestamp()+interval '10 minutes'
);

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','${authUserId}',true);
select set_config('app.identity_id','${identityId}',true);
select set_config('app.organisation_id','${organisationId}',true);
select operations.transition('${operationId}','created','authorized');
select operations.transition('${operationId}','authorized','queued');
commit;
`);

const context = await psql(`
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','${authUserId}',true);
select set_config('app.identity_id','${identityId}',true);
select set_config('app.organisation_id','${organisationId}',true);
select coalesce(core.current_identity_id()::text,'null') || '|' ||
       coalesce(core.current_organisation_id()::text,'null') || '|' ||
       coalesce((select allowed from core.authorize_capability('annotate','${resourceId}'::uuid,'coordinator e2e') limit 1)::text,'null') || '|' ||
       coalesce((select decision from core.authorize_capability('annotate','${resourceId}'::uuid,'coordinator e2e') limit 1),'null');
rollback;`);
console.log('Coordinator E2E auth context:', context);
const queuedState = await psql("select state || '|' || attempt_count from operations.operations where id = '"+operationId+"'");
console.log('Coordinator E2E queued state:', queuedState);
assert.equal(queuedState, 'queued|0');
const reservationProbe = await psql(`
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','${authUserId}',true);
select set_config('app.identity_id','${identityId}',true);
select set_config('app.organisation_id','${organisationId}',true);
select coalesce((select state from operations.operations where id='${operationId}'),'missing') || '|' ||
       coalesce((select allowed::text || ':' || decision from operations.reserve_execution('${operationId}'::uuid)),'null');
rollback;`);
console.log('Coordinator E2E reservation probe:', reservationProbe);

const db = {
  async query<T extends Record<string, unknown>>(sql: string, params: readonly unknown[]) {
    if (sql.includes('core.authorize_capability')) {
      const action = String(params[0]).replaceAll("'", "''");
      const resource = params[1] === null ? 'null' : "'" + String(params[1]).replaceAll("'", "''") + "'::uuid";
      const purpose = String(params[2]).replaceAll("'", "''");
      const output = await psql(`begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','${authUserId}',true);
select set_config('app.identity_id','${identityId}',true);
select set_config('app.organisation_id','${organisationId}',true);
select allowed::text || '|' || decision from core.authorize_capability('${action}',${resource},'${purpose}');
rollback;`);
      const line = output.split('\n').find((entry) => /^true\|(?:allow|deny)/.test(entry) || /^false\|(?:allow|deny)/.test(entry));
      if (!line) throw new Error(`core_authorization_result_not_found: ${output}`);
      const [allowed, decision] = line.split('|');
      return [{ allowed: allowed === 'true', decision }] as T[];
    }
    if (sql.includes('operations.record_execution_outcome')) {
      const [id, attempt, outcome, errorCode, resultRef, resultHash, occurredAt] = params;
      const esc = (value: unknown) => value === null || value === undefined ? 'null' : "'" + String(value).replaceAll("'", "''") + "'";
      const output = await psql(`begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','${authUserId}',true);
select set_config('app.identity_id','${identityId}',true);
select set_config('app.organisation_id','${organisationId}',true);
select recorded::text || '|' || decision from operations.record_execution_outcome('${String(id)}'::uuid, ${Number(attempt)}, ${esc(outcome)}, ${esc(errorCode)}, ${esc(resultRef)}, ${esc(resultHash)}, ${esc(occurredAt)}::timestamptz);
commit;`);
      const line = output.split('\n').find((entry) => /^true\|/.test(entry) || /^false\|/.test(entry));
      if (!line) throw new Error(`execution_outcome_result_not_found: ${output}`);
      const [recorded, decision] = line.split('|');
      return [{ recorded: recorded === 'true', decision }] as T[];
    }
    const id = String(params[0]).replaceAll("'", "''");
    const output = await psql(`begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','${authUserId}',true);
select set_config('app.identity_id','${identityId}',true);
select set_config('app.organisation_id','${organisationId}',true);
select allowed::text || '|' || decision || '|' ||
       coalesce((select attempt_count::text from operations.operations where id='${id}'),'null')
from operations.reserve_execution('${id}'::uuid);
commit;`);
    const line = output.split('\n').find((entry) => /^(true|false)\|/.test(entry));
    if (!line) throw new Error(`execution_reservation_result_not_found: ${output}`);
    const [allowed, decision, attemptCount] = line.split('|');
    return [{
      allowed: allowed === 'true',
      decision,
      ...(attemptCount !== 'null' ? { attemptCount: Number(attemptCount) } : {}),
    }] as T[];
  },
};

let handlerEntries = 0;
const authorization = new PostgresCoreAuthorization(db);
const reservation = new PostgresExecutionReservation(db);
const outcomeRecorder = new PostgresExecutionOutcomeRecorder(db);
const coordinator = new ExecutionCoordinator(
  authorization,
  reservation,
  async () => {
    handlerEntries += 1;
    return { outcome: 'acknowledged' };
  },
  outcomeRecorder,
);

const results = await Promise.all([
  coordinator.execute({
    operationId, idempotencyKey: 'coordinator-e2e', action: 'annotate',
    resourceId, purpose: 'coordinator e2e', state: 'queued',
    createdAt: new Date().toISOString(), attemptCount: 0,
  }),
  coordinator.execute({
    operationId, idempotencyKey: 'coordinator-e2e', action: 'annotate',
    resourceId, purpose: 'coordinator e2e', state: 'queued',
    createdAt: new Date().toISOString(), attemptCount: 0,
  }),
]);

console.log('Coordinator E2E results:', JSON.stringify(results));
console.log('Coordinator E2E handler entries:', handlerEntries);
assert.equal(results.filter(r => r.executed).length, 1);
assert.equal(results.filter(r => r.decision === 'deny_reservation').length, 1);
assert.equal(handlerEntries, 1);

const state = await psql(`select state || '|' || attempt_count from operations.operations where id = '${operationId}'`);
assert.equal(state, 'acknowledged|1');
const outcomeCount = await psql(`select count(*) from operations.execution_outcomes where operation_id = '${operationId}'`);
const outboxCount = await psql(`select count(*) from operations.execution_outbox where operation_id = '${operationId}'`);
assert.equal(outcomeCount, '1');
assert.equal(outboxCount, '1');

await psql(`delete from operations.execution_outbox where operation_id = '${operationId}';
delete from operations.execution_outcomes where operation_id = '${operationId}';
delete from operations.operations where id = '${operationId}'`);
console.log('PostgreSQL-backed ExecutionCoordinator E2E assertions passed.');
