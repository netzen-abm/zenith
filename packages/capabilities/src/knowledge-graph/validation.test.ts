import { describe, expect, it } from 'vitest';
import { validateKnowledgeGraphAssertion, validateKnowledgeGraphRelationship } from './validation.ts';

const base = {
  id: 'rel-1', organisationId: 'org-1', subjectResourceId: 'site-1',
  predicate: 'located_at', objectResourceId: 'place-1',
  epistemicStatus: 'observed' as const,
};

describe('knowledge graph validation', () => {
  it('rejects self relationships', () => {
    expect(() => validateKnowledgeGraphRelationship({...base, objectResourceId: base.subjectResourceId})).toThrow('knowledge_graph_self_relationship_forbidden');
  });
  it('rejects invalid confidence', () => {
    expect(() => validateKnowledgeGraphRelationship({...base, confidence: 1.1})).toThrow('knowledge_graph_confidence_invalid');
  });
  it('rejects inverted temporal ranges', () => {
    expect(() => validateKnowledgeGraphRelationship({...base, validFrom: '2026-01-02', validTo: '2026-01-01'})).toThrow('knowledge_graph_temporal_range_invalid');
  });
  it('accepts bounded epistemic assertions', () => {
    expect(() => validateKnowledgeGraphAssertion({id:'a1', relationshipId:'rel-1', assertionType:'support', evidenceId:'ev-1'})).not.toThrow();
  });
});