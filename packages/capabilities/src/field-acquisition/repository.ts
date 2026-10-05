import type { ExecutionAdmission } from '../../../operation-queue/src/execution-coordinator.ts';
import type { OperationEnvelope } from '../../../contracts/src/operation.ts';
import type { FieldObservationRequest } from '../field-acquisition-operation.ts';

export type FieldAcquisitionRepository = {
  admitRequest(operation: OperationEnvelope, observation: FieldObservationRequest, context: {
    organisationId: string; identityId: string; purpose: string;
  }): Promise<Awaited<ReturnType<ExecutionAdmission['admit']>>>;
  consumeRequest(payloadRef: string): Promise<{ observationId: string; decision: string } | undefined>;
};