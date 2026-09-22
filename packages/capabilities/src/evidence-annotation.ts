import { randomUUID } from 'node:crypto';
import type { OperationEnvelope } from '../../contracts/src/operation.ts';
import { ExecutionCoordinator, type ExecutionAuthorization, type ExecutionOutcomeRecorder, type ExecutionReservation } from '../../operation-queue/src/execution-coordinator.ts';
import type { EvidenceAnnotationRepository } from './evidence-annotation/repository.ts';

export type EvidenceAnnotationRequest = {
  resourceId: string; sourceId: string; evidenceType: string;
  locator?: Record<string, unknown>; excerpt?: string;
  evidencePayload?: Record<string, unknown>; epistemicStatus?: string; sensitivity?: string;
};
type Context = { organisationId: string; identityId: string; purpose: string };

export class EvidenceAnnotationCapability {
  private readonly coordinator: ExecutionCoordinator;
  constructor(
    private readonly repository: EvidenceAnnotationRepository,
    authorization: ExecutionAuthorization,
    reservation: ExecutionReservation,
    outcomeRecorder: ExecutionOutcomeRecorder,
  ) {
    this.coordinator = new ExecutionCoordinator(
      authorization, reservation, operation => this.handle(operation), outcomeRecorder,
    );
  }

  async execute(request: EvidenceAnnotationRequest, context: Context): Promise<OperationEnvelope> {
    const operationId = randomUUID();
    const requestId = randomUUID();
    const operation = this.operation(operationId, requestId, request, context);
    const result = await this.coordinator.execute(operation, async () => {
      await this.repository.saveRequest(operation, request, context);
      operation.state = 'queued';
      return operation;
    });
    if (!result.executed) throw new Error(`evidence_annotation_not_executed:${result.decision}`);
    return operation;
  }

  private operation(operationId: string, requestId: string, request: EvidenceAnnotationRequest, context: Context): OperationEnvelope {
    return {
      operationId, idempotencyKey: operationId, action: 'annotate',
      resourceId: request.resourceId, organisationId: context.organisationId,
      identityId: context.identityId, purpose: context.purpose, state: 'created',
      createdAt: new Date().toISOString(), attemptCount: 0, payloadRef: requestId,
    };
  }

  private async handle(operation: OperationEnvelope) {
    const result = await this.repository.consumeRequest(operation.payloadRef);
    if (!result || result.decision !== 'created') return { outcome: 'rejected' as const, errorCode: result?.decision ?? 'request_missing' };
    return { outcome: 'acknowledged' as const, resultRef: result.evidenceId };
  }
}
