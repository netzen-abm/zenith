import { OperationState } from "./operation";

const transitions: Record<OperationState, readonly OperationState[]> = {
  created: ["authorized", "rejected", "cancelled"],
  authorized: ["queued", "rejected", "cancelled", "expired"],
  queued: ["in_flight", "cancelled", "expired", "blocked"],
  in_flight: ["acknowledged", "retry_wait", "conflict", "blocked", "expired", "rejected"],
  acknowledged: ["completed"],
  retry_wait: ["queued", "expired", "blocked", "cancelled"],
  blocked: ["queued", "cancelled", "expired", "rejected"],
  conflict: ["queued", "cancelled", "rejected"],
  expired: [],
  rejected: [],
  completed: [],
  cancelled: [],
};

export function canTransition(from: OperationState, to: OperationState): boolean {
  return transitions[from].includes(to);
}

export function transition(
  operationId: string,
  from: OperationState,
  to: OperationState,
  at: string,
  reason?: string,
) {
  if (!canTransition(from, to)) {
    throw new Error(`invalid_operation_transition:${from}->${to}`);
  }
  return { operationId, from, to, at, reason };
}

export function isTerminal(state: OperationState): boolean {
  return ["completed", "cancelled", "rejected", "expired"].includes(state);
}
