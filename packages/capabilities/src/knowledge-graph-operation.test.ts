import { KnowledgeGraphCapability } from './knowledge-graph-operation.ts';

const calls: string[] = [];
const db = {
  transaction: async <T>(work: (db: { query: <R extends Record<string, unknown>>(sql: string, params: readonly unknown[]) => Promise<R[]> }) => Promise<T>) =>
    work({ query: async <R extends Record<string, unknown>>(sql: string) => {
      calls.push(sql);
      if (sql.includes('consume_knowledge_graph_relationship_request')) {
        return [{ relationship_id: 'rel-1', decision: 'created' }] as R[];
      }
      return [] as R[];
    } }),
};

const authorization = { authorize: async () => true };
const reservation = { reserve: async (operation: unknown) => ({ reserved: true, attemptCount: 1, operation }) };
const outcomeRecorder = { record: async () => ({}) };

const capability = new KnowledgeGraphCapability(db, authorization, reservation, outcomeRecorder);
await capability.execute({
  organisationId: 'org-1',
  subjectResourceId: 'site-1',
  predicate: 'associated_with',
  objectResourceId: 'artefact-1',
  epistemicStatus: 'documented',
  confidence: 0.9,
}, { organisationId: 'org-1', identityId: 'identity-1', purpose: 'research' });

if (!calls.some(sql => sql.includes('consume_knowledge_graph_relationship_request'))) {
  throw new Error('knowledge graph handler boundary not reached');
}
if (calls.some(sql => sql.includes('insert into core.entity_relationships'))) {
  throw new Error('capability must not mutate protected relationship table directly');
}
console.log('knowledge-graph-operation: PASS');
