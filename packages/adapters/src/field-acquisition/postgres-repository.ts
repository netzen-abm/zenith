import type { OperationEnvelope } from '../../../contracts/src/operation.ts';
import type { FieldObservationRequest } from '../../../capabilities/src/field-acquisition-operation.ts';
import type { FieldAcquisitionRepository } from '../../../capabilities/src/field-acquisition/repository.ts';

export type QueryExecutor = { query<T extends Record<string, unknown>>(sql: string, params: readonly unknown[]): Promise<T[]> };
export type TransactionExecutor = { transaction<T>(work: (db: QueryExecutor) => Promise<T>): Promise<T> };

export class PostgresFieldAcquisitionRepository implements FieldAcquisitionRepository {
  constructor(private readonly db: TransactionExecutor) {}
  async saveRequest(operation: OperationEnvelope, observation: FieldObservationRequest, context: { organisationId: string; identityId: string; purpose: string }): Promise<void> {
    const requestId = operation.payloadRef;
    await this.db.transaction(async db => {
      await db.query(
        'insert into core.field_observation_requests(id,organisation_id,identity_id,evidence_id,observation_type,value,method,observed_at,uncertainty) values ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8,$9::jsonb)',
        [requestId, context.organisationId, context.identityId, observation.evidenceId, observation.observationType,
          JSON.stringify(observation.value), JSON.stringify(observation.method ?? {}), observation.observedAt ?? null,
          JSON.stringify(observation.uncertainty ?? {})],
      );
      await db.query(
        'insert into operations.operations(id,organisation_id,identity_id,idempotency_key,action,resource_id,purpose,expires_at,payload_ref) values ($1,$2,$3,$4,$5,$6,$7,clock_timestamp()+interval \'1 hour\',$8)',
        [operation.operationId, context.organisationId, context.identityId, operation.idempotencyKey, operation.action,
          observation.evidenceId, context.purpose, requestId],
      );
      await db.query('select operations.transition($1,\'created\',\'authorized\')', [operation.operationId]);
      await db.query('select operations.transition($1,\'authorized\',\'queued\')', [operation.operationId]);
    });
  }
  async consumeRequest(payloadRef: string) {
    const rows = await this.db.transaction(db => db.query(
      'select observation_id, decision from core_private.consume_field_observation_request($1::uuid)', [payloadRef],
    ));
    const result = rows[0];
    return result ? { observationId: String(result.observation_id), decision: String(result.decision) } : undefined;
  }
}
