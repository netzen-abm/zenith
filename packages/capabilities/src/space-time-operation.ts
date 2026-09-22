import { randomUUID } from 'node:crypto';
import type { OperationEnvelope } from '../../contracts/src/operation.ts';
import { ExecutionCoordinator, type ExecutionAuthorization, type ExecutionOutcomeRecorder, type ExecutionReservation } from '../../operation-queue/src/execution-coordinator.ts';
import { validateSpatialRepresentation, type SpatialRepresentation } from './space-time.ts';
import type { SpaceTimeRequestRepository } from './space-time/repository.ts';

export type SpaceTimeRepresentationRequest = Omit<SpatialRepresentation, 'id'> & { geom?: unknown };
export type SpaceTimeExecutionContext = {
  organisationId: string; identityId: string; purpose: string;
  authorization: ExecutionAuthorization;
  reservation: ExecutionReservation;
  outcomeRecorder: ExecutionOutcomeRecorder;
};

export class SpaceTimeOperation {
  private readonly coordinator: ExecutionCoordinator;
  constructor(private readonly repository: SpaceTimeRequestRepository, private readonly context: SpaceTimeExecutionContext) {
    this.coordinator = new ExecutionCoordinator(
      context.authorization, context.reservation,
      operation => this.handle(operation), context.outcomeRecorder,
    );
  }

  async execute(request: SpaceTimeRepresentationRequest): Promise<OperationEnvelope> {
    const requestId = randomUUID();
    const operationId = randomUUID();
    const representation = { ...request, id: requestId };
    validateSpatialRepresentation(representation);
    const operation: OperationEnvelope = {
      operationId, idempotencyKey: operationId,
      action: 'space_time.spatial_representation_create',
      resourceId: representation.resourceId, organisationId: this.context.organisationId,
      identityId: this.context.identityId, purpose: this.context.purpose, state: 'created',
      createdAt: new Date().toISOString(), attemptCount: 0, payloadRef: requestId,
    };

    const result = await this.coordinator.execute(
      operation,
      async () => { await this.repository.saveRequest(operation, representation, requestId); operation.state = 'queued'; return operation; },
    );
    if (!result.executed) throw new Error(`space_time_not_executed:${result.decision}`);
    return operation;
  }

  private async handle(operation: OperationEnvelope) {
    const result = await this.repository.consumeRequest(operation.payloadRef);
    if (!result || result.decision !== 'created') {
      return { outcome: 'rejected' as const, errorCode: result?.decision ?? 'request_missing' };
    }
    return { outcome: 'acknowledged' as const, resultRef: result.representationId };
  }
}
