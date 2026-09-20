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

const ids = {
  operation: '00000000-0000-0000-0000-0000000000f4',
  request: '00000000-0000-0000-0000-0000000000f5',
  organisation: '00000000-0000-0000-0000-0000000000c1',
  identity: '00000000-0000-0000-0000-0000000000c2',
  authUser: '00000000-0000-0000-0000-0000000000c3',
  resource: '00000000-0000-0000-0000-0000000000d4',
  source: '00000000-0000-0000-0000-0000000000d5',
  outsider: '00000000-0000-0000-0000-0000000000c4',
  outsiderAuth: '00000000-0000-0000-0000-0000000000c5',
};

async function psql(sql: string): Promise<string> {
  const result = await execFileAsync('psql', [
    '--dbname', dbUrl, '-v', 'ON_ERROR_STOP=1', '-X', '-At', '-F', '\t', '-c', sql,
  ]);
  return result.stdout.trim();
}

await psql(`
insert into auth.users(id) values ('${ids.authUser}') on conflict do nothing;
insert into core.organisations(id,name,slug) values ('${ids.organisation}','Evidence E2E','evidence-e2e') on conflict (id) do nothing;
insert into core.identities(id,auth_user_id,display_name) values ('${ids.identity}','${ids.authUser}','Evidence E2E Identity') on conflict (id) do nothing;
insert into core.identity_organisation_memberships(identity_id,organisation_id,membership_role) values ('${ids.identity}','${ids.organisation}','member') on conflict do nothing;
insert into auth.users(id) values ('${ids.outsiderAuth}') on conflict do nothing;
insert into core.identities(id,auth_user_id,display_name) values ('${ids.outsider}','${ids.outsiderAuth}','Evidence E2E Outsider') on conflict (id) do nothing;
insert into core.resources(id,organisation_id,resource_type,title,epistemic_status,sensitivity) values ('${ids.resource}','${ids.organisation}','research','Evidence E2E Resource','documented','public') on conflict (id) do nothing;
insert into core.resource_memberships(resource_id,identity_id,membership_role) values ('${ids.resource}','${ids.identity}','owner') on conflict do nothing;
insert into core.sources(id,organisation_id,source_type,title,sensitivity) values ('${ids.source}','${ids.organisation}','field_note','Evidence E2E Source','public') on conflict (id) do nothing;
delete from core.evidence_annotation_requests where id = '${ids.request}';
delete from operations.execution_outbox where operation_id = '${ids.operation}';
delete from operations.execution_outcomes where operation_id = '${ids.operation}';
delete from operations.operations where id = '${ids.operation}';
insert into core.evidence_annotation_requests(id,organisation_id,identity_id,resource_id,source_id,evidence_type,excerpt,evidence_payload,sensitivity)
values ('${ids.request}','${ids.organisation}','${ids.identity}','${ids.resource}','${ids.source}','field_observation','authenticated annotation','{"test":true}','controlled');
insert into operations.operations(id,organisation_id,identity_id,idempotency_key,action,resource_id,purpose,expires_at,payload_ref)
values ('${ids.operation}','${ids.organisation}','${ids.identity}','evidence-annotation-e2e','annotate','${ids.resource}','evidence annotation e2e',clock_timestamp()+interval '10 minutes','${ids.request}');
`);

await psql(`
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','${ids.authUser}',true);
select set_config('app.identity_id','${ids.identity}',true);
select set_config('app.organisation_id','${ids.organisation}',true);
select operations.transition('${ids.operation}','created','authorized');
select operations.transition('${ids.operation}','authorized','queued');
commit;
`);

const db = {
  async query<T extends Record<string, unknown>>(sql: string, params: readonly unknown[]) {
    const id = String(params[0]).replaceAll("'", "''");
    const auth = `begin; set local role authenticated;
select set_config('request.jwt.claim.sub','${ids.authUser}',true);
select set_config('app.identity_id','${ids.identity}',true);
select set_config('app.organisation_id','${ids.organisation}',true);`;
    if (sql.includes('core.authorize_capability')) {
      const action = String(params[0]).replaceAll("'", "''");
      const resource = params[1] === null ? 'null' : `'${String(params[1])}'::uuid`;
      const purpose = String(params[2]).replaceAll("'", "''");
      const out = await psql(`${auth}
select allowed::text || '|' || decision from core.authorize_capability('${action}',${resource},'${purpose}');
rollback;`);
      const [allowed, decision] = out.split('\n').filter(Boolean).at(-2)?.split('|') ?? ['', ''];
      return [{ allowed: allowed === 'true', decision }] as T[];
    }
    if (sql.includes('core_private.consume_evidence_annotation_request')) {
      const out = await psql(`${auth}
select evidence_id::text || '|' || decision from core_private.consume_evidence_annotation_request('${id}'::uuid);
commit;`);
      const [evidenceId, decision] = out.split('\n').filter(Boolean).at(-2)?.split('|') ?? ['', ''];
      return [{ evidence_id: evidenceId, decision }] as T[];
    }
    if (sql.includes('operations.record_execution_outcome')) {
      const [operationId, attempt, outcome, errorCode, resultRef, resultHash, occurredAt] = params;
      const esc = (v: unknown) => v == null ? 'null' : `'${String(v).replaceAll("'", "''")}'`;
      const out = await psql(`${auth}
select recorded::text || '|' || decision from operations.record_execution_outcome('${operationId}'::uuid,${Number(attempt)},${esc(outcome)},${esc(errorCode)},${esc(resultRef)},${esc(resultHash)},${esc(occurredAt)}::timestamptz);
commit;`);
      const [recorded, decision] = out.split('\n').filter(Boolean).at(-2)?.split('|') ?? ['', ''];
      return [{ recorded: recorded === 'true', decision }] as T[];
    }
    const out = await psql(`${auth}
select allowed::text || '|' || decision || '|' || coalesce(attempt_count::text,'null') from operations.reserve_execution('${id}'::uuid);
commit;`);
    const [allowed, decision, attempt] = out.split('\n').filter(Boolean).at(-2)?.split('|') ?? ['', '', ''];
    return [{ allowed: allowed === 'true', decision, attempt_count: Number(attempt) }] as T[];
  },
};

