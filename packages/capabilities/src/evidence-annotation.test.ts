import { strict as assert } from 'node:assert';
import {
  EvidenceAnnotationCapability,
  type QueryExecutor,
  type TransactionExecutor,
} from './evidence-annotation.ts';

const calls: Array<{ sql: string; params: readonly unknown[] }> = [];
const db: TransactionExecutor = {
  async transaction<T>(work: (db: QueryExecutor) => Promise<T>): Promise<T> {
    return work({
      async query<T extends Record<string, unknown>>(sql: string, params: readonly unknown[]) {
        calls.push({ sql, params });
        if (sql.includes('consume_evidence_annotation_request')) {
          return [{ evidence_id: 'evidence-1', decision: 'created' }] as T[];
        }
        return [] as T[];
      },
    });
  },
};

let authCalls = 0;
let reservationCalls = 0;
let handlerAttempts = 0;
let recordedAttempt = 0;
const capability = new EvidenceAnnotationCapability(
  db,
  { async authorize() { authCalls++; return true; } },
  {
    async reserve() {
      reservationCalls++;
      return { allowed: true, decision: 'allow', attemptCount: 1 };
    },
  },
  {
    async record(operation, outcome) {
      recordedAttempt = operation.attemptCount;
      handlerAttempts++;
      assert.equal(outcome.outcome, 'acknowledged');
      assert.equal(outcome.resultRef, 'evidence-1');
      return { recorded: true, decision: 'acknowledged' };
    },
  },
);

const operation = await capability.execute(
  {
    resourceId: 'resource-1',
    sourceId: 'source-1',
    evidenceType: 'annotation',
    excerpt: 'documented excerpt',
    evidencePayload: { note: 'test' },
  },
  {
    organisationId: 'org-1',
    identityId: 'identity-1',
    purpose: 'research annotation',
  },
);

assert.equal(operation.action, 'annotate');
assert.equal(operation.state, 'created');
assert.equal(operation.attemptCount, 0);
assert.ok(operation.payloadRef);
assert.equal(authCalls, 2);
assert.equal(reservationCalls, 1);
assert.equal(handlerAttempts, 1);
assert.equal(recordedAttempt, 1);
assert.equal(calls.filter(call => call.sql.startsWith('insert into core.evidence_annotation_requests')).length, 1);
assert.equal(calls.filter(call => call.sql.startsWith('insert into operations.operations')).length, 1);
assert.equal(calls.filter(call => call.sql.includes("operations.transition($1,'created','authorized')")).length, 1);
assert.equal(calls.filter(call => call.sql.includes("operations.transition($1,'authorized','queued')")).length, 1);
assert.equal(calls.filter(call => call.sql.includes('consume_evidence_annotation_request')).length, 1);

const denied = new EvidenceAnnotationCapability(
  db,
  { async authorize() { return false; } },
  { async reserve() { throw new Error('reservation_must_not_run'); } },
  { async record() { throw new Error('outcome_must_not_run'); } },
);
await assert.rejects(
  () => denied.execute(
    { resourceId: 'resource-1', sourceId: 'source-1', evidenceType: 'annotation' },
    { organisationId: 'org-1', identityId: 'identity-1', purpose: 'denied' },
  ),
  /evidence_annotation_unauthorized/,
);

console.log('Evidence annotation capability assertions passed.');
