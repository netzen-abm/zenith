import type { OperationEnvelope } from './operation.ts';

export type CreateOrGetOperationInput = {
  operationId: string;
  idempotencyKey: string;
  action: string;
  organisationId: string;
  identityId: string;
  purpose: string;
  expiresAt: string;
  payloadRef?: string;
};

export type CreateOrGetOperationResult = {
  created: boolean;
  operation: OperationEnvelope;
}

/** Persistence contract only; it does not authorize or execute operations. */
export interface OperationStore {
  createOrGet(input: CreateOrGetOperationInput): Promise<CreateOrGetOperationResult>;
}
