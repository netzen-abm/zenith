import { randomUUID } from 'node:crypto';
import type { OperationEnvelope } from '../../contracts/src/operation.ts';
import { ExecutionCoordinator, type ExecutionAuthorization, type ExecutionOutcomeRecorder, type ExecutionReservation } from '../../operation-queue/src/execution-coordinator.ts';
import { validateFieldObservation, type FieldObservation } from './field-acquisition.ts';
import type { FieldAcquisitionRepository } from './field-acquisition/repository.ts';

export type FieldObservationRequest = Omit<FieldObservation, 'id'> & { idempotencyKey: string };
export type FieldExecutionContext = {
  organisationId: string; identityId: string; purpose: string;
  authorization: ExecutionAuthorization; reservation: ExecutionReservation; outcomeRecorder: ExecutionOutcomeRecorder;
};

export class FieldAcquisitionOperation {
  private readonly coordinator: ExecutionCoordinator;
  constructor(private readonly repository: FieldAcquisitionRepository, private readonly context: FieldExecutionContext) {
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
      await this.repository.saveRequest(operation, observation, this.context);
      operation.state = 'queued';
      return operation;
    });
    if (!result.executed) throw new Error('field_observation_not_executed:' + result.decision);
    return operation;
  }

  private async handle(operation: OperationEnvelope) {
    const result = await this.repository.consumeRequest(operation.payloadRef);
    if (!result || result.decision !== 'created') return { outcome: 'rejected' as const, errorCode: result?.decision ?? 'request_missing' };
    return { outcome: 'acknowledged' as const, resultRef: result.observationId };
  }
}
