import type { OperationEnvelope } from '../../../contracts/src/operation.ts';
import type { EvidenceAnnotationRequest } from '../../../capabilities/src/evidence-annotation.ts';
import type { EvidenceAnnotationRepository } from '../../../capabilities/src/evidence-annotation/repository.ts';

export type QueryExecutor = { query<T extends Record<string, unknown>>(sql: string, params: readonly unknown[]): Promise<T[]> };
export type TransactionExecutor = { transaction<T>(work: (db: QueryExecutor) => Promise<T>): Promise<T> };

export class PostgresEvidenceAnnotationRepository implements EvidenceAnnotationRepository {
  constructor(private readonly db: TransactionExecutor) {}
  async saveRequest(operation: OperationEnvelope, request: EvidenceAnnotationRequest, context: { organisationId: string; identityId: string }): Promise<void> {
    const requestId = operation.payloadRef;
    await this.db.transaction(async db => {
      await db.query(
        'insert into core.evidence_annotation_requests(id,organisation_id,identity_id,resource_id,source_id,evidence_type,locator,excerpt,evidence_payload,epistemic_status,sensitivity) values ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9::jsonb,$10,$11)',
        [requestId, context.organisationId, context.identityId, request.resourceId, request.sourceId, request.evidenceType,
          JSON.stringify(request.locator ?? {}), request.excerpt ?? null, JSON.stringify(request.evidencePayload ?? {}),
          request.epistemicStatus ?? 'documented', request.sensitivity ?? 'public'],
      );
      await db.query(
        'insert into operations.operations(id,organisation_id,identity_id,idempotency_key,action,resource_id,purpose,expires_at,payload_ref) values ($1,$2,$3,$4,$5,$6,$7,clock_timestamp()+interval \'1 hour\',$8)',
        [operation.operationId, context.organisationId, context.identityId, operation.idempotencyKey, operation.action,
          request.resourceId, operation.purpose, requestId],
      );
      await db.query('select operations.transition($1,\'created\',\'authorized\')', [operation.operationId]);
      await db.query('select operations.transition($1,\'authorized\',\'queued\')', [operation.operationId]);
    });
  }
  async consumeRequest(payloadRef: string) {
    const rows = await this.db.transaction(db => db.query(
      'select evidence_id, decision from core_private.consume_evidence_annotation_request($1::uuid)', [payloadRef],
    ));
    const result = rows[0];
    return result ? { evidenceId: String(result.evidence_id), decision: String(result.decision) } : undefined;
  }
}
