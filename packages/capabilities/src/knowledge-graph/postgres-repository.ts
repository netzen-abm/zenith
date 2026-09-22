import type { KnowledgeGraphRelationship } from './domain.ts';
import type { KnowledgeGraphRequestRepository } from './repository.ts';

type QueryExecutor = {
  query<T extends Record<string, unknown>>(sql: string, params: readonly unknown[]): Promise<T[]>;
};
type TransactionExecutor = {
  transaction<T>(work: (db: QueryExecutor) => Promise<T>): Promise<T>;
};

export class PostgresKnowledgeGraphRequestRepository implements KnowledgeGraphRequestRepository {
  constructor(private readonly db: TransactionExecutor) {}

  async saveRequest(relationship: KnowledgeGraphRelationship, context: { organisationId: string; identityId: string }): Promise<void> {
    await this.db.transaction(db => db.query(
      'insert into core.knowledge_graph_relationship_requests(id,organisation_id,identity_id,subject_resource_id,predicate,object_resource_id,asserted_by_identity_id,evidence_id,epistemic_status,confidence,valid_from,valid_to,assertion) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb)',
      [relationship.id, context.organisationId, context.identityId, relationship.subjectResourceId, relationship.predicate,
       relationship.objectResourceId, relationship.assertedByIdentityId ?? context.identityId, relationship.evidenceId ?? null,
       relationship.epistemicStatus, relationship.confidence ?? null, relationship.validFrom ?? null, relationship.validTo ?? null,
       JSON.stringify(relationship.assertion ?? {})],
    ));
  }

  async consumeRequest(payloadRef: string): Promise<{ relationshipId: string; decision: string } | undefined> {
    const rows = await this.db.transaction(db => db.query<{ relationship_id: string; decision: string }>(
      'select relationship_id, decision from core_private.consume_knowledge_graph_relationship_request($1::uuid)',
      [payloadRef],
    ));
    const row = rows[0];
    return row ? { relationshipId: String(row.relationship_id), decision: String(row.decision) } : undefined;
  }
}