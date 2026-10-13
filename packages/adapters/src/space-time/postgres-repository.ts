import type { OperationEnvelope } from '../../../contracts/src/operation.ts';
import type { SpaceTimeRequestRepository, SpaceTimeRepresentationPayload } from '../../../capabilities/src/space-time/repository.ts';

type Db = {
  query<T extends Record<string, unknown>>(sql: string, params: readonly unknown[]): Promise<T[]>;
};
type Store = { transaction<T>(work: (db: Db) => Promise<T>): Promise<T> };

export class PostgresSpaceTimeRequestRepository implements SpaceTimeRequestRepository {
  constructor(private readonly db: Store) {}

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
        `insert into core.space_time_representation_requests(
          id,organisation_id,identity_id,resource_id,representation_type,geom,
          precision_level,coordinate_confidence,source_evidence_id,payload_hash
        ) values ($1,$2,$3,$4,$5,$6::geometry,$7,$8,$9,$10)
        on conflict (id) do update set id = excluded.id
          where core.space_time_representation_requests.payload_hash = excluded.payload_hash
        returning id`,
        [
          requestId, operation.organisationId, operation.identityId, representation.resourceId,
          representation.representationType, representation.geom ?? null, representation.precisionLevel,
          representation.coordinateConfidence ?? null, representation.sourceEvidenceId ?? null, payloadHash,
        ],
      );
      if (!rows[0]) throw new Error('space_time_request_payload_conflict');

      // A previously created operation may have been interrupted before its
      // request row was persisted. Repair that row on retry, then advance only
      // operations still in the initial state.
      if (operation.state === 'created') {
        const authorized = await db.query<{ decision: string }>(
          "select decision from operations.transition($1,'created','authorized')",
          [operation.operationId],
        );
        if (authorized[0]?.decision === 'allow') {
          await db.query("select operations.transition($1,'authorized','queued')", [operation.operationId]);
        } else {
          const state = await db.query<{ state: string }>(
            'select state from operations.operations where id = $1::uuid',
            [operation.operationId],
          );
          if (state[0]?.state === 'authorized') {
            await db.query("select operations.transition($1,'authorized','queued')", [operation.operationId]);
          }
        }
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

  async getOutcome(operationId: string): Promise<{ outcome: string; resultRef?: string; resultHash?: string } | undefined> {
    const rows = await this.db.query<{
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
    );
    const row = rows[0];
    return row ? {
      outcome: row.outcome,
      ...(row.result_ref == null ? {} : { resultRef: row.result_ref }),
      ...(row.result_hash == null ? {} : { resultHash: row.result_hash }),
    } : undefined;
  }
}
