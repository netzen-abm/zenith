export type LeaseDecision =
  | "allow"
  | "deny_missing"
  | "deny_expired"
  | "deny_mismatch"
  | "deny_revoked";

export interface ExecutionLease {
  leaseId: string;
  operationId: string;
  capability: string;
  purpose: string;
  issuedAt: string;
  expiresAt: string;
  revokedAt?: string;
}

export interface ExecutionRequest {
  operationId: string;
  capability: string;
  purpose: string;
  leaseId?: string;
  at: string;
}

export interface LeaseValidation {
  allowed: boolean;
  decision: LeaseDecision;
  leaseId?: string;
}

export type ReconciliationDecision =
  | "accept"
  | "reject"
  | "conflict"
  | "reauthorize";

export interface ReconciliationResult {
  operationId: string;
  decision: ReconciliationDecision;
  reason: string;
  appliedAt?: string;
}

export function validateLease(
  request: ExecutionRequest,
  lease: ExecutionLease | undefined,
): LeaseValidation {
  if (!lease) return { allowed: false, decision: "deny_missing" };
  if (lease.leaseId !== request.leaseId || lease.operationId !== request.operationId) {
    return { allowed: false, decision: "deny_mismatch" };
  }
  if (lease.capability !== request.capability || lease.purpose !== request.purpose) {
    return { allowed: false, decision: "deny_mismatch" };
  }
  if (lease.revokedAt && new Date(lease.revokedAt).getTime() <= new Date(request.at).getTime()) {
    return { allowed: false, decision: "deny_revoked" };
  }
  if (new Date(request.at).getTime() >= new Date(lease.expiresAt).getTime()) {
    return { allowed: false, decision: "deny_expired" };
  }
  return { allowed: true, decision: "allow", leaseId: lease.leaseId };
}

export function reconcile(
  operationId: string,
  localHash: string,
  remoteHash: string,
): ReconciliationResult {
  if (localHash === remoteHash) {
    return { operationId, decision: "accept", reason: "integrity_match" };
  }
  return {
    operationId,
    decision: "conflict",
    reason: "integrity_mismatch_requires_reconciliation",
  };
}
