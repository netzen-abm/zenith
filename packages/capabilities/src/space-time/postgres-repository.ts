import type { OperationEnvelope } from '../../../contracts/src/operation.ts';
import type { SpaceTimeRequestRepository } from './repository.ts';

type Db = {
  query<T extends Record<string, unknown>>(sql: string, params: readonly unknown[]): Promise<T[]>;
};
type Store = { transaction<T>(work: (db: Db) => Promise<T>): Promise<T> };

export class PostgresSpaceTimeRequestRepository implements SpaceTimeRequestRepository {
  constructor(private readonly db: Store) {}

  async saveRequest(
    operation: Pick<OperationEnvelope, 'operationId' | 'idempotencyKey' | 'action' | 'resourceId' | 'organisationId' | 'identityId' | 'purpose' | 'payloadRef'>,
    representation: {
      resourceId: string;
      representationType: string;
      geom?: unknown;
      precisionLevel: string;
      coordinateConfidence?: number;
      sourceEvidenceId?: string;
    },
    requestId: string,
  ): Promise<void> {
    await this.db.transaction(async db => {
      await db.query(
        'insert into core.space_time_representation_requests(id,organisation_id,identity_id,resource_id,representation_type,geom,precision_level,coordinate_confidence,source_evidence_id) values ($1,$2,$3,$4,$5,$6::geometry,$7,$8,$9)',
        [
          requestId, operation.organisationId, operation.identityId, representation.resourceId,
          representation.representationType, representation.geom ?? null, representation.precisionLevel,
          representation.coordinateConfidence ?? null, representation.sourceEvidenceId ?? null,
        ],
      );
      await db.query(
        'insert into operations.operations(id,organisation_id,identity_id,idempotency_key,action,resource_id,purpose,expires_at,payload_ref) values ($1,$2,$3,$4,$5,$6,$7,clock_timestamp()+interval \'1 hour\',$8)',
        [
          operation.operationId, operation.organisationId, operation.identityId,
          operation.idempotencyKey, operation.action, operation.resourceId, operation.purpose, requestId,
        ],
      );
      await db.query('select operations.transition($1,\'created\',\'authorized\')', [operation.operationId]);
      await db.query('select operations.transition($1,\'authorized\',\'queued\')', [operation.operationId]);
    });
  }

  async consumeRequest(payloadRef: string): Promise<{ representationId: string; decision: string } | undefined> {
    const rows = await this.db.transaction(db => db.query(
      'select representation_id, decision from core_private.consume_space_time_representation_request($1::uuid)',
      [payloadRef],
    ));
    const result = rows[0];
    if (!result) return undefined;
    return { representationId: String(result.representation_id), decision: String(result.decision) };
  }
}
