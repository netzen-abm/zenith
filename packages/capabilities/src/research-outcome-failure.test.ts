import { strict as assert } from 'node:assert';
import { ResearchOperation, type ResearchQueryStore } from './research-operation.ts';
import type { ResearchQuery } from './research-intelligence.ts';

const query: ResearchQuery = {
  queryId: 'q-outcome', intent: 'discover', text: 'Pattanam', pageSize: 10,
  requesterIdentityId: 'id-1', organisationId: 'org-1', purpose: 'research',
};
const store: ResearchQueryStore = {
  save: async () => {},
  get: async () => query,
};
const operation = new ResearchOperation(store, {
  providerId: 'fixture', adapterVersion: '1',
  search: async () => ({ queryId: query.queryId, providerId: 'fixture', providerQueryReference: 'fixture:q-outcome', retrievedAt: '1970-01-01T00:00:00.000Z', results: [], partial: false, warnings: [] }),
}, {
  authorization: { authorize: async () => true },
  reservation: { reserve: async () => ({ allowed: true, decision: 'reserved', attemptCount: 1 }) },
  outcomeRecorder: { record: async () => ({ recorded: false, decision: 'outcome_rejected' }) },
});
await assert.rejects(
  () => operation.execute(query),
  /execution_outcome_not_durable:outcome_rejected/,
);
