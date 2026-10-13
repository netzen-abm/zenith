import { strict as assert } from 'node:assert';
import { SpaceTimeOperation } from './space-time-operation.ts';
import type { OperationEnvelope } from '../../contracts/src/operation.ts';
import { PostgresSpaceTimeRequestRepository } from '../../adapters/src/space-time/postgres-repository.ts';

const calls: string[] = [];
const requestRows = new Map<string, { payloadHash: string; representationId?: string }>();
const outcomes = new Map<string, { outcome: string; resultRef?: string }>();
const db = {
  transaction: async <T>(work: (db: { query: <R extends Record<string, unknown>>(sql: string, params: readonly unknown[]) => Promise<R[]> }) => Promise<T>) =>
    work({ query: async <R extends Record<string, unknown>>(sql: string, params: readonly unknown[]) => {
      calls.push(sql);
      if (sql.includes('insert into core.space_time_representation_requests')) {
        const [id, , , , , , , , , hash] = params;
        const existing = requestRows.get(String(id));
        if (existing && existing.payloadHash !== hash) return [] as R[];
        requestRows.set(String(id), { payloadHash: String(hash) });
        return [{ id: String(id) }] as R[];
      }
      if (sql.includes('select state from operations.operations')) return [{ state: 'created' }] as R[];
      if (sql.includes('consume_space_time_representation_request')) {
        const id = String(params[0]);
        const row = requestRows.get(id);
        if (!row) return [] as R[];
        if (row.representationId) return [{ representation_id: row.representationId, decision: 'created' }] as R[];
        row.representationId = 'spatial-1';
        return [{ representation_id: 'spatial-1', decision: 'created' }] as R[];
      }
      if (sql.includes('select eo.outcome')) {
        const outcome = outcomes.get(String(params[0]));
        return outcome ? [{ outcome: outcome.outcome, result_ref: outcome.resultRef ?? null, result_hash: null }] as R[] : [] as R[];
      }
      return [] as R[];
    } }),
};
const operations = new Map<string, OperationEnvelope & { contentHash?: string }>();
const context = {
  organisationId: 'org-1', identityId: 'identity-1', purpose: 'research',
  authorization: { authorize: async () => true },
  reservation: { reserve: async (id: string) => {
    const operation = [...operations.values()].find(item => item.operationId === id);
    if (operation?.state === 'acknowledged') return { allowed: false, decision: 'deny_state' };
    return { allowed: true, decision: 'allow', attemptCount: 1 };
  } },
  outcomeRecorder: { record: async (operation: OperationEnvelope, outcome: { outcome: string; resultRef?: string }) => {
    outcomes.set(operation.operationId, outcome);
    if (operation) operations.set(operation.idempotencyKey, { ...operation, state: outcome.outcome === 'acknowledged' ? 'acknowledged' : 'conflict' });
    return { recorded: true, decision: 'recorded' };
  } },
  operationStore: {
    createOrGet: async (input: {
      operationId: string; idempotencyKey: string; action: string; organisationId: string;
      identityId: string; purpose: string; expiresAt: string; payloadRef?: string;
      payloadHash?: string; resourceId?: string;
    }) => {
      const existing = operations.get(input.idempotencyKey);
      if (existing) {
        if (existing.contentHash !== input.payloadHash || existing.resourceId !== input.resourceId) {
          throw new Error('operation_idempotency_conflict');
        }
        return { created: false, operation: existing };
      }
      const operation: OperationEnvelope & { contentHash?: string } = {
        operationId: input.operationId, idempotencyKey: input.idempotencyKey, action: input.action,
        organisationId: input.organisationId, identityId: input.identityId, purpose: input.purpose,
        resourceId: input.resourceId, state: 'created', createdAt: new Date().toISOString(),
        expiresAt: input.expiresAt, attemptCount: 0, payloadRef: input.payloadRef,
        contentHash: input.payloadHash,
      };
      operations.set(input.idempotencyKey, operation);
      return { created: true, operation };
    },
  },
};
const repository = new PostgresSpaceTimeRequestRepository(db);
const spaceTime = new SpaceTimeOperation(repository, context);
const request = {
  idempotencyKey: 'field-survey-2026-001',
  resourceId: 'site-1',
  representationType: 'point',
  precisionLevel: 'generalized',
  coordinateConfidence: 0.8,
  geom: 'POINT(10 20)',
};
const first = await spaceTime.execute(request);
assert.equal(first.state, 'acknowledged');
assert.equal(first.resultRef, 'spatial-1');
assert.ok(calls.some(sql => sql.includes('consume_space_time_representation_request')));
assert.ok(!calls.some(sql => /insert into operations\.operations/i.test(sql)));
assert.ok(!calls.some(sql => /insert into core\.spatial_representations/i.test(sql)));

const replay = await spaceTime.execute(request);
assert.equal(replay.operationId, first.operationId);
assert.equal(replay.resultRef, 'spatial-1');

await assert.rejects(
  () => spaceTime.execute({ ...request, geom: 'POINT(11 21)' }),
  /operation_idempotency_conflict/,
);
assert.equal([...outcomes.values()].filter(value => value.outcome === 'acknowledged').length, 1);
console.log('space-time-operation: PASS');
