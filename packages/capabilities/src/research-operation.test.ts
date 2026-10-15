import { strict as assert } from 'node:assert';
import { MemoryOperationStore } from './research-operation-store-fixture.ts';
import { DeterministicResearchProvider } from './research-provider-fixture.ts';
import { ResearchOperation } from './research-operation.ts';
import type { ResearchQueryStore } from './research/repository.ts';

class MemoryQueryStore implements ResearchQueryStore {
  private readonly data = new Map<string, any>();
  async save(query: any) { this.data.set(query.queryId, query); return query.queryId; }
  async get(id: string) { return this.data.get(id); }
}

const calls: string[] = [];
const operationStore = new MemoryOperationStore();
const reservedIds = new Set<string>();
let handlerAttemptCount = 0;
let durableOutcome: { outcome: 'acknowledged' | 'retry_wait' | 'conflict' | 'rejected'; errorCode?: string; resultRef?: string; resultHash?: string; occurredAt?: string } | undefined;
const store = new MemoryQueryStore();
const provider = new DeterministicResearchProvider([
  { providerId: 'fixture', title: 'Pattanam Archaeology', identifiers: ['w1'], sourceProvenance: 'fixture' },
]);
const operation = new ResearchOperation(store, provider, {
  authorization: { authorize: async () => { calls.push('authorize'); return true; } },
  reservation: { reserve: async id => { calls.push('reserve:' + id); if (reservedIds.has(id)) return { allowed: false, decision: 'deny_state' }; reservedIds.add(id); return { allowed: true, decision: 'reserved', attemptCount: 1 }; } },
  operationStore,
  outcomeRecorder: {
    record: async (operation, outcome) => {
      handlerAttemptCount = operation.attemptCount;
      durableOutcome = outcome;
      calls.push('outcome:' + outcome.outcome);
      return { recorded: true, decision: 'recorded' };
    },
    findLatest: async () => durableOutcome,
  },
});

const result = await operation.execute({
  queryId: 'q-1', intent: 'discover', text: 'Pattanam',
  filters: { region: 'Kerala', period: { start: 1, end: 100 } },
  pageSize: 10, requesterIdentityId: 'id-1', organisationId: 'org-1', purpose: 'research',
});

assert.equal(result.action, 'research.query');
assert.equal(result.attemptCount, 0);
assert.equal(handlerAttemptCount, 1);
assert.deepEqual(calls, ['authorize', 'reserve:' + result.operationId, 'outcome:acknowledged']);
const replayed = await operation.execute({ queryId: 'q-1', intent: 'discover', text: 'Pattanam', filters: { period: { end: 100, start: 1 }, region: 'Kerala' }, pageSize: 10, requesterIdentityId: 'id-1', organisationId: 'org-1', purpose: 'research' });
assert.equal(replayed.operationId, result.operationId, 'same idempotency key must resolve to the same canonical operation identity');
assert.equal(replayed.resultRef, durableOutcome?.resultRef, 'retry returns the durable provider result reference');
assert.equal(calls.filter(call => call.startsWith('reserve:')).length, 1, 'durable replay must bypass reservation');
assert.equal(calls.filter(call => call === 'outcome:acknowledged').length, 1, 'durable replay must not record a second outcome');
assert.equal(handlerAttemptCount, 1, 'provider execution occurs only once');
