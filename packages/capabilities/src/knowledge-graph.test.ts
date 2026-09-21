import {
  validateKnowledgeGraphAssertion,
  validateKnowledgeGraphRelationship,
  type KnowledgeGraphRelationship,
} from './knowledge-graph.ts';

const valid: KnowledgeGraphRelationship = {
  id: 'relationship-1',
  organisationId: 'org-1',
  subjectResourceId: 'site-1',
  predicate: 'associated_with',
  objectResourceId: 'artefact-1',
  epistemicStatus: 'documented',
  confidence: 0.9,
  validFrom: '2026-01-01T00:00:00Z',
  validTo: '2026-12-31T00:00:00Z',
};

validateKnowledgeGraphRelationship(valid);

for (const [name, relationship, message] of [
  ['self relationship', { ...valid, objectResourceId: valid.subjectResourceId }, 'knowledge_graph_self_relationship_forbidden'],
  ['invalid confidence', { ...valid, confidence: 1.1 }, 'knowledge_graph_confidence_invalid'],
  ['invalid time range', { ...valid, validFrom: '2027-01-01T00:00:00Z' }, 'knowledge_graph_temporal_range_invalid'],
] as const) {
  try {
    validateKnowledgeGraphRelationship(relationship);
    throw new Error(name + ': expected validation failure');
  } catch (error) {
    if (!(error instanceof Error) || error.message !== message) throw error;
  }
}

validateKnowledgeGraphAssertion({
  id: 'assertion-1',
  relationshipId: valid.id,
  assertionType: 'support',
  evidenceId: 'evidence-1',
});

console.log('knowledge-graph-contract: PASS');
