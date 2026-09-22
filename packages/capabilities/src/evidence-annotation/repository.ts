import type { OperationEnvelope } from '../../../contracts/src/operation.ts';
import type { EvidenceAnnotationRequest } from '../evidence-annotation.ts';

export type EvidenceAnnotationRepository = {
  saveRequest(operation: OperationEnvelope, request: EvidenceAnnotationRequest, context: {
    organisationId: string; identityId: string;
  }): Promise<void>;
  consumeRequest(payloadRef: string): Promise<{ evidenceId: string; decision: string } | undefined>;
};
