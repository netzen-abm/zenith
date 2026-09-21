import { strict as assert } from 'node:assert';
import { validateResearchQuery, type ResearchQuery } from './research-intelligence.ts';

const base: ResearchQuery = {
  queryId: 'q-1', intent: 'discover', text: 'Pattanam archaeology',
  pageSize: 20, requesterIdentityId: 'id-1',
  organisationId: 'org-1', purpose: 'research',
};

validateResearchQuery(base);

assert.throws(
  () => validateResearchQuery({ ...base, requesterIdentityId: '' }),
  /research_query_context_required/,
);
assert.throws(
  () => validateResearchQuery({ ...base, text: '   ' }),
  /research_query_content_required/,
);
assert.throws(
  () => validateResearchQuery({ ...base, pageSize: 0 }),
  /research_query_page_size_invalid/,
);
assert.throws(
  () => validateResearchQuery({ ...base, pageSize: 101 }),
  /research_query_page_size_invalid/,
);
assert.throws(
  () => validateResearchQuery({ ...base, pageSize: 1.5 }),
  /research_query_page_size_invalid/,
);
