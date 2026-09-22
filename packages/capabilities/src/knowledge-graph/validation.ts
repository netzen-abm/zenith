import type { KnowledgeGraphAssertion, KnowledgeGraphRelationship, KnowledgeGraphEpistemicStatus, KnowledgeGraphAssertionType } from './domain.ts';

const EPISTEMIC: readonly KnowledgeGraphEpistemicStatus[] = [
  'observed','documented','derived','interpreted','hypothesized','traditional_oral','contested_disputed','unknown',
];
const ASSERTION_TYPES: readonly KnowledgeGraphAssertionType[] = [
  'support','contradict','qualify','derive','contextualize',
];

export function validateKnowledgeGraphRelationship(relationship: KnowledgeGraphRelationship): void {
  if (!relationship.id || !relationship.organisationId) throw new Error('knowledge_graph_context_required');
  if (!relationship.subjectResourceId || !relationship.objectResourceId) throw new Error('knowledge_graph_resources_required');
  if (relationship.subjectResourceId === relationship.objectResourceId) throw new Error('knowledge_graph_self_relationship_forbidden');
  if (!relationship.predicate.trim()) throw new Error('knowledge_graph_predicate_required');
  if (!EPISTEMIC.includes(relationship.epistemicStatus)) throw new Error('knowledge_graph_epistemic_status_invalid');
  if (relationship.confidence !== undefined && (!Number.isFinite(relationship.confidence) || relationship.confidence < 0 || relationship.confidence > 1)) {
    throw new Error('knowledge_graph_confidence_invalid');
  }
  if (relationship.validFrom && relationship.validTo && new Date(relationship.validTo).getTime() < new Date(relationship.validFrom).getTime()) {
    throw new Error('knowledge_graph_temporal_range_invalid');
  }
}

export function validateKnowledgeGraphAssertion(assertion: KnowledgeGraphAssertion): void {
  if (!assertion.id || !assertion.relationshipId) throw new Error('knowledge_graph_assertion_context_required');
  if (!ASSERTION_TYPES.includes(assertion.assertionType)) throw new Error('knowledge_graph_assertion_type_invalid');
}