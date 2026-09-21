import { FieldAcquisitionOperation } from './field-acquisition-operation.ts';

const calls: string[] = [];
const db = {
  transaction: async <T>(work: (db: { query: <R extends Record<string, unknown>>(sql: string, params: readonly unknown[]) => Promise<R[]> }) => Promise<T>) =>
    work({ query: async <R extends Record<string, unknown>>(sql: string) => {
      calls.push(sql);
      if (sql.includes('consume_field_observation_request')) return [{ observation_id: 'observation-1', decision: 'created' }] as R[];
      return [] as R[];
    } }),
};
const context = {
  organisationId: 'org-1', identityId: 'identity-1', purpose: 'field capture',
  authorization: { authorize: async () => true },
  reservation: { reserve: async () => ({ allowed: true, decision: 'allow', attemptCount: 1 }) },
  outcomeRecorder: { record: async () => ({ recorded: true, decision: 'allow' }) },
};
await new FieldAcquisitionOperation(db, context).execute({
  organisationId: 'org-1', evidenceId: 'evidence-1', observerIdentityId: 'identity-1', idempotencyKey: 'capture-1',
  observationType: 'ceramic_fragment', value: { count: 3 },
});
if (!calls.some(sql => sql.includes('consume_field_observation_request'))) throw new Error('field handler boundary not reached');
if (calls.some(sql => sql.includes('insert into core.observations'))) throw new Error('field capability must not mutate protected table directly');
console.log('field-acquisition-operation: PASS');
