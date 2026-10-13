import { strict as assert } from 'node:assert';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { SpaceTimeOperation } from '../../packages/capabilities/src/space-time-operation.ts';
import { PostgresSpaceTimeRequestRepository } from '../../packages/adapters/src/space-time/postgres-repository.ts';
import { PostgresOperationStore } from '../../packages/operation-queue/src/postgres-operation-store.ts';
import { PostgresExecutionReservation } from '../../packages/operation-queue/src/postgres-execution-reservation.ts';
import { PostgresExecutionOutcomeRecorder } from '../../packages/operation-queue/src/postgres-execution-outcome-recorder.ts';
import type { ExecutionOutcomeRecorder } from '../../packages/operation-queue/src/execution-coordinator.ts';

const execFileAsync = promisify(execFile);
const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) throw new Error('DATABASE_URL is required');

const organisationId = '00000000-0000-0000-0000-0000000003a1';
const identityId = '00000000-0000-0000-0000-0000000003a2';
const authUserId = '00000000-0000-0000-0000-0000000003a3';
const resourceId = '00000000-0000-0000-0000-0000000003a4';
const idempotencyKey = 'space-time-outcome-recovery-e2e';

async function psql(sql: string): Promise<string> {
  const result = await execFileAsync('psql', [
    '--dbname', dbUrl, '-v', 'ON_ERROR_STOP=1', '-X', '-qAt', '-F', '\\t', '-c', sql,
  ]);
  return result.stdout.trim();
}

function literal(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return "'" + String(value).replaceAll("'", "''") + "'";
}

const executor = {
  async query<T extends Record<string, unknown>>(sql: string, params: readonly unknown[]): Promise<T[]> {
    const statement = sql.replace(/\$(\d+)/g, (_match, index: string) => {
      const value = params[Number(index) - 1];
      if (value === undefined) throw new Error(`missing_sql_parameter:${index}`);
      return literal(value);
    });
    const context = `begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','${authUserId}',true);
select set_config('app.identity_id','${identityId}',true);
select set_config('app.organisation_id','${organisationId}',true);
`;
    if (statement.includes('insert into core.space_time_representation_requests')) {
      const output = await psql(context + statement + '; commit;');
      const id = output.split('\\n').filter(Boolean).at(-1);
      return id ? [{ id }] as T[] : [];
    }
    const output = await psql(context + `select 'ZENITH_JSON:' || row_to_json(q)::text from (${statement}) q;
commit;`);
    const rows = output.split('\\n')
      .map(line => line.trim())
      .filter(line => line.includes('ZENITH_JSON:'))
      .map(line => JSON.parse(line.slice(line.indexOf('ZENITH_JSON:') + 'ZENITH_JSON:'.length))) as T[];
    if (statement.includes('create_or_get_with_payload_hash') && rows.length === 0) {
      throw new Error(`space_time_e2e_operation_resolution_returned_no_rows:${output}`);
    }
    return rows;
  },
};

const store = {
  transaction: async <T>(work: (db: typeof executor) => Promise<T>): Promise<T> => work(executor),
};
const operationStore = new PostgresOperationStore(executor);
const repository = new PostgresSpaceTimeRequestRepository(store);
const durableRecorder = new PostgresExecutionOutcomeRecorder(executor);
let failOutcomeOnce = true;
const outcomeRecorder: ExecutionOutcomeRecorder = {
  async record(operation, outcome) {
    if (failOutcomeOnce) {
      failOutcomeOnce = false;
      throw new Error('simulated_outcome_persistence_interruption');
    }
    return durableRecorder.record(operation, outcome);
  },
};

