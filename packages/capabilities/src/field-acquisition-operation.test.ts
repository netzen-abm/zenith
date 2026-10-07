import { strict as assert } from 'node:assert';
import { FieldAcquisitionOperation } from './field-acquisition-operation.ts';

const calls: string[] = [];
const repository = {
  persistRequest: async () => { calls.push('persist'); },
  consumeRequest: async () => { calls.push('consume'); return { observationId: 'observation-1', decision: 'created' }; },
};
const context = {
  organisationId: 'org-1', identityId: 'identity-1', purpose: 'field capture',
  authorization: { authorize: async () => { calls.push('authorize'); return true; } },
  reservation: { reserve: async () => { calls.push('reserve'); return { allowed: true, decision: 'allow', attemptCount: 1 }; } },
  outcomeRecorder: { record: async () => { calls.push('outcome'); return { recorded: true, decision: 'allow' }; } },
};
const operation = await new FieldAcquisitionOperation(repository, context).execute({
  organisationId: 'org-1', evidenceId: 'evidence-1', observerIdentityId: 'identity-1', idempotencyKey: 'capture-1',
  observationType: 'ceramic_fragment', value: { count: 3 },
});
assert.equal(operation.state, 'queued');
assert.deepEqual(calls, ['authorize', 'persist', 'reserve', 'consume', 'outcome']);
console.log('field-acquisition-operation: PASS');
