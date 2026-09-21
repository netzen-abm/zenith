import { strict as assert } from 'node:assert';
import { PostgresResearchQueryStore, type SqlClient } from './research-query-postgres.ts';

const calls: Array<{ text: string; values: readonly unknown[] }> = [];
const db: SqlClient = {
  async query<T>(text: string, values: readonly unknown[] = []) {
    calls.push({ text, values });
    return { rows: [{ id: 'q-1' }] as T[] };
  },
};

const store = new PostgresResearchQueryStore(db);
const query = {
  queryId: 'q-1',
  intent: 'discover',
  text: 'Pattanam',
  concepts: ['trade'],
  filters: { period: 'early' },
  sort: ['date'],
  pageSize: 10,
  requestedFields: ['title'],
  openAccessRequired: true,
  requesterIdentityId: 'id-1',
  organisationId: 'org-1',
  purpose: 'archaeological research',
};

assert.equal(await store.save(query), 'q-1');
assert.equal(calls.length, 1);
assert.match(calls[0].text, /core\.research_query_requests/);
assert.equal(calls[0].values[0], 'q-1');
assert.equal(calls[0].values[1], 'org-1');
assert.equal(calls[0].values[2], 'id-1');
assert.equal(calls[0].values[6], JSON.stringify(['trade']));
assert.equal(calls[0].values[7], JSON.stringify({ period: 'early' }));
assert.equal(calls[0].values[12], true);
