import type { OperationEnvelope } from '../../../contracts/src/operation.ts';
import type { SpaceTimeRequestRepository, SpaceTimeRepresentationPayload } from '../../../capabilities/src/space-time/repository.ts';

type Db = {
  query<T extends Record<string, unknown>>(sql: string, params: readonly unknown[]): Promise<T[]>;
};
type Store = { transaction<T>(work: (db: Db) => Promise<T>): Promise<T> };

export class PostgresSpaceTimeRequestRepository implements SpaceTimeRequestRepository {
  private readonly db: Store;

  constructor(db: Store) {
    this.db = db;
  }

  async saveRequest(
    operation: OperationEnvelope,
    representation: SpaceTimeRepresentationPayload,
    requestId: string,
    payloadHash: string,
  ): Promise<void> {
    if (!operation.operationId || !operation.organisationId || !operation.identityId ||
        !operation.resourceId || !operation.payloadRef || operation.payloadRef !== requestId) {
      throw new Error('space_time_canonical_operation_invalid');
    }
    await this.db.transaction(async db => {
      const rows = await db.query<{ id: string }>(
        `select id
           from core_private.register_space_time_representation_request(
             $1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::text,$6::text,$7::text,
             $8::numeric,$9::uuid,$10::text,$11::text
           )`,
        [
          requestId, operation.organisationId, operation.identityId, representation.resourceId,
          representation.representationType, representation.geom ?? null, representation.precisionLevel,
          representation.coordinateConfidence ?? null, representation.sourceEvidenceId ?? null, payloadHash,
          operation.purpose,
        ],
      );
      if (!rows[0]) throw new Error('space_time_request_payload_conflict');

      // Serialize lifecycle repair for an operation that was created but whose
      // request row was not persisted before a process interruption.
      await db.query(
        'select pg_advisory_xact_lock(hashtextextended($1::text, 0))',
        [operation.operationId],
      );
      const state = await db.query<{ state: string }>(
        'select state from operations.operations where id = $1::uuid',
        [operation.operationId],
      );
      if (state[0]?.state === 'created') {
        await db.query("select operations.transition($1,'created','authorized')", [operation.operationId]);
        await db.query("select operations.transition($1,'authorized','queued')", [operation.operationId]);
      } else if (state[0]?.state === 'authorized') {
        await db.query("select operations.transition($1,'authorized','queued')", [operation.operationId]);
      }
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

  async getConsumedReceipt(payloadRef: string): Promise<string | undefined> {
    const rows = await this.db.transaction(db => db.query<{
      representation_id: string | null;
    }>(
      'select representation_id from core_private.get_space_time_consumed_receipt($1::uuid)',
      [payloadRef],
    ));
    const id = rows[0]?.representation_id;
    return id == null ? undefined : String(id);
  }

  async getOutcome(operationId: string): Promise<{ outcome: string; resultRef?: string; resultHash?: string } | undefined> {
    const rows = await this.db.transaction(db => db.query<{
      outcome: string;
      result_ref: string | null;
      result_hash: string | null;
    }>(
      `select eo.outcome, eo.result_ref, eo.result_hash
         from operations.execution_outcomes eo
        where eo.operation_id = $1::uuid
        order by eo.attempt_count desc
        limit 1`,
      [operationId],
    ));
    const row = rows[0];
    return row ? {
      outcome: row.outcome,
      ...(row.result_ref == null ? {} : { resultRef: row.result_ref }),
      ...(row.result_hash == null ? {} : { resultHash: row.result_hash }),
    } : undefined;
  }
}
