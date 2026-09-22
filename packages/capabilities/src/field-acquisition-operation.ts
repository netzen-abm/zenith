import { randomUUID } from 'node:crypto';
import type { OperationEnvelope } from '../../contracts/src/operation.ts';
import { ExecutionCoordinator, type ExecutionAuthorization, type ExecutionOutcomeRecorder, type ExecutionReservation } from '../../operation-queue/src/execution-coordinator.ts';
import { validateFieldObservation, type FieldObservation } from './field-acquisition.ts';

export type FieldObservationRequest = Omit<FieldObservation, 'id'> & { idempotencyKey: string };
export type FieldExecutionContext = {
  organisationId: string; identityId: string; purpose: string;
  authorization: ExecutionAuthorization; reservation: ExecutionReservation; outcomeRecorder: ExecutionOutcomeRecorder;
};
type Db = { query<T extends Record<string, unknown>>(sql: string, params: readonly unknown[]): Promise<T[]> };
type Store = { transaction<T>(work: (db: Db) => Promise<T>): Promise<T> };

export class FieldAcquisitionOperation {
  private readonly coordinator: ExecutionCoordinator;
  constructor(private readonly db: Store, private readonly context: FieldExecutionContext) {
    this.coordinator = new ExecutionCoordinator(
      context.authorization, context.reservation,
      operation => this.handle(operation), context.outcomeRecorder,
    );
  }

  async execute(request: FieldObservationRequest): Promise<OperationEnvelope> {
    const requestId = randomUUID();
    const operationId = randomUUID();
    const observation = { ...request, id: requestId };
    validateFieldObservation(observation);
    if (!request.idempotencyKey.trim()) throw new Error('field_observation_idempotency_key_required');
    const operation: OperationEnvelope = {
      operationId, idempotencyKey: request.idempotencyKey, action: 'field.observation_create',
      resourceId: request.evidenceId, organisationId: this.context.organisationId,
      identityId: this.context.identityId, purpose: this.context.purpose, state: 'created',
      createdAt: new Date().toISOString(), attemptCount: 0, payloadRef: requestId,
    };
    const result = await this.coordinator.execute(operation, async () => {
      await this.persist(operation, observation, requestId);
      return { ...operation, state: 'queued' };
    });
    if (!result.executed) throw new Error('field_observation_not_executed:' + result.decision);
    return operation;
  }

  private async persist(operation: OperationEnvelope, observation: FieldObservationRequest, requestId: string): Promise<void> {
    await this.db.transaction(async db => {
      await db.query(
        'insert into core.field_observation_requests(id,organisation_id,identity_id,evidence_id,observation_type,value,method,observed_at,uncertainty) values ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8,$9::jsonb)',
        [requestId, this.context.organisationId, this.context.identityId, observation.evidenceId,
          observation.observationType, JSON.stringify(observation.value), JSON.stringify(observation.method ?? {}),
          observation.observedAt ?? null, JSON.stringify(observation.uncertainty ?? {})],
      );
      await db.query(
        'insert into operations.operations(id,organisation_id,identity_id,idempotency_key,action,resource_id,purpose,expires_at,payload_ref) values ($1,$2,$3,$4,$5,$6,$7,clock_timestamp()+interval \'1 hour\',$8)',
        [operation.operationId, this.context.organisationId, this.context.identityId,
          operation.idempotencyKey, operation.action, observation.evidenceId, this.context.purpose, requestId],
      );
      await db.query('select operations.transition($1,\'created\',\'authorized\')', [operation.operationId]);
      await db.query('select operations.transition($1,\'authorized\',\'queued\')', [operation.operationId]);
    });
  }

  private async handle(operation: OperationEnvelope) {
    const rows = await this.db.transaction(db => db.query(
      'select observation_id, decision from core_private.consume_field_observation_request($1::uuid)',
      [operation.payloadRef],
    ));
    const result = rows[0];
    if (!result || result.decision !== 'created') return { outcome: 'rejected' as const, errorCode: String(result?.decision ?? 'request_missing') };
    return { outcome: 'acknowledged' as const, resultRef: String(result.observation_id) };
  }
}
