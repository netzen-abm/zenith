import { FieldAcquisitionOperation } from './field-acquisition-operation.ts';

const calls: string[] = [];
const repository = {
  saveRequest: async () => { calls.push('save'); },
  consumeRequest: async () => { calls.push('consume'); return { observationId: 'observation-1', decision: 'created' }; },
};
const context = {
  organisationId: 'org-1', identityId: 'identity-1', purpose: 'field capture',
  authorization: { authorize: async () => true },
  reservation: { reserve: async () => ({ allowed: true, decision: 'allow', attemptCount: 1 }) },
  outcomeRecorder: { record: async () => ({ recorded: true, decision: 'allow' }) },
};
const operation = await new FieldAcquisitionOperation(repository, context).execute({
  organisationId: 'org-1', evidenceId: 'evidence-1', observerIdentityId: 'identity-1', idempotencyKey: 'capture-1',
  observationType: 'ceramic_fragment', value: { count: 3 },
});
if (operation.state !== 'queued') throw new Error('field operation must be queued');
if (!calls.includes('save')) throw new Error('field repository save boundary not reached');
if (!calls.includes('consume')) throw new Error('field handler boundary not reached');
console.log('field-acquisition-operation: PASS');
