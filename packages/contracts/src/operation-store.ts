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
  /** Canonical lowercase SHA-256 hash for domains that require payload equivalence. */
  payloadHash?: string;
  resourceId?: string;
};

export type CreateOrGetOperationResult = {
  created: boolean;
  operation: OperationEnvelope;
};

/** Persistence contract only; it does not authorize or execute operations. */
export interface OperationStore {
  createOrGet(input: CreateOrGetOperationInput): Promise<CreateOrGetOperationResult>;
}
