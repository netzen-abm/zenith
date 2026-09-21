import { SpaceTimeOperation } from './space-time-operation.ts';

const calls: string[] = [];
const db = {
  transaction: async <T>(work: (db: { query: <R extends Record<string, unknown>>(sql: string, params: readonly unknown[]) => Promise<R[]> }) => Promise<T>) =>
    work({ query: async <R extends Record<string, unknown>>(sql: string) => {
      calls.push(sql);
      if (sql.includes('consume_space_time_representation_request')) {
        return [{ representation_id: 'spatial-1', decision: 'created' }] as R[];
      }
      return [] as R[];
    } }),
};
const context = {
  organisationId: 'org-1', identityId: 'identity-1', purpose: 'research',
  authorization: { authorize: async () => true },
  reservation: { reserve: async () => ({ allowed: true, decision: 'allow', attemptCount: 1 }) },
  outcomeRecorder: { record: async () => ({ recorded: true, decision: 'allow' }) },
};
await new SpaceTimeOperation(db, context).execute({
  resourceId: 'site-1', representationType: 'point', precisionLevel: 'generalized', coordinateConfidence: 0.8,
});
if (!calls.some(sql => sql.includes('consume_space_time_representation_request'))) {
  throw new Error('space-time handler boundary not reached');
}
if (calls.some(sql => sql.includes('insert into core.spatial_representations'))) {
  throw new Error('space-time capability must not mutate protected table directly');
}
console.log('space-time-operation: PASS');
