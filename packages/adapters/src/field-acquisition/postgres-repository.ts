import type { OperationEnvelope } from '../../../contracts/src/operation.ts';
import type { FieldObservationRequest } from '../../../capabilities/src/field-acquisition-operation.ts';
import type { FieldAcquisitionRepository } from '../../../capabilities/src/field-acquisition/repository.ts';

export type QueryExecutor = { query<T extends Record<string, unknown>>(sql: string, params: readonly unknown[]): Promise<T[]> };
export type TransactionExecutor = { transaction<T>(work: (db: QueryExecutor) => Promise<T>): Promise<T> };

export class PostgresFieldAcquisitionRepository implements FieldAcquisitionRepository {
  constructor(private readonly db: TransactionExecutor) {}

  async persistRequest(
    operation: OperationEnvelope,
    observation: FieldObservationRequest,
    context: { organisationId: string; identityId: string; purpose: string },
  ): Promise<void> {
    await this.db.transaction(async db => db.query(
      'insert into core.field_observation_requests(id,organisation_id,identity_id,evidence_id,observation_type,value,method,observed_at,uncertainty) values ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8,$9::jsonb)',
      [operation.payloadRef, context.organisationId, context.identityId, observation.evidenceId, observation.observationType,
        JSON.stringify(observation.value), JSON.stringify(observation.method ?? {}), observation.observedAt ?? null,
        JSON.stringify(observation.uncertainty ?? {})],
    ));
  }

  async consumeRequest(payloadRef: string) {
    const rows = await this.db.transaction(db => db.query(
      'select observation_id, decision from core_private.consume_field_observation_request($1::uuid)', [payloadRef],
    ));
    const result = rows[0];
    return result ? { observationId: String(result.observation_id), decision: String(result.decision) } : undefined;
  }
}