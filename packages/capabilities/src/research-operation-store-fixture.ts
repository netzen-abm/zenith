import type { OperationEnvelope, OperationState } from '../../contracts/src/operation.ts';
import type { CreateOrGetOperationInput, CreateOrGetOperationResult, OperationStore } from '../../contracts/src/operation-store.ts';

/** Deterministic test double; production must use a durable implementation. */
export class MemoryOperationStore implements OperationStore {
  private readonly operations = new Map<string, OperationEnvelope>();

  async createOrGet(input: CreateOrGetOperationInput): Promise<CreateOrGetOperationResult> {
    const key = input.organisationId + ':' + input.idempotencyKey;
    const existing = this.operations.get(key);
    if (existing) {
      if (existing.action !== input.action || existing.identityId !== input.identityId ||
          existing.purpose !== input.purpose || existing.payloadRef !== input.payloadRef) {
        throw new Error('operation_idempotency_conflict');
      }
      return { created: false, operation: { ...existing } };
    }
    const operation: OperationEnvelope = {
      operationId: input.operationId,
      idempotencyKey: input.idempotencyKey,
      action: input.action,
      organisationId: input.organisationId,
      identityId: input.identityId,
      purpose: input.purpose,
      state: 'created',
      createdAt: new Date().toISOString(),
      expiresAt: input.expiresAt,
      attemptCount: 0,
      ...(input.payloadRef === undefined ? {} : { payloadRef: input.payloadRef }),
    };
    this.operations.set(key, operation);
    return { created: true, operation: { ...operation } };
  }

  async transition(operationId: string, expectedState: OperationState, nextState: OperationState): Promise<void> {
    const entry = [...this.operations.entries()].find(([, operation]) => operation.operationId === operationId);
    if (!entry) throw new Error('operation_not_found');
    const [key, operation] = entry;
    if (operation.state !== expectedState) throw new Error('operation_transition_conflict');
    const allowed = (expectedState === 'created' && nextState === 'authorized') ||
      (expectedState === 'authorized' && nextState === 'queued');
    if (!allowed) throw new Error('operation_transition_invalid');
    this.operations.set(key, { ...operation, state: nextState });
  }

}
