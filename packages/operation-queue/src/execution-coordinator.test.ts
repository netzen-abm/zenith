import { strict as assert } from 'node:assert';
import type { OperationEnvelope } from '../../contracts/src/operation.ts';
import { ExecutionCoordinator, type ExecutionReservation } from './execution-coordinator.ts';

const operation: OperationEnvelope = {
  operationId: 'op-concurrent-1', idempotencyKey: 'idem-1', action: 'test.execute',
  purpose: 'execution-boundary-test', state: 'queued', createdAt: new Date().toISOString(),
  attemptCount: 0,
};

class ExactlyOneReservation implements ExecutionReservation {
  private reserved = false;
  private contenders = 0;
  async reserve(operationId: string) {
    assert.equal(operationId, operation.operationId);
    this.contenders += 1;
    await Promise.resolve();
    if (this.reserved) return { allowed: false, decision: 'deny_state' };
    this.reserved = true;
    return { allowed: true, decision: 'allow' };
  }
  get calls() { return this.contenders; }
}

let handlerEntries = 0;
const reservation = new ExactlyOneReservation();
const coordinator = new ExecutionCoordinator(
  { authorize: async () => true },
  reservation,
  async () => { handlerEntries += 1; },
);

const results = await Promise.all([
  coordinator.execute(operation),
  coordinator.execute(operation),
]);

assert.equal(reservation.calls, 2);
assert.equal(results.filter(result => result.executed).length, 1);
assert.equal(results.filter(result => result.decision === 'deny_reservation').length, 1);
assert.equal(handlerEntries, 1);

let deniedHandlerEntries = 0;
const denied = new ExecutionCoordinator(
  { authorize: async () => true },
  { reserve: async () => ({ allowed: false, decision: 'deny_state' }) },
  async () => { deniedHandlerEntries += 1; },
);
const deniedResult = await denied.execute(operation);
assert.deepEqual(deniedResult, { executed: false, decision: 'deny_reservation' });
assert.equal(deniedHandlerEntries, 0);
