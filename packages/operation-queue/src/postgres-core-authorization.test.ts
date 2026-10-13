import { strict as assert } from 'node:assert';
import { PostgresCoreAuthorization } from './postgres-core-authorization.ts';
import type { OperationEnvelope } from '../../contracts/src/operation.ts';

const queries: Array<{ sql: string; params: readonly unknown[] }> = [];
const db = {
  async query<T extends Record<string, unknown>>(sql: string, params: readonly unknown[]): Promise<T[]> {
    queries.push({ sql, params });
    return [{ allowed: true, decision: 'allow' }] as T[];
  },
};

const authorization = new PostgresCoreAuthorization(db);
const operation: OperationEnvelope = {
  operationId: '00000000-0000-0000-0000-0000000003b1',
  idempotencyKey: 'space-time-auth-policy-adapter-test',
  action: 'space_time.spatial_representation_create',
  resourceId: '00000000-0000-0000-0000-0000000003b2',
  organisationId: '00000000-0000-0000-0000-0000000003b3',
  identityId: '00000000-0000-0000-0000-0000000003b4',
  purpose: 'test',
  state: 'queued',
  createdAt: new Date().toISOString(),
};

assert.equal(await authorization.authorize(operation), true);
assert.equal(queries[0].params[0], 'write');
assert.equal(queries[0].params[1], operation.resourceId);
assert.equal(operation.action, 'space_time.spatial_representation_create', 'policy translation must not mutate operation identity');
console.log('postgres-core-authorization Space-Time policy mapping: PASS');
