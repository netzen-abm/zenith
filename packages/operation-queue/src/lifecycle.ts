export type OperationState =
  | 'created' | 'authorized' | 'queued' | 'in_flight'
  | 'retry_wait' | 'blocked' | 'acknowledged'
  | 'completed' | 'rejected' | 'expired' | 'cancelled' | 'conflict';

export type Operation = {
  operationId: string;
  idempotencyKey: string;
  state: OperationState;
  attemptCount: number;
  expiresAt?: number;
  leaseValid: boolean;
};

const transitions: Record<OperationState, readonly OperationState[]> = {
  created: ['authorized', 'rejected', 'cancelled'],
  authorized: ['queued', 'rejected', 'expired', 'cancelled'],
  queued: ['blocked', 'expired', 'cancelled', 'in_flight'],
  in_flight: ['retry_wait', 'conflict', 'acknowledged', 'rejected'],
  retry_wait: ['queued', 'expired', 'rejected'],
  blocked: ['queued', 'cancelled', 'expired'],
  acknowledged: ['completed'],
  completed: [], rejected: [], expired: [], cancelled: [], conflict: []
};

export function transition(operation: Operation, next: OperationState, now = Date.now()): Operation {
  if (!transitions[operation.state].includes(next)) {
    throw new Error(`invalid_transition:${operation.state}:${next}`);
  }
  if (operation.expiresAt !== undefined && now >= operation.expiresAt && next !== 'expired') {
    throw new Error('operation_expired');
  }
  if (next === 'in_flight' && !operation.leaseValid) {
    throw new Error('authorization_required');
  }
  return { ...operation, state: next };
}

export function retry(operation: Operation, retryable: boolean, now = Date.now()): Operation {
  if (!retryable) return transition(operation, 'rejected', now);
  if (operation.expiresAt !== undefined && now >= operation.expiresAt) {
    return transition(operation, 'expired', now);
  }
  const waiting = transition(operation, 'retry_wait', now);
  return { ...waiting, attemptCount: waiting.attemptCount + 1 };
}

export function isTerminal(state: OperationState): boolean {
  return ['completed', 'rejected', 'expired', 'cancelled', 'conflict'].includes(state);
}
