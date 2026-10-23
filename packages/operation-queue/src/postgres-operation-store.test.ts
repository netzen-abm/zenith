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


// Research payloads have no resource_id, but still require the same durable
// tenant-scoped payload hash before execution admission.
const researchHashCalls: Array<{ sql: string; params: readonly unknown[] }> = [];
const researchQueryId = '00000000-0000-0000-0000-0000000004a4';
const researchPayloadIdentity = {
  action: 'research.query',
  organisationId: '00000000-0000-0000-0000-0000000004a1',
  identityId: '00000000-0000-0000-0000-0000000004a2',
  purpose: 'research E2E',
  resourceId: null,
  queryId: researchQueryId,
  intent: 'discover',
  text: 'Pattanam',
  concepts: [],
  filters: {},
  sort: [],
  pageSize: 10,
  cursor: null,
  requestedFields: [],
  openAccessRequired: false,
};
const researchHashStore = new PostgresOperationStore({
  async query<T extends Record<string, unknown>>(sql: string, params: readonly unknown[]) {
    researchHashCalls.push({ sql, params });
    return [{
      created: true,
      operation_id: '00000000-0000-0000-0000-0000000004a5',
      organisation_id: '00000000-0000-0000-0000-0000000004a1',
      idempotency_key: researchQueryId,
      action: 'research.query',
      identity_id: '00000000-0000-0000-0000-0000000004a2',
      purpose: 'research E2E',
      state: 'created',
      created_at: '2026-10-23T00:00:00.000Z',
      expires_at: '2026-10-24T00:00:00.000Z',
      attempt_count: 0,
      payload_ref: researchQueryId,
      payload_hash: 'a'.repeat(64),
    }] as T[];
  },
});
const researchHashed = await researchHashStore.createOrGet({
  operationId: '00000000-0000-0000-0000-0000000004a5',
  organisationId: '00000000-0000-0000-0000-0000000004a1',
  idempotencyKey: researchQueryId,
  action: 'research.query',
  identityId: '00000000-0000-0000-0000-0000000004a2',
  purpose: 'research E2E',
  expiresAt: '2026-10-24T00:00:00.000Z',
  payloadRef: researchQueryId,
  payloadIdentity: researchPayloadIdentity,
});
assert.match(researchHashCalls[0].sql, /operations\\.create_or_get_with_payload_hash/);
assert.equal(researchHashCalls[0].params[7], null);
assert.equal(researchHashCalls[0].params[8], researchQueryId);
assert.deepEqual(JSON.parse(String(researchHashCalls[0].params[9])), researchPayloadIdentity);
assert.equal(researchHashed.operation.contentHash, 'a'.repeat(64));