await psql(`
insert into auth.users(id) values ('${authUserId}') on conflict do nothing;
insert into core.organisations(id,name,slug)
values ('${organisationId}','Space-Time Outcome Recovery E2E','space-time-outcome-recovery-e2e')
on conflict (id) do nothing;
insert into core.identities(id,auth_user_id,display_name)
values ('${identityId}','${authUserId}','Space-Time Outcome Recovery Identity')
on conflict (id) do nothing;
insert into core.identity_organisation_memberships(identity_id,organisation_id,membership_role)
values ('${identityId}','${organisationId}','member')
on conflict (identity_id,organisation_id) do nothing;
insert into core.resources(id,organisation_id,resource_type,title,epistemic_status,sensitivity)
values ('${resourceId}','${organisationId}','site','Space-Time Recovery Resource','documented','public')
on conflict (id) do nothing;
insert into core.resource_memberships(resource_id,identity_id,membership_role)
values ('${resourceId}','${identityId}','owner')
on conflict (resource_id,identity_id) do nothing;
`);

await psql(`
delete from operations.execution_outbox
 where operation_id in (select id from operations.operations where organisation_id = '${organisationId}' and idempotency_key = '${idempotencyKey}');
delete from operations.execution_outcomes
 where operation_id in (select id from operations.operations where organisation_id = '${organisationId}' and idempotency_key = '${idempotencyKey}');
delete from core.space_time_representation_requests
 where organisation_id = '${organisationId}' and identity_id = '${identityId}' and resource_id = '${resourceId}';
delete from core.spatial_representations where resource_id = '${resourceId}';
delete from operations.operations where organisation_id = '${organisationId}' and idempotency_key = '${idempotencyKey}';
`);

const spaceTime = new SpaceTimeOperation(repository, {
  organisationId,
  identityId,
  purpose: 'space-time outcome recovery e2e',
  // Authorization is covered by the coordinator E2E; this test isolates the
  // mutation/outcome crash window while the protected SQL mutation still
  // enforces the actual resource-write policy.
  authorization: { authorize: async () => true },
  reservation: new PostgresExecutionReservation(executor),
  outcomeRecorder,
  operationStore,
});

const request = {
  idempotencyKey,
  resourceId,
  representationType: 'point',
  precisionLevel: 'generalized' as const,
  coordinateConfidence: 0.8,
  geom: 'SRID=4326;POINT(10 20)',
};

await assert.rejects(
  () => spaceTime.execute(request),
  /simulated_outcome_persistence_interruption/,
  'the injected interruption must occur after the protected mutation returns',
);

const afterInterruption = await psql(`
select o.state || '|' || o.attempt_count || '|' ||
       r.status || '|' || coalesce(r.representation_id::text,'null') || '|' ||
       (select count(*) from core.spatial_representations sr where sr.resource_id = '${resourceId}')
from operations.operations o
join core.space_time_representation_requests r on r.id = o.payload_ref::uuid
where o.organisation_id = '${organisationId}' and o.idempotency_key = '${idempotencyKey}';
`);
const [operationState, attemptCount, requestState, representationId, representationCount] = afterInterruption.split('|');
assert.equal(operationState, 'in_flight');
assert.equal(attemptCount, '1');
assert.equal(requestState, 'consumed');
assert.notEqual(representationId, 'null');
assert.equal(representationCount, '1');

const recovered = await spaceTime.execute(request);
assert.equal(recovered.state, 'acknowledged');
assert.equal(recovered.resultRef, representationId);

const finalState = await psql(`
select o.state || '|' || eo.outcome || '|' || eo.result_ref || '|' ||
       (select count(*) from core.spatial_representations sr where sr.resource_id = '${resourceId}') || '|' ||
       (select count(*) from operations.execution_outbox ob where ob.operation_id = o.id)
from operations.operations o
join operations.execution_outcomes eo on eo.operation_id = o.id
where o.organisation_id = '${organisationId}' and o.idempotency_key = '${idempotencyKey}';
`);
assert.equal(finalState, `acknowledged|acknowledged|${representationId}|1|1`);

console.log('Space-Time PostgreSQL/PostGIS mutation-to-outcome recovery E2E: PASS');
