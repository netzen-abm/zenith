import { createHash, randomUUID } from 'node:crypto';
import type { OperationEnvelope } from '../../contracts/src/operation.ts';
import type { OperationStore } from '../../contracts/src/operation-store.ts';
import { ExecutionCoordinator, type ExecutionAuthorization, type ExecutionOutcomeRecorder, type ExecutionReservation } from '../../operation-queue/src/execution-coordinator.ts';
import { validateSpatialRepresentation, type SpatialRepresentation } from './space-time.ts';
import type { SpaceTimeRequestRepository } from './space-time/repository.ts';

export type SpaceTimeRepresentationRequest = Omit<SpatialRepresentation, 'id'> & {
  geom?: unknown;
  /** Stable caller-supplied key reused for every retry of this logical request. */
  idempotencyKey: string;
};
export type SpaceTimeExecutionContext = {
  organisationId: string; identityId: string; purpose: string;
  authorization: ExecutionAuthorization;
  reservation: ExecutionReservation;
  outcomeRecorder: ExecutionOutcomeRecorder;
  operationStore: OperationStore;
};

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, child]) => child !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, child]) => [key, canonicalize(child)]),
    );
  }
  if (typeof value === 'number' && !Number.isFinite(value)) {
    throw new Error('space_time_payload_non_finite_number');
  }
  return value === undefined ? null : value;
}

function payloadHash(value: unknown): string {
  const canonical = JSON.stringify(canonicalize(value));
  return createHash('sha256').update(canonical).digest('hex');
}

export class SpaceTimeOperation {
  private readonly coordinator: ExecutionCoordinator;
  constructor(private readonly repository: SpaceTimeRequestRepository, private readonly context: SpaceTimeExecutionContext) {
    this.coordinator = new ExecutionCoordinator(
      context.authorization, context.reservation,
      operation => this.handle(operation), context.outcomeRecorder,
    );
  }

  async execute(request: SpaceTimeRepresentationRequest): Promise<OperationEnvelope> {
    if (typeof request.idempotencyKey !== 'string' || !request.idempotencyKey.trim()) {
      throw new Error('space_time_idempotency_key_required');
    }
    const requestId = randomUUID();
    const representation = { ...request, id: requestId };
    validateSpatialRepresentation(representation);
    const hash = payloadHash({
      action: 'space_time.spatial_representation_create',
      organisationId: this.context.organisationId,
      identityId: this.context.identityId,
      purpose: this.context.purpose,
      resourceId: representation.resourceId,
      representationType: representation.representationType,
      geom: representation.geom ?? null,
      precisionLevel: representation.precisionLevel,
      coordinateConfidence: representation.coordinateConfidence ?? null,
      sourceEvidenceId: representation.sourceEvidenceId ?? null,
    });
    const operation: OperationEnvelope = {
      operationId: randomUUID(),
      idempotencyKey: request.idempotencyKey.trim(),
      action: 'space_time.spatial_representation_create',
      resourceId: representation.resourceId,
      organisationId: this.context.organisationId,
      identityId: this.context.identityId,
      purpose: this.context.purpose,
      state: 'created',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      attemptCount: 0,
      payloadRef: requestId,
      contentHash: hash,
    };

    let canonicalOperation = operation;
    const result = await this.coordinator.execute(operation, async candidate => {
      const resolved = await this.context.operationStore.createOrGet({
        operationId: candidate.operationId,
        idempotencyKey: candidate.idempotencyKey,
        action: candidate.action,
        organisationId: this.context.organisationId,
        identityId: this.context.identityId,
        purpose: this.context.purpose,
        expiresAt: candidate.expiresAt!,
        resourceId: representation.resourceId,
        payloadRef: candidate.payloadRef,
        payloadHash: hash,
      });
      canonicalOperation = resolved.operation;
      if (!canonicalOperation.payloadRef) throw new Error('space_time_canonical_payload_ref_missing');
      await this.repository.saveRequest(
        canonicalOperation,
        representation,
        canonicalOperation.payloadRef,
        hash,
      );
      if (canonicalOperation.state === 'created' || canonicalOperation.state === 'authorized') {
        canonicalOperation = { ...canonicalOperation, state: 'queued' };
      }
      return canonicalOperation;
    });

    if (result.executed) {
      const completedOutcome = await this.repository.getOutcome(canonicalOperation.operationId);
      if (completedOutcome?.outcome !== 'acknowledged' || !completedOutcome.resultRef) {
        throw new Error('space_time_outcome_unavailable_after_execution');
      }
      return { ...canonicalOperation, state: 'acknowledged', resultRef: completedOutcome.resultRef };
    }
    const priorOutcome = await this.repository.getOutcome(canonicalOperation.operationId);
    if (priorOutcome?.outcome === 'acknowledged' && priorOutcome.resultRef) {
      return { ...canonicalOperation, state: 'acknowledged', resultRef: priorOutcome.resultRef };
    }
    throw new Error(`space_time_not_executed:${result.decision}`);
  }

  private async handle(operation: OperationEnvelope) {
    const result = await this.repository.consumeRequest(operation.payloadRef ?? '');
    if (!result || result.decision !== 'created') {
      return { outcome: 'rejected' as const, errorCode: result?.decision ?? 'request_missing' };
    }
    return { outcome: 'acknowledged' as const, resultRef: result.representationId };
  }
}
