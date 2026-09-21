import { strict as assert } from 'node:assert';
import { ResearchOperation, type ResearchQueryStore } from './research-operation.ts';
import type { ResearchQuery } from './research-intelligence.ts';

const query: ResearchQuery = {
  queryId: 'q-missing', intent: 'discover', text: 'Pattanam', pageSize: 10,
  requesterIdentityId: 'id-1', organisationId: 'org-1', purpose: 'research',
};
const calls: string[] = [];
const store: ResearchQueryStore = {
  save: async () => {},
  get: async () => undefined,
};
const operation = new ResearchOperation(store, {
  providerId: 'fixture', adapterVersion: '1',
  search: async () => { calls.push('provider'); throw new Error('must not run'); },
}, {
  authorization: { authorize: async () => true },
  reservation: { reserve: async () => ({ allowed: true, decision: 'reserved', attemptCount: 1 }) },
  outcomeRecorder: { record: async (_op, outcome) => {
    calls.push('outcome:' + outcome.outcome);
    return { recorded: true, decision: 'recorded' };
  } },
});
await assert.rejects(() => operation.execute(query), /research_not_executed:allow/);
assert.deepEqual(calls, ['outcome:rejected']);
