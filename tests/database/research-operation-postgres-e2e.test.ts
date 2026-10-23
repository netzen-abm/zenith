import { strict as assert } from 'node:assert';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { ResearchOperation } from '../../packages/capabilities/src/research-operation.ts';
import type { ResearchQuery, ResearchProvider } from '../../packages/capabilities/src/research-intelligence.ts';
import { PostgresResearchQueryStore } from '../../packages/adapters/src/research/postgres-repository.ts';
import { PostgresCoreAuthorization } from '../../packages/operation-queue/src/postgres-core-authorization.ts';
import { PostgresExecutionReservation } from '../../packages/operation-queue/src/postgres-execution-reservation.ts';
import { PostgresExecutionOutcomeRecorder } from '../../packages/operation-queue/src/postgres-execution-outcome-recorder.ts';
import type { ExecutionOutcomeRecorder } from '../../packages/operation-queue/src/execution-coordinator.ts';
import { PostgresOperationStore } from '../../packages/operation-queue/src/postgres-operation-store.ts';

const execFileAsync = promisify(execFile);
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required');

const organisationId = '00000000-0000-0000-0000-0000000004a1';
const identityId = '00000000-0000-0000-0000-0000000004a2';
const authUserId = '00000000-0000-0000-0000-0000000004a3';
const successfulQueryId = '00000000-0000-0000-0000-0000000004a4';
const ambiguousQueryId = '00000000-0000-0000-0000-0000000004a5';

async function psql(sql: string): Promise<string> {
  const result = await execFileAsync('psql', [
    '--dbname', databaseUrl, '-v', 'ON_ERROR_STOP=1', '-X', '-At', '-F', '\\t', '-c', sql,
  ]);
  return result.stdout.trim();
}

function literal(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return "'" + String(value).replaceAll("'", "''") + "'";
}

function contextSql(statement: string): string {
  return `begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','${authUserId}',true);
select set_config('app.identity_id','${identityId}',true);
select set_config('app.organisation_id','${organisationId}',true);
${statement}
commit;`;
}

function jsonRow(output: string): Record<string, unknown>[] {
  const line = output.split(/\r?\n/).map(value => value.trim()).find(value => value.startsWith('{'));
  return line ? [JSON.parse(line) as Record<string, unknown>] : [];
}