let handlerEntries = 0;
const coordinator = new ExecutionCoordinator(
  new PostgresCoreAuthorization(db),
  new PostgresExecutionReservation(db),
  async operation => {
    handlerEntries++;
    const rows = await db.query<{ evidence_id: string; decision: string }>(
      'select evidence_id, decision from core_private.consume_evidence_annotation_request($1::uuid)',
      [operation.payloadRef],
    );
    assert.equal(rows[0]?.decision, 'created');
    return { outcome: 'acknowledged', resultRef: rows[0]?.evidence_id };
  },
  new PostgresExecutionOutcomeRecorder(db),
);

const adapter = new PostgresCoreAuthorization(db);
const adapterDecision = await adapter.authorize({ operationId: ids.operation, idempotencyKey: 'evidence-annotation-e2e', action: 'annotate', resourceId: ids.resource, purpose: 'evidence annotation e2e', state: 'queued', createdAt: new Date().toISOString(), attemptCount: 0, payloadRef: ids.request });
console.log('Evidence Annotation adapter authorization:', adapterDecision);
const preflight = await psql(`
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','${ids.authUser}',true);
select set_config('app.identity_id','${ids.identity}',true);
select set_config('app.organisation_id','${ids.organisation}',true);
select coalesce(core.current_identity_id()::text,'null') || '|' ||
       coalesce(core.current_organisation_id()::text,'null') || '|' ||
       coalesce((select allowed from core.authorize_capability('annotate','${ids.resource}'::uuid,'evidence annotation e2e') limit 1)::text,'null') || '|' ||
       coalesce((select decision from core.authorize_capability('annotate','${ids.resource}'::uuid,'evidence annotation e2e') limit 1),'null');
rollback;`);
console.log('Evidence Annotation preflight:', preflight);
const result = await coordinator.execute({
  operationId: ids.operation, idempotencyKey: 'evidence-annotation-e2e',
  action: 'annotate', resourceId: ids.resource, purpose: 'evidence annotation e2e',
  state: 'queued', createdAt: new Date().toISOString(), attemptCount: 0,
  payloadRef: ids.request,
});

console.log('Evidence Annotation execution result:', JSON.stringify(result));
console.log('Evidence Annotation handler entries:', handlerEntries);
assert.equal(result.executed, true);
assert.equal(handlerEntries, 1);
assert.equal(await psql(`select state || '|' || attempt_count from operations.operations where id='${ids.operation}'`), 'acknowledged|1');
assert.equal(await psql(`select status from core.evidence_annotation_requests where id='${ids.request}'`), 'consumed');
assert.equal(await psql(`select count(*) from core.evidence where source_id='${ids.source}' and resource_id='${ids.resource}'`), '1');
assert.equal(await psql(`select count(*) from operations.execution_outcomes where operation_id='${ids.operation}'`), '1');
assert.equal(await psql(`select count(*) from operations.execution_outbox where operation_id='${ids.operation}'`), '1');

const outsiderRead = await psql(`\nbegin;\nset local role authenticated;\nselect set_config('request.jwt.claim.sub','${ids.outsiderAuth}',true);\nselect set_config('app.identity_id','${ids.outsider}',true);\nselect set_config('app.organisation_id','${ids.organisation}',true);\nselect count(*)::text as evidence_count from core.evidence\n where source_id = '${ids.source}' and resource_id = '${ids.resource}';\nrollback;`);\nconst outsiderRows = outsiderRead.split('\\n').map(line => line.trim()).filter(line => /^[0-9]+$/.test(line));\nassert.equal(outsiderRows[outsiderRows.length - 1], '0');\n\nconst directMutation = await psql(`
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','${ids.authUser}',true);
select set_config('app.identity_id','${ids.identity}',true);
select set_config('app.organisation_id','${ids.organisation}',true);
do $$ begin
  insert into core.evidence(source_id,resource_id,evidence_type) values ('${ids.source}','${ids.resource}','bypass');
  raise exception 'direct evidence mutation unexpectedly succeeded';
exception when insufficient_privilege then null;
end $$;
rollback;`);
assert.equal(directMutation, '');
await psql(`delete from operations.execution_outbox where operation_id='${ids.operation}'; delete from operations.execution_outcomes where operation_id='${ids.operation}'; delete from operations.operations where id='${ids.operation}'; delete from core.evidence where source_id='${ids.source}' and resource_id='${ids.resource}';`);
console.log('Evidence Annotation PostgreSQL E2E assertions passed.');
