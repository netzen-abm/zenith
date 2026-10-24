import { strict as assert } from 'node:assert';
import { MemoryResearchResultStore } from './research-result-store-fixture.ts';
import { MemoryOperationStore } from './research-operation-store-fixture.ts';
import { ResearchOperation, type ResearchQueryStore } from './research-operation.ts';
import type { ResearchQuery } from './research-intelligence.ts';

const query: ResearchQuery = {
  queryId: 'q-outcome', intent: 'discover', text: 'Pattanam', pageSize: 10,
  requesterIdentityId: 'id-1', organisationId: 'org-1', purpose: 'research',
};
const store: ResearchQueryStore = {
  save: async query => query.queryId,
  get: async () => query,
};
const reservedOperationIds = new Set<string>();
let providerCalls = 0;
let outcomeCalls = 0;
const operation = new ResearchOperation(store, {
  providerId: 'fixture', adapterVersion: '1',
  search: async () => {
    providerCalls += 1;
    return { queryId: query.queryId, providerId: 'fixture', providerQueryReference: 'fixture:q-outcome', retrievedAt: '1970-01-01T00:00:00.000Z', results: [], partial: false, warnings: [] };
  },
}, {
  authorization: { authorize: async () => true },
  reservation: { reserve: async operationId => {
    if (reservedOperationIds.has(operationId)) {
      return { allowed: false, decision: 'deny_state' };
    }
    reservedOperationIds.add(operationId);
    return { allowed: true, decision: 'reserved', attemptCount: 1 };
  } },
  operationStore: new MemoryOperationStore(),
  resultStore: new MemoryResearchResultStore(),
  resultStore: new MemoryResearchResultStore(),
  outcomeRecorder: {
    record: async (_operation, outcome) => {
      outcomeCalls += 1;
      if (outcomeCalls === 1) return { recorded: false, decision: 'outcome_rejected' };
      return { recorded: true, decision: 'recorded' };
    },
    findLatest: async () => undefined,
  },
});
await assert.rejects(
  () => operation.execute(query),
  /execution_outcome_not_durable:outcome_rejected/,
);
assert.equal(providerCalls, 1, 'first attempt reached provider exactly once before outcome persistence failed');
assert.equal(outcomeCalls, 1);

const recovered = await operation.execute({ ...query });
assert.equal(recovered.state, 'acknowledged', 'saved provider result reconciles the missing durable outcome');
assert.match(recovered.resultRef ?? '', /^memory-result-/);
assert.equal(providerCalls, 1, 'reconciliation must not repeat provider work');
assert.equal(outcomeCalls, 2, 'reconciliation writes the durable outcome once the result snapshot is available');
