import { strict as assert } from 'node:assert';
import { DeterministicResearchProvider } from './research-provider-fixture.ts';

const provider = new DeterministicResearchProvider([
  { providerId: 'fixture', title: 'Pattanam Archaeology', identifiers: ['w1'], sourceProvenance: 'fixture' },
  { providerId: 'fixture', title: 'Muziris Trade', identifiers: ['w2'], sourceProvenance: 'fixture' },
]);

const result = await provider.search({
  queryId: 'q-1', intent: 'discover', text: 'pattanam',
  pageSize: 1, requesterIdentityId: 'id-1', organisationId: 'org-1', purpose: 'research',
});

assert.equal(result.queryId, 'q-1');
assert.equal(result.providerId, 'fixture');
assert.equal(result.providerQueryReference, 'fixture:q-1');
assert.equal(result.results.length, 1);
assert.equal(result.results[0]?.identifiers[0], 'w1');
assert.equal(result.partial, false);
assert.deepEqual(result.warnings, []);
