import type { AuthorizationRequest, AuthorizationDecisionResult } from "./authorization.ts";
import type { OperationEnvelope } from "./operation.ts";

export interface CapabilityInvocation<TInput = unknown> {
  capability: string;
  action: string;
  purpose: string;
  resourceId?: string;
  actorId: string;
  organisationId?: string;
  requestedAt: string;
  input: TInput;
}

export interface CapabilityAdmission<TInput = unknown> {
  invocation: CapabilityInvocation<TInput>;
  authorization: AuthorizationRequest;
}

export interface CapabilityExecution<TInput = unknown> {
  admission: CapabilityAdmission<TInput>;
  operation: OperationEnvelope;
}

export interface CapabilityResponse<TOutput = unknown> {
  operationId: string;
  state: OperationEnvelope["state"];
  output?: TOutput;
  provenanceRef?: string;
  auditEventId?: string;
}

export interface CapabilityGateway {
  authorize(
    request: AuthorizationRequest,
  ): Promise<AuthorizationDecisionResult>;

  submit<TInput>(
    execution: CapabilityExecution<TInput>,
  ): Promise<{ operationId: string }>;
}
