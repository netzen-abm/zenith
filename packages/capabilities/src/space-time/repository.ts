export type SpaceTimeRequestRepository = {
  saveRequest(
    operation: {
      operationId: string;
      idempotencyKey: string;
      action: string;
      resourceId?: string;
      organisationId: string;
      identityId: string;
      purpose: string;
      payloadRef: string;
    },
    representation: {
      resourceId: string;
      representationType: string;
      geom?: unknown;
      precisionLevel: string;
      coordinateConfidence?: number;
      sourceEvidenceId?: string;
    },
    requestId: string,
  ): Promise<void>;
  consumeRequest(payloadRef: string): Promise<
    { representationId: string; decision: string } | undefined
  >;
};
