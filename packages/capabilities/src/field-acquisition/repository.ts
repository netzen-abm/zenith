import type { ExecutionAdmissionQueryExecutor } from '../../../operation-queue/src/execution-coordinator.ts';
import type { OperationEnvelope } from '../../../contracts/src/operation.ts';
import type { FieldObservationRequest } from '../field-acquisition-operation.ts';

export type FieldAcquisitionRepository = {
  persistRequest(db: ExecutionAdmissionQueryExecutor, operation: OperationEnvelope, observation: FieldObservationRequest, context: {
    organisationId: string; identityId: string; purpose: string;
  }): Promise<void>;
  consumeRequest(payloadRef: string): Promise<{ observationId: string; decision: string } | undefined>;
};