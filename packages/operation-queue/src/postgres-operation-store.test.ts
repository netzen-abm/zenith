import { strict as assert } from 'node:assert';
import { PostgresOperationStore } from './postgres-operation-store.ts';

const calls: Array<{ sql: string; params: readonly unknown[] }> = [];
const store = new PostgresOperationStore({
  async query<T extends Record<string, unknown>>(sql: string, params: readonly unknown[]) {
    calls.push({ sql, params });
    return [{
      created: false,
      operation_id: 'canonical-op',
      organisation_id: 'org-1',
      idempotency_key: 'research-query-1',
      action: 'research.query',
      identity_id: 'identity-1',
      purpose: 'research',
      state: 'in_flight',
      created_at: '2026-10-12T00:00:00.000Z',
      expires_at: '2026-10-13T00:00:00.000Z',
      attempt_count: 1,
      payload_ref: 'query-1',
    }] as T[];
  },
});

const result = await store.createOrGet({
  operationId: 'candidate-op',
  organisationId: 'org-1',
  idempotencyKey: 'research-query-1',
  action: 'research.query',
  identityId: 'identity-1',
  purpose: 'research',
  expiresAt: '2026-10-13T00:00:00.000Z',
  payloadRef: 'query-1',
});
assert.equal(result.created, false);
assert.equal(result.operation.operationId, 'canonical-op');
assert.equal(result.operation.organisationId, 'org-1');
assert.equal(result.operation.state, 'in_flight');
assert.equal(result.operation.attemptCount, 1);
assert.match(calls[0].sql, /operations\.create_or_get/);
assert.equal(calls[0].params[1], 'org-1');


await store.transition('canonical-op', 'created', 'authorized');
assert.match(calls[1].sql, /operations\.transition/);
assert.deepEqual(calls[1].params, ['canonical-op', 'created', 'authorized']);
