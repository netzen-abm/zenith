import type { OperationEnvelope } from '../../../contracts/src/operation.ts';
import type { FieldObservationRequest } from '../field-acquisition-operation.ts';

export type FieldAcquisitionRepository = {
  saveRequest(operation: OperationEnvelope, observation: FieldObservationRequest, context: {
    organisationId: string; identityId: string; purpose: string;
  }): Promise<void>;
  consumeRequest(payloadRef: string): Promise<{ observationId: string; decision: string } | undefined>;
};
