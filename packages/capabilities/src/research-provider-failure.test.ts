import { strict as assert } from 'node:assert';
import { ResearchOperation, type ResearchQueryStore } from './research-operation.ts';
import type { ResearchQuery } from './research-intelligence.ts';

class Store implements ResearchQueryStore {
  private readonly data = new Map<string, ResearchQuery>();
  async save(query: ResearchQuery) { this.data.set(query.queryId, query); }
  async get(id: string) { return this.data.get(id); }
}

const query: ResearchQuery = {
  queryId: 'q-failure', intent: 'discover', text: 'Pattanam',
  pageSize: 10, requesterIdentityId: 'id-1', organisationId: 'org-1', purpose: 'research',
};
const store = new Store();
const calls: string[] = [];
const operation = new ResearchOperation(store, {
  providerId: 'failing', adapterVersion: '1.0',
  search: async () => { calls.push('provider'); throw new Error('network'); },
}, {
  authorization: { authorize: async () => { calls.push('authorize'); return true; } },
  reservation: { reserve: async () => { calls.push('reserve'); return { allowed: true, decision: 'reserved', attemptCount: 1 }; } },
  outcomeRecorder: { record: async (_op, outcome) => { calls.push('outcome:' + outcome.outcome); return { recorded: true, decision: 'recorded' }; } },
});
await operation.execute(query);
assert.deepEqual(calls, ['authorize', 'authorize', 'reserve', 'provider', 'outcome:retry_wait']);
