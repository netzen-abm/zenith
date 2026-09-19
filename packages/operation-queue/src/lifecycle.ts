import type { OperationState } from '../../contracts/src/operation.ts';
import { OPERATION_TRANSITIONS } from '../../contracts/src/operation-state.ts';

export type Operation = {
  operationId: string;
  idempotencyKey: string;
  state: OperationState;
  attemptCount: number;
  expiresAt?: number;
  leaseValid: boolean;
};


export function transition(operation: Operation, next: OperationState, now = Date.now()): Operation {
  if (!OPERATION_TRANSITIONS[operation.state].includes(next)) {
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
  return ['completed', 'rejected', 'expired', 'cancelled'].includes(state);
}
