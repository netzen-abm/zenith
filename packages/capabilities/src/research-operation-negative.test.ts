import { strict as assert } from 'node:assert';
import { DeterministicResearchProvider } from './research-provider-fixture.ts';
import { ResearchOperation, type ResearchQueryStore } from './research-operation.ts';
import type { ResearchQuery } from './research-intelligence.ts';

class Store implements ResearchQueryStore {
  private readonly data = new Map<string, ResearchQuery>();
  async save(query: ResearchQuery) { this.data.set(query.queryId, query); }
  async get(id: string) { return this.data.get(id); }
  has(id: string) { return this.data.has(id); }
}

const query: ResearchQuery = {
  queryId: 'q-negative', intent: 'discover', text: 'Pattanam',
  pageSize: 10, requesterIdentityId: 'id-1', organisationId: 'org-1', purpose: 'research',
};

async function build(overrides: Partial<ResearchQuery> = {}, authorization = true, reservation = true, provider = new DeterministicResearchProvider([])) {
  const store = new Store();
  const calls: string[] = [];
  const operation = new ResearchOperation(store, provider, {
    authorization: { authorize: async () => { calls.push('authorize'); return authorization; } },
    reservation: { reserve: async () => { calls.push('reserve'); return { allowed: reservation, decision: reservation ? 'reserved' : 'denied', attemptCount: 1 }; } },
    outcomeRecorder: { record: async (_op, outcome) => { calls.push('outcome:' + outcome.outcome); return { recorded: true, decision: 'recorded' }; } },
  });
  return { operation, store, calls, query: { ...query, ...overrides } };
}

{
  const x = await build({}, false);
  await assert.rejects(() => x.operation.execute(x.query), /research_unauthorized/);
  assert.equal(x.store.has(x.query.queryId), false);
  assert.deepEqual(x.calls, ['authorize']);
}
{
  const x = await build({}, true, false);
  await assert.rejects(() => x.operation.execute(x.query), /research_not_executed:deny_reservation/);
  assert.deepEqual(x.calls, ['authorize', 'authorize', 'reserve']);
}
