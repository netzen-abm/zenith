import { strict as assert } from 'node:assert';
import { PostgresExecutionOutcomeRecorder } from './postgres-execution-outcome-recorder.ts';
import type { OperationEnvelope } from '../../contracts/src/operation.ts';

const calls: Array<{ sql: string; params: readonly unknown[] }> = [];
const recorder = new PostgresExecutionOutcomeRecorder({
  async query<T extends Record<string, unknown>>(sql: string, params: readonly unknown[]) {
    calls.push({ sql, params });
    if (sql.includes('record_execution_outcome')) {
      return [{ recorded: true, decision: 'recorded' }] as T[];
    }
    return [{
      attempt_count: 1,
      outcome: 'acknowledged',
      error_code: null,
      result_ref: 'provider:research-42',
      result_hash: 'sha256:result-hash',
      occurred_at: '2026-10-15T08:00:00.000Z',
    }] as T[];
  },
});

const operation: OperationEnvelope = {
  operationId: '00000000-0000-0000-0000-000000000001',
  idempotencyKey: 'research-query-42',
  action: 'research.query',
  organisationId: '00000000-0000-0000-0000-000000000002',
  identityId: '00000000-0000-0000-0000-000000000003',
  purpose: 'research',
  state: 'in_flight',
  createdAt: '2026-10-15T08:00:00.000Z',
  attemptCount: 1,
};

const recorded = await recorder.record(operation, {
  outcome: 'acknowledged',
  resultRef: 'provider:research-42',
  resultHash: 'sha256:result-hash',
});
assert.deepEqual(recorded, { recorded: true, decision: 'recorded' });
assert.match(calls[0].sql, /operations\.record_execution_outcome/);

const recovered = await recorder.findLatest(operation.operationId);
assert.deepEqual(recovered, {
  attemptCount: 1,
  outcome: 'acknowledged',
  resultRef: 'provider:research-42',
  resultHash: 'sha256:result-hash',
  occurredAt: '2026-10-15T08:00:00.000Z',
});
assert.match(calls[1].sql, /attempt_count, outcome, error_code, result_ref, result_hash, occurred_at/);
assert.match(calls[1].sql, /operations\.execution_outcomes/);
assert.deepEqual(calls[1].params, [operation.operationId]);
