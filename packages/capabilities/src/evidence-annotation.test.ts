import { strict as assert } from 'node:assert';
import {
  EvidenceAnnotationCapability,
} from './evidence-annotation.ts';

const calls: string[] = [];
const repository = {
  async saveRequest() { calls.push('save'); },
  async consumeRequest() { calls.push('consume'); return { evidenceId: 'evidence-1', decision: 'created' }; },
};


let authCalls = 0;
let reservationCalls = 0;
let handlerAttempts = 0;
let recordedAttempt = 0;
const capability = new EvidenceAnnotationCapability(
  repository,
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
assert.equal(operation.state, 'queued');
assert.equal(operation.attemptCount, 0);
assert.ok(operation.payloadRef);
assert.equal(authCalls, 1);
assert.equal(reservationCalls, 1);
assert.equal(handlerAttempts, 1);
assert.equal(recordedAttempt, 1);
assert.equal(calls.filter(call => call === 'save').length, 1);
assert.equal(calls.filter(call => call === 'consume').length, 1);

const denied = new EvidenceAnnotationCapability(
  repository,
  { async authorize() { return false; } },
  { async reserve() { throw new Error('reservation_must_not_run'); } },
  { async record() { throw new Error('outcome_must_not_run'); } },
);
await assert.rejects(
  () => denied.execute(
    { resourceId: 'resource-1', sourceId: 'source-1', evidenceType: 'annotation' },
    { organisationId: 'org-1', identityId: 'identity-1', purpose: 'denied' },
  ),
  /evidence_annotation_not_executed:deny_authorization/,
);

console.log('Evidence annotation capability assertions passed.');
