import { strict as assert } from 'node:assert';
import { DeterministicResearchProvider } from './research-provider-fixture.ts';
import { ResearchOperation, type ResearchQueryStore } from './research-operation.ts';

class MemoryQueryStore implements ResearchQueryStore {
  private readonly data = new Map<string, any>();
  async save(query: any) { this.data.set(query.queryId, query); return query.queryId; }
  async get(id: string) { return this.data.get(id); }
}

const calls: string[] = [];
let handlerAttemptCount = 0;
const store = new MemoryQueryStore();
const provider = new DeterministicResearchProvider([
  { providerId: 'fixture', title: 'Pattanam Archaeology', identifiers: ['w1'], sourceProvenance: 'fixture' },
]);
const operation = new ResearchOperation(store, provider, {
  authorization: { authorize: async () => { calls.push('authorize'); return true; } },
  reservation: { reserve: async () => { calls.push('reserve'); return { allowed: true, decision: 'reserved', attemptCount: 1 }; } },
  outcomeRecorder: { record: async (operation, outcome) => {
    handlerAttemptCount = operation.attemptCount;
    calls.push('outcome:' + outcome.outcome);
    return { recorded: true, decision: 'recorded' };
  } },
});

const result = await operation.execute({
  queryId: 'q-1', intent: 'discover', text: 'Pattanam',
  pageSize: 10, requesterIdentityId: 'id-1', organisationId: 'org-1', purpose: 'research',
});

assert.equal(result.action, 'research.query');
assert.equal(result.attemptCount, 0);
assert.equal(handlerAttemptCount, 1);
assert.deepEqual(calls, ['authorize', 'authorize', 'reserve', 'outcome:acknowledged']);
