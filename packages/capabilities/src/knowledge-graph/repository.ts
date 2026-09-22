import type { KnowledgeGraphRelationship } from './domain.ts';

export type KnowledgeGraphRequestRepository = {
  saveRequest(
    relationship: KnowledgeGraphRelationship,
    context: { organisationId: string; identityId: string },
  ): Promise<void>;
  consumeRequest(payloadRef: string): Promise<{ relationshipId: string; decision: string } | undefined>;
};