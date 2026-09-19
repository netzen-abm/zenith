import { OperationEnvelope, OperationState } from "./operation";
import { validateLease, ExecutionLease } from "./execution";
import { canTransition } from "./operation-state";

export interface AuthorizationDecision {
  allowed: boolean;
  decision: string;
}

export interface CoordinatorDependencies {
  authorize: (operation: OperationEnvelope) => AuthorizationDecision;
  reserveExecution: (operation: OperationEnvelope) => AuthorizationDecision;
  handle: (operation: OperationEnvelope) => Promise<unknown>;
  audit: (event: CoordinatorEvent) => Promise<void>;
  release: (leaseId: string) => Promise<void>;
}

export interface CoordinatorEvent {
  operationId: string;
  outcome: string;
  from: OperationState;
  to: OperationState;
  reason?: string;
}

export type ExecutionOutcome =
  | "completed"
  | "duplicate"
  | "denied"
  | "lease_denied"
  | "expired"
  | "conflict"
  | "failed";

export async function executeOperation(
  operation: OperationEnvelope,
  lease: ExecutionLease | undefined,
  deps: CoordinatorDependencies,
  now: string,
): Promise<ExecutionOutcome> {
  if (!canTransition(operation.state, "in_flight")) {
    return "denied";
  }

  const leaseResult = validateLease(
    {
      operationId: operation.operationId,
      capability: operation.action,
      purpose: operation.purpose,
      leaseId: operation.leaseRef,
      at: now,
    },
    lease,
  );
  if (!leaseResult.allowed) {
    return leaseResult.decision === "deny_expired" ? "expired" : "lease_denied";
  }

  if (!deps.authorize(operation).allowed) return "denied";

  // The reservation is the execution-boundary gate: implementations must make
  // authorization + idempotency reservation atomic at their persistence boundary.
  const reservation = deps.reserveExecution(operation);
  if (!reservation.allowed) return reservation.decision === "duplicate" ? "duplicate" : "denied";

  try {
    await deps.handle(operation);
    await deps.audit({
      operationId: operation.operationId,
      outcome: "completed",
      from: operation.state,
      to: "in_flight",
    });
    if (operation.leaseRef) await deps.release(operation.leaseRef);
    return "completed";
  } catch (error) {
    await deps.audit({
      operationId: operation.operationId,
      outcome: "failed",
      from: operation.state,
      to: "in_flight",
      reason: error instanceof Error ? error.message : "handler_failure",
    });
    return "failed";
  }
}