const db = {
  async query<T extends Record<string, unknown>>(sql: string, params: readonly unknown[]): Promise<T[]> {
    if (sql.includes('core.authorize_capability')) {
      const action = literal(params[0]);
      const resourceId = params[1] == null ? 'null::uuid' : `${literal(params[1])}::uuid`;
      const purpose = literal(params[2]);
      const output = await psql(contextSql(`select allowed::text || '|' || decision
        from core.authorize_capability(${action},${resourceId},${purpose});`));
      const line = output.split(/\r?\n/).find(value => value.startsWith('true|') || value.startsWith('false|'));
      if (!line) throw new Error(`research_e2e_authorization_result_missing:${output}`);
      const [allowed, decision] = line.split('|');
      return [{ allowed: allowed === 'true', decision }] as T[];
    }

    if (sql.includes('operations.create_or_get_with_payload_hash')) {
      const [operationId, orgId, key, action, identity, purpose, expiresAt, resourceId, payloadRef, payloadIdentity] = params;
      const statement = `select row_to_json(t)::text from (
        select * from operations.create_or_get_with_payload_hash(
          ${literal(operationId)}::uuid,${literal(orgId)}::uuid,${literal(key)},${literal(action)},
          ${literal(identity)}::uuid,${literal(purpose)},${literal(expiresAt)}::timestamptz,
          ${literal(resourceId)}::uuid,${literal(payloadRef)},${literal(payloadIdentity)}::jsonb
        )
      ) t;`;
      return jsonRow(await psql(contextSql(statement))) as T[];
    }

    if (sql.includes('operations.transition')) {
      const [operationId, expected, next] = params;
      const statement = `select operations.transition(${literal(operationId)}::uuid,${literal(expected)},${literal(next)});`;
      await psql(contextSql(statement));
      return [{ transition: 'ok' }] as T[];
    }

    if (sql.includes('operations.reserve_execution')) {
      const [operationId] = params;
      const output = await psql(contextSql(`select allowed::text || '|' || decision || '|' || coalesce(attempt_count::text,'null')
        from operations.reserve_execution(${literal(operationId)}::uuid);`));
      const line = output.split(/\r?\n/).find(value => value.startsWith('true|') || value.startsWith('false|'));
      if (!line) throw new Error(`research_e2e_reservation_result_missing:${output}`);
      const [allowed, decision, attemptCount] = line.split('|');
      return [{ allowed: allowed === 'true', decision, ...(attemptCount !== 'null' ? { attempt_count: Number(attemptCount) } : {}) }] as T[];
    }

    if (sql.includes('operations.record_execution_outcome')) {
      const [operationId, attempt, outcome, errorCode, resultRef, resultHash, occurredAt] = params;
      const output = await psql(contextSql(`select recorded::text || '|' || decision
        from operations.record_execution_outcome(
          ${literal(operationId)}::uuid,${Number(attempt)},${literal(outcome)},${literal(errorCode)},
          ${literal(resultRef)},${literal(resultHash)},${literal(occurredAt)}::timestamptz
        );`));
      const line = output.split(/\r?\n/).find(value => value.startsWith('true|') || value.startsWith('false|'));
      if (!line) throw new Error(`research_e2e_outcome_record_result_missing:${output}`);
      const [recorded, decision] = line.split('|');
      return [{ recorded: recorded === 'true', decision }] as T[];
    }

    if (sql.includes('from operations.execution_outcomes')) {
      const [operationId] = params;
      const output = await psql(contextSql(`select row_to_json(t)::text from (
        select outcome,error_code,result_ref,result_hash,occurred_at::text as occurred_at
          from operations.execution_outcomes
         where operation_id = ${literal(operationId)}::uuid
         order by attempt_count desc limit 1
      ) t;`));
      return jsonRow(output) as T[];
    }

    if (sql.startsWith('insert into core.research_query_requests')) {
      const v = params;
      const statement = `insert into core.research_query_requests
        (id,organisation_id,identity_id,research_question_id,intent,query_text,concepts,filters,sort,
         page_size,cursor,requested_fields,open_access_required,purpose)
        values (${literal(v[0])}::uuid,${literal(v[1])}::uuid,${literal(v[2])}::uuid,${literal(v[3])}::uuid,
         ${literal(v[4])},${literal(v[5])},${literal(v[6])}::jsonb,${literal(v[7])}::jsonb,${literal(v[8])}::jsonb,
         ${Number(v[9])},${literal(v[10])},${literal(v[11])}::jsonb,${literal(v[12])},${literal(v[13])})
        returning id;`;
      const output = await psql(contextSql(`with inserted as (${statement.replace(/;$/, '')}) select row_to_json(inserted)::text from inserted;`));
      return jsonRow(output) as T[];
    }

    if (sql.includes('from core.research_query_requests')) {
      const [id, orgId] = params;
      const output = await psql(contextSql(`select row_to_json(t)::text from (
        select id,research_question_id,intent,query_text,concepts,filters,sort,page_size,cursor,
               requested_fields,open_access_required,identity_id as requester_identity_id,organisation_id,purpose
          from core.research_query_requests
         where id = ${literal(id)}::uuid and organisation_id = ${literal(orgId)}::uuid
         limit 1
      ) t;`));
      return jsonRow(output) as T[];
    }

    throw new Error(`research_e2e_unhandled_sql:${sql}`);
  },
};

const queryStore = new PostgresResearchQueryStore({
  async query<T>(sql: string, values: readonly unknown[] = []) {
    return { rows: await db.query<T & Record<string, unknown>>(sql, values) };
  },
});
const operationStore = new PostgresOperationStore(db);
const authorization = new PostgresCoreAuthorization(db);
const reservation = new PostgresExecutionReservation(db);
const durableRecorder = new PostgresExecutionOutcomeRecorder(db);

await psql(`
insert into auth.users(id) values ('${authUserId}') on conflict do nothing;
insert into core.organisations(id,name,slug)
 values ('${organisationId}','Research Persistence E2E','research-persistence-e2e') on conflict (id) do nothing;
insert into core.identities(id,auth_user_id,display_name)
 values ('${identityId}','${authUserId}','Research Persistence E2E Identity') on conflict (id) do nothing;
insert into core.identity_organisation_memberships(identity_id,organisation_id,membership_role)
 values ('${identityId}','${organisationId}','member') on conflict (identity_id,organisation_id) do nothing;
`);
await psql(`
delete from operations.execution_outbox
 where operation_id in (select id from operations.operations where organisation_id = '${organisationId}' and idempotency_key in ('${successfulQueryId}','${ambiguousQueryId}'));
delete from operations.execution_outcomes
 where operation_id in (select id from operations.operations where organisation_id = '${organisationId}' and idempotency_key in ('${successfulQueryId}','${ambiguousQueryId}'));
delete from core.research_query_requests where organisation_id = '${organisationId}' and id in ('${successfulQueryId}','${ambiguousQueryId}');
delete from operations.operations where organisation_id = '${organisationId}' and idempotency_key in ('${successfulQueryId}','${ambiguousQueryId}');
`);

