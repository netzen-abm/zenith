import { strict as assert } from 'node:assert';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { ExecutionCoordinator } from '../../packages/operation-queue/src/execution-coordinator.ts';
import { PostgresCoreAuthorization } from '../../packages/operation-queue/src/postgres-core-authorization.ts';
import { PostgresExecutionReservation } from '../../packages/operation-queue/src/postgres-execution-reservation.ts';
import { PostgresExecutionOutcomeRecorder } from '../../packages/operation-queue/src/postgres-execution-outcome-recorder.ts';
import { PostgresOperationStore } from '../../packages/operation-queue/src/postgres-operation-store.ts';
import { PostgresResearchQueryStore } from '../../packages/adapters/src/research/postgres-repository.ts';
import { ResearchOperation } from '../../packages/capabilities/src/research-operation.ts';
import type { ResearchQuery } from '../../packages/capabilities/src/research-intelligence.ts';

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
    if (sql.includes('operations.transition')) {
      const [id, expected, next] = params;
      const output = await psql(`begin;\nset local role authenticated;\nselect set_config('request.jwt.claim.sub','${authUserId}',true);\nselect set_config('app.identity_id','${identityId}',true);\nselect set_config('app.organisation_id','${organisationId}',true);\nselect 'transitioned' from operations.transition('${String(id)}'::uuid,'${String(expected)}','${String(next)}');\ncommit;`);
      if (!output.includes('transitioned')) throw new Error(`operation_transition_result_not_found: ${output}`);
      return [{ transition: 'transitioned' }] as T[];
    }
    if (sql.includes('operations.create_or_get(')) {
      const [opId, orgId, key, action, identity, purpose, expires, payloadRef] = params;
      const lit = (value: unknown) => value === null || value === undefined ? 'null' : "'" + String(value).replaceAll("'", "''") + "'";
      const output = await psql(`begin;\nset local role authenticated;\nselect set_config('request.jwt.claim.sub','${authUserId}',true);\nselect set_config('app.identity_id','${identityId}',true);\nselect set_config('app.organisation_id','${organisationId}',true);\nselect row_to_json(t)::text from (select * from operations.create_or_get(${lit(opId)}::uuid,${lit(orgId)}::uuid,${lit(key)},${lit(action)},${lit(identity)}::uuid,${lit(purpose)},${lit(expires)}::timestamptz,${lit(payloadRef)})) t;\ncommit;`);
      const line = output.split('\n').find(entry => entry.startsWith('{'));
      return (line ? [JSON.parse(line)] : []) as T[];
    }
    if (sql.startsWith('insert into core.research_query_requests')) {
      const v = params;
      const lit = (value: unknown) => value === null || value === undefined ? 'null' : "'" + String(value).replaceAll("'", "''") + "'";
      const output = await psql(`begin;\nset local role authenticated;\nselect set_config('request.jwt.claim.sub','${authUserId}',true);\nselect set_config('app.identity_id','${identityId}',true);\nselect set_config('app.organisation_id','${organisationId}',true);\nwith inserted as (insert into core.research_query_requests(id,organisation_id,identity_id,research_question_id,intent,query_text,concepts,filters,sort,page_size,cursor,requested_fields,open_access_required,purpose) values (${lit(v[0])}::uuid,${lit(v[1])}::uuid,${lit(v[2])}::uuid,${lit(v[3])}::uuid,${lit(v[4])},${lit(v[5])},${lit(v[6])}::jsonb,${lit(v[7])}::jsonb,${lit(v[8])}::jsonb,${Number(v[9])},${lit(v[10])},${lit(v[11])}::jsonb,${v[12] === true ? 'true' : 'false'},${lit(v[13])}) returning id) select row_to_json(inserted)::text from inserted;\ncommit;`);
      const line = output.split('\n').find(entry => entry.startsWith('{'));
      return (line ? [JSON.parse(line)] : []) as T[];
    }
    if (sql.includes('from core.research_query_requests')) {
      const [id, orgId] = params;
      const lit = (value: unknown) => value === null || value === undefined ? 'null' : "'" + String(value).replaceAll("'", "''") + "'";
      const output = await psql(`begin;\nset local role authenticated;\nselect set_config('request.jwt.claim.sub','${authUserId}',true);\nselect set_config('app.identity_id','${identityId}',true);\nselect set_config('app.organisation_id','${organisationId}',true);\nselect row_to_json(t)::text from (select id,research_question_id,intent,query_text,concepts,filters,sort,page_size,cursor,requested_fields,open_access_required,identity_id as requester_identity_id,organisation_id,purpose from core.research_query_requests where id = ${lit(id)}::uuid and organisation_id = ${lit(orgId)}::uuid limit 1) t;\ncommit;`);
      const line = output.split('\n').find(entry => entry.startsWith('{'));
      return (line ? [JSON.parse(line)] : []) as T[];
    }
    if (sql.includes('from operations.execution_outcomes')) {
      const [id] = params;
      const output = await psql(`begin;\nset local role authenticated;\nselect set_config('request.jwt.claim.sub','${authUserId}',true);\nselect set_config('app.identity_id','${identityId}',true);\nselect set_config('app.organisation_id','${organisationId}',true);\nselect row_to_json(t)::text from (select outcome,error_code,result_ref,result_hash,to_char(occurred_at at time zone 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"') as occurred_at from operations.execution_outcomes where operation_id = '${String(id)}'::uuid order by attempt_count desc limit 1) t;\ncommit;`);
      const line = output.split('\n').find(entry => entry.startsWith('{'));
      return (line ? [JSON.parse(line)] : []) as T[];
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
select allowed::text || '|' || decision || '|' || coalesce(attempt_count::text,'null')
from operations.reserve_execution('${id}'::uuid);
commit;`);
    const line = output.split('\n').find((entry) => /^(true|false)\|/.test(entry));
    if (!line) throw new Error(`execution_reservation_result_not_found: ${output}`);
    const [allowed, decision, attemptCount] = line.split('|');
    return [{
      allowed: allowed === 'true',
      decision,
      ...(attemptCount !== 'null' ? { attempt_count: Number(attemptCount) } : {}),
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


// Real PostgreSQL crash-window proof: the provider handler succeeds, but the
// outcome recorder fails before persistence. The durable reservation must
// prevent a retry from entering the handler a second time.
const ambiguousOperationId = '00000000-0000-0000-0000-0000000000f2';
await psql(`
delete from operations.execution_outbox where operation_id = '${ambiguousOperationId}';
delete from operations.execution_outcomes where operation_id = '${ambiguousOperationId}';
delete from operations.operations where id = '${ambiguousOperationId}';
insert into operations.operations(
  id,organisation_id,identity_id,idempotency_key,action,resource_id,purpose,expires_at
) values (
  '${ambiguousOperationId}','${organisationId}','${identityId}','coordinator-ambiguous-e2e',
  'annotate','${resourceId}','coordinator ambiguous outcome e2e',clock_timestamp()+interval '10 minutes'
);
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','${authUserId}',true);
select set_config('app.identity_id','${identityId}',true);
select set_config('app.organisation_id','${organisationId}',true);
select operations.transition('${ambiguousOperationId}','created','authorized');
select operations.transition('${ambiguousOperationId}','authorized','queued');
commit;
`);

let ambiguousHandlerEntries = 0;
const ambiguousCoordinator = new ExecutionCoordinator(
  authorization,
  reservation,
  async () => {
    ambiguousHandlerEntries += 1;
    return { outcome: 'acknowledged', resultRef: 'provider-effect-succeeded' };
  },
  {
    async record() {
      throw new Error('simulated_outcome_persistence_interruption');
    },
  },
);
const ambiguousOperation = {
  operationId: ambiguousOperationId,
  idempotencyKey: 'coordinator-ambiguous-e2e',
  action: 'annotate',
  resourceId,
  purpose: 'coordinator ambiguous outcome e2e',
  state: 'queued' as const,
  createdAt: new Date().toISOString(),
  attemptCount: 0,
};

await assert.rejects(
  () => ambiguousCoordinator.execute(ambiguousOperation),
  /simulated_outcome_persistence_interruption/,
);
assert.equal(ambiguousHandlerEntries, 1);

const ambiguousRetry = await ambiguousCoordinator.execute(ambiguousOperation);
assert.equal(ambiguousRetry.executed, false);
assert.equal(ambiguousRetry.decision, 'deny_reservation');
assert.equal(ambiguousHandlerEntries, 1, 'persistent reservation must block blind replay');

const ambiguousState = await psql(
  `select state || '|' || attempt_count from operations.operations where id = '${ambiguousOperationId}'`,
);
assert.equal(ambiguousState, 'in_flight|1');
const ambiguousOutcomeCount = await psql(
  `select count(*) from operations.execution_outcomes where operation_id = '${ambiguousOperationId}'`,
);
const ambiguousOutboxCount = await psql(
  `select count(*) from operations.execution_outbox where operation_id = '${ambiguousOperationId}'`,
);
assert.equal(ambiguousOutcomeCount, '0');
assert.equal(ambiguousOutboxCount, '0');

await psql(`
delete from operations.execution_outbox where operation_id = '${ambiguousOperationId}';
delete from operations.execution_outcomes where operation_id = '${ambiguousOperationId}';
delete from operations.operations where id = '${ambiguousOperationId}';
`);
console.log('PostgreSQL ambiguous-outcome non-replay assertions passed.');

// PostgreSQL proof for a handler that throws after its side effect may have
// occurred: conflict outcome + outbox must be durable and retries must be denied.
const handlerFailureOperationId = '00000000-0000-0000-0000-0000000000f3';
await psql(`
delete from operations.execution_outbox where operation_id = '${handlerFailureOperationId}';
delete from operations.execution_outcomes where operation_id = '${handlerFailureOperationId}';
delete from operations.operations where id = '${handlerFailureOperationId}';
insert into operations.operations(id,organisation_id,identity_id,idempotency_key,action,resource_id,purpose,expires_at)
values ('${handlerFailureOperationId}','${organisationId}','${identityId}','coordinator-handler-failure-e2e',
  'annotate','${resourceId}','coordinator handler failure e2e',clock_timestamp()+interval '10 minutes');
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','${authUserId}',true);
select set_config('app.identity_id','${identityId}',true);
select set_config('app.organisation_id','${organisationId}',true);
select operations.transition('${handlerFailureOperationId}','created','authorized');
select operations.transition('${handlerFailureOperationId}','authorized','queued');
commit;
`);

let handlerFailureEntries = 0;
const handlerFailureCoordinator = new ExecutionCoordinator(
  authorization,
  reservation,
  async () => {
    handlerFailureEntries += 1;
    throw new Error('simulated_provider_outcome_ambiguous');
  },
  outcomeRecorder,
);
const handlerFailureOperation = {
  operationId: handlerFailureOperationId, idempotencyKey: 'coordinator-handler-failure-e2e',
  action: 'annotate', resourceId, purpose: 'coordinator handler failure e2e',
  state: 'queued' as const, createdAt: new Date().toISOString(), attemptCount: 0,
};
await assert.rejects(
  () => handlerFailureCoordinator.execute(handlerFailureOperation),
  /simulated_provider_outcome_ambiguous/,
);
assert.equal(handlerFailureEntries, 1);
assert.equal(
  await psql(`select state || '|' || attempt_count from operations.operations where id = '${handlerFailureOperationId}'`),
  'conflict|1',
);
assert.equal(
  await psql(`select outcome || '|' || error_code from operations.execution_outcomes where operation_id = '${handlerFailureOperationId}'`),
  'conflict|handler_outcome_unknown',
);
assert.equal(
  await psql(`select count(*) from operations.execution_outbox where operation_id = '${handlerFailureOperationId}'`),
  '1',
);
const handlerFailureRetry = await handlerFailureCoordinator.execute(handlerFailureOperation);
assert.equal(handlerFailureRetry.executed, false);
assert.equal(handlerFailureRetry.decision, 'deny_reservation');
assert.equal(handlerFailureEntries, 1, 'durable conflict must block blind replay');
await psql(`
delete from operations.execution_outbox where operation_id = '${handlerFailureOperationId}';
delete from operations.execution_outcomes where operation_id = '${handlerFailureOperationId}';
delete from operations.operations where id = '${handlerFailureOperationId}';
`);
console.log('PostgreSQL handler-failure durable conflict assertions passed.');



// Full PostgreSQL lifecycle proof: create-or-get starts at created; the shared coordinator
// must use the canonical transition function before the reservation gate accepts the operation.
const lifecycleOperationId = '00000000-0000-0000-0000-0000000000f4';
await psql(`
delete from operations.execution_outbox where operation_id = '${lifecycleOperationId}';
delete from operations.execution_outcomes where operation_id = '${lifecycleOperationId}';
delete from operations.operations where id = '${lifecycleOperationId}';
insert into operations.operations(id,organisation_id,identity_id,idempotency_key,action,resource_id,purpose,expires_at)
values ('${lifecycleOperationId}','${organisationId}','${identityId}','coordinator-lifecycle-e2e',
  'annotate','${resourceId}','coordinator lifecycle e2e',clock_timestamp()+interval '10 minutes');
`);
const lifecycleOperation = {
  operationId: lifecycleOperationId, idempotencyKey: 'coordinator-lifecycle-e2e',
  action: 'annotate', resourceId, purpose: 'coordinator lifecycle e2e',
  state: 'created' as const, createdAt: new Date().toISOString(), attemptCount: 0,
};
let lifecycleHandlerEntries = 0;
const lifecycleStore = new PostgresOperationStore(db);
const lifecycleCoordinator = new ExecutionCoordinator(
  authorization,
  reservation,
  async () => {
    lifecycleHandlerEntries += 1;
    return { outcome: 'acknowledged', resultRef: 'lifecycle-provider-result' };
  },
  outcomeRecorder,
  lifecycleStore,
);
const lifecycleResult = await lifecycleCoordinator.execute(lifecycleOperation);
assert.deepEqual(lifecycleResult, { executed: true, decision: 'allow', outcome: { outcome: 'acknowledged', resultRef: 'lifecycle-provider-result', occurredAt: lifecycleResult.outcome?.occurredAt } });
assert.equal(lifecycleHandlerEntries, 1);
assert.equal(await psql(`select state || '|' || attempt_count from operations.operations where id = '${lifecycleOperationId}'`), 'acknowledged|1');
assert.equal(await psql(`select count(*) from operations.execution_outcomes where operation_id = '${lifecycleOperationId}'`), '1');
const lifecycleRetry = await lifecycleCoordinator.execute({ ...lifecycleOperation, state: 'acknowledged', attemptCount: 1 });
assert.equal(lifecycleRetry.executed, true);
assert.equal(lifecycleRetry.outcome?.outcome, 'acknowledged');
assert.equal(lifecycleRetry.outcome?.resultRef, 'lifecycle-provider-result');
assert.equal(lifecycleHandlerEntries, 1, 'duplicate lifecycle request must not re-enter provider handler');
await psql(`delete from operations.execution_outbox where operation_id = '${lifecycleOperationId}';\ndelete from operations.execution_outcomes where operation_id = '${lifecycleOperationId}';\ndelete from operations.operations where id = '${lifecycleOperationId}';`);
console.log('PostgreSQL lifecycle-before-reservation and duplicate non-replay assertions passed.');


// Full Research vertical slice using the real PostgreSQL operation/query/outcome adapters.
const researchQueryId = '00000000-0000-0000-0000-0000000000f5';
await psql(`
delete from operations.execution_outbox where operation_id in (select id from operations.operations where idempotency_key = '${researchQueryId}');
delete from operations.execution_outcomes where operation_id in (select id from operations.operations where idempotency_key = '${researchQueryId}');
delete from operations.operations where idempotency_key = '${researchQueryId}';
delete from core.research_query_requests where id = '${researchQueryId}';
`);
const researchQuery: ResearchQuery = {
  queryId: researchQueryId, intent: 'discover', text: 'Pattanam archaeology',
  concepts: ['archaeology'], filters: { region: 'Kerala' }, sort: ['relevance'], pageSize: 10,
  requestedFields: ['title'], requesterIdentityId: identityId, organisationId, purpose: 'research-e2e',
};
const researchStore = new PostgresResearchQueryStore({
  async query<T>(text: string, values: readonly unknown[] = []) {
    return { rows: await db.query<T & Record<string, unknown>>(text, values) };
  },
});
const realOperationStore = new PostgresOperationStore(db);
const realResearchProvider = {
  providerId: 'e2e-fixture', adapterVersion: '1',
  async search(query: ResearchQuery) {
    researchProviderCalls += 1;
    return { queryId: query.queryId, providerId: 'e2e-fixture', providerQueryReference: 'e2e:research-result-5', retrievedAt: new Date().toISOString(), results: [], partial: false, warnings: [] };
  },
};
let researchProviderCalls = 0;
const buildResearchOperation = () => new ResearchOperation(researchStore, realResearchProvider, {
  authorization: { authorize: async () => true },
  reservation,
  operationStore: realOperationStore,
  outcomeRecorder,
});
const researchFirst = await buildResearchOperation().execute(researchQuery);
const canonicalResearchOperationId = await psql(`select id from operations.operations where idempotency_key = '${researchQueryId}'`);
assert.equal(researchFirst.operationId, canonicalResearchOperationId, 'PostgreSQL create-or-get must return the persisted canonical operation ID');
assert.equal(researchFirst.state, 'acknowledged');
assert.equal(researchFirst.resultRef, 'e2e:research-result-5');
assert.equal(researchProviderCalls, 1);
const researchRetry = await buildResearchOperation().execute({ ...researchQuery });
assert.equal(researchRetry.operationId, researchFirst.operationId);
assert.equal(researchRetry.resultRef, researchFirst.resultRef);
assert.equal(researchProviderCalls, 1, 'fresh ResearchOperation instance must replay durable result without a second provider call');
await assert.rejects(
  () => buildResearchOperation().execute({ ...researchQuery, text: 'changed payload must conflict' }),
  /research_query_id_conflict/,
);
assert.equal(researchProviderCalls, 1, 'changed payload must fail before provider execution');
assert.equal(await psql(`select state || '|' || attempt_count from operations.operations where id = '${canonicalResearchOperationId}'`), 'acknowledged|1');
assert.equal(await psql(`select count(*) from operations.execution_outcomes where operation_id = '${canonicalResearchOperationId}'`), '1');
await psql(`
delete from operations.execution_outbox where operation_id in (select id from operations.operations where idempotency_key = '${researchQueryId}');
delete from operations.execution_outcomes where operation_id in (select id from operations.operations where idempotency_key = '${researchQueryId}');
delete from operations.operations where idempotency_key = '${researchQueryId}';
delete from core.research_query_requests where id = '${researchQueryId}';
`);
console.log('PostgreSQL Research idempotent replay and payload-conflict E2E assertions passed.');
