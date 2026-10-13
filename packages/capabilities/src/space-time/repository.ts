import type { OperationEnvelope } from '../../../contracts/src/operation.ts';

export type SpaceTimeRepresentationPayload = {
  resourceId: string;
  representationType: string;
  geom?: unknown;
  precisionLevel: string;
  coordinateConfidence?: number;
  sourceEvidenceId?: string;
};

export type SpaceTimeRequestRepository = {
  saveRequest(
    operation: OperationEnvelope,
    representation: SpaceTimeRepresentationPayload,
    requestId: string,
    payloadHash: string,
  ): Promise<void>;
  consumeRequest(payloadRef: string): Promise<
    { representationId: string; decision: string } | undefined
  >;
  getOutcome(operationId: string): Promise<
    { outcome: string; resultRef?: string; resultHash?: string } | undefined
  >;
};
