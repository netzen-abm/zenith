import { randomUUID } from 'node:crypto';
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
    if (representation.geom !== undefined && representation.geom !== null && typeof representation.geom !== 'string') {
      throw new Error('space_time_geometry_must_be_text');
    }
    const payloadIdentity = {
      action: 'space_time.spatial_representation_create',
      organisationId: this.context.organisationId.toLowerCase(),
      identityId: this.context.identityId.toLowerCase(),
      purpose: this.context.purpose,
      resourceId: representation.resourceId.toLowerCase(),
      representationType: representation.representationType,
      geom: representation.geom ?? null,
      precisionLevel: representation.precisionLevel,
      coordinateConfidence: representation.coordinateConfidence ?? null,
      sourceEvidenceId: representation.sourceEvidenceId?.toLowerCase() ?? null,
    };
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
        payloadIdentity,
      });
      canonicalOperation = resolved.operation;
      if (!canonicalOperation.payloadRef) throw new Error('space_time_canonical_payload_ref_missing');
      if (!canonicalOperation.contentHash) throw new Error('space_time_payload_hash_missing');
      await this.repository.saveRequest(
        canonicalOperation,
        representation,
        canonicalOperation.payloadRef,
        canonicalOperation.contentHash,
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

    // If the mutation committed but outcome recording was interrupted, reservation
    // correctly denies a second execution. Reconcile only from the read-only
    // durable receipt; never call the mutation handler from this recovery path.
    if (!priorOutcome && result.decision === 'deny_reservation' && canonicalOperation.payloadRef) {
      const receipt = await this.repository.getConsumedReceipt(canonicalOperation.payloadRef);
      if (receipt) {
        const durable = await this.context.outcomeRecorder.record(
          { ...canonicalOperation, attemptCount: canonicalOperation.attemptCount ?? 1 },
          { outcome: 'acknowledged', resultRef: receipt },
        );
        if (!durable.recorded) {
          throw new Error(`space_time_recovery_outcome_not_durable:${durable.decision}`);
        }
        const recoveredOutcome = await this.repository.getOutcome(canonicalOperation.operationId);
        if (recoveredOutcome?.outcome !== 'acknowledged' || !recoveredOutcome.resultRef) {
          throw new Error('space_time_recovered_outcome_unavailable');
        }
        return { ...canonicalOperation, state: 'acknowledged', resultRef: recoveredOutcome.resultRef };
      }
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
