export type OperationState =
  | "created" | "authorized" | "queued" | "in_flight"
  | "acknowledged" | "retry_wait" | "blocked" | "conflict"
  | "expired" | "rejected" | "completed" | "cancelled";

export interface OperationEnvelope {
  operationId: string;
  idempotencyKey: string;
  action: string;
  resourceId?: string;
  organisationId?: string;
  identityId?: string;
  purpose: string;
  state: OperationState;
  createdAt: string;
  notBefore?: string;
  expiresAt?: string;
  attemptCount: number;
  payloadRef?: string;
  contentHash?: string;
  classification?: string;
  epistemicStatus?: string;
  provenanceRef?: string;
  leaseRef?: string;
  parentOperationId?: string;
}

export type OperationFailure =
  | "unauthorized"
  | "expired"
  | "integrity_failure"
  | "conflict"
  | "not_retryable"
  | "retry_exhausted"
  | "blocked";

export interface OperationTransition {
  operationId: string;
  from: OperationState;
  to: OperationState;
  at: string;
  failure?: OperationFailure;
  reason?: string;
}

export interface OperationPolicy {
  maxAttempts: number;
  retryBaseMs: number;
  retryMaxMs: number;
  requireLease: boolean;
  reauthorizeOnExecution: boolean;
}

export const TERMINAL_OPERATION_STATES: readonly OperationState[] = [
  "completed", "cancelled", "rejected", "expired"
];