function query(id: string, text = 'Pattanam'): ResearchQuery {
  return {
    queryId: id,
    intent: 'discover',
    text,
    concepts: ['trade'],
    filters: { region: 'Kerala', period: { start: 1, end: 100 } },
    sort: ['date'],
    pageSize: 10,
    requestedFields: ['title'],
    openAccessRequired: true,
    requesterIdentityId: identityId,
    organisationId,
    purpose: 'research E2E',
  };
}

const providerCalls = new Map<string, number>();
const provider: ResearchProvider = {
  providerId: 'fixture-research-provider',
  adapterVersion: 'e2e-1',
  async search(request) {
    providerCalls.set(request.queryId, (providerCalls.get(request.queryId) ?? 0) + 1);
    return {
      queryId: request.queryId,
      providerId: this.providerId,
      providerQueryReference: `fixture:${request.queryId}`,
      retrievedAt: new Date().toISOString(),
      results: [],
      partial: false,
      warnings: [],
    };
  },
};

function newOperation(recorder: ExecutionOutcomeRecorder = durableRecorder): ResearchOperation {
  return new ResearchOperation(queryStore, provider, { authorization, reservation, outcomeRecorder: recorder, operationStore });
}

const first = await newOperation().execute(query(successfulQueryId));
assert.equal(first.state, 'acknowledged');
assert.equal(first.resultRef, `fixture:${successfulQueryId}`);
assert.equal(providerCalls.get(successfulQueryId), 1);

const reorderedQuery = query(successfulQueryId);
reorderedQuery.filters = { period: { end: 100, start: 1 }, region: 'Kerala' };
const replayed = await newOperation().execute(reorderedQuery);
assert.equal(replayed.operationId, first.operationId);
assert.equal(replayed.resultRef, first.resultRef);
assert.equal(providerCalls.get(successfulQueryId), 1, 'durable replay must not call the provider again');

await assert.rejects(
  () => newOperation().execute(query(successfulQueryId, 'changed question under the same idempotency key')),
  /operation_idempotency_conflict/,
);
assert.equal(providerCalls.get(successfulQueryId), 1, 'changed payload must be rejected before provider execution');

let failOutcomeOnce = true;
const interruptedRecorder: ExecutionOutcomeRecorder = {
  async record(operation, outcome) {
    if (failOutcomeOnce) {
      failOutcomeOnce = false;
      throw new Error('simulated_research_outcome_persistence_interruption');
    }
    return durableRecorder.record(operation, outcome);
  },
  findLatest(operationId) {
    return durableRecorder.findLatest(operationId);
  },
};
await assert.rejects(
  () => newOperation(interruptedRecorder).execute(query(ambiguousQueryId)),
  /simulated_research_outcome_persistence_interruption/,
);
assert.equal(providerCalls.get(ambiguousQueryId), 1);

const unresolved = await psql(`
select o.state || '|' || o.attempt_count || '|' ||
       (select count(*) from operations.execution_outcomes eo where eo.operation_id = o.id) || '|' ||
       (select count(*) from operations.execution_outbox ob where ob.operation_id = o.id)
  from operations.operations o
 where o.organisation_id = '${organisationId}' and o.idempotency_key = '${ambiguousQueryId}';
`);
assert.equal(unresolved, 'in_flight|1|0|0');

await assert.rejects(
  () => newOperation(interruptedRecorder).execute(query(ambiguousQueryId)),
  /research_not_executed:deny_reservation/,
);
assert.equal(providerCalls.get(ambiguousQueryId), 1, 'ambiguous provider result must not be blindly retried');

const finalAmbiguous = await psql(`
select o.state || '|' || o.attempt_count || '|' ||
       (select count(*) from operations.execution_outcomes eo where eo.operation_id = o.id) || '|' ||
       (select count(*) from operations.execution_outbox ob where ob.operation_id = o.id)
  from operations.operations o
 where o.organisation_id = '${organisationId}' and o.idempotency_key = '${ambiguousQueryId}';
`);
assert.equal(finalAmbiguous, 'in_flight|1|0|0');

await psql(`
delete from operations.execution_outbox
 where operation_id in (select id from operations.operations where organisation_id = '${organisationId}' and idempotency_key in ('${successfulQueryId}','${ambiguousQueryId}'));
delete from operations.execution_outcomes
 where operation_id in (select id from operations.operations where organisation_id = '${organisationId}' and idempotency_key in ('${successfulQueryId}','${ambiguousQueryId}'));
delete from core.research_query_requests where organisation_id = '${organisationId}' and id in ('${successfulQueryId}','${ambiguousQueryId}');
delete from operations.operations where organisation_id = '${organisationId}' and idempotency_key in ('${successfulQueryId}','${ambiguousQueryId}');
`);

console.log('Research PostgreSQL idempotency, durable replay, payload conflict, and ambiguous-outcome E2E: PASS');
