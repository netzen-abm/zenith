import { strict as assert } from 'node:assert';
import { isTerminal, retry, transition, type Operation } from './lifecycle.ts';

const base: Operation = {
  operationId: 'op-1', idempotencyKey: 'idem-1', state: 'created',
  attemptCount: 0, leaseValid: true
};

let op = transition(base, 'authorized');
op = transition(op, 'queued');
op = transition(op, 'in_flight');
op = transition(op, 'acknowledged');
op = transition(op, 'completed');
assert.equal(isTerminal(op.state), true);

assert.throws(() => transition(base, 'in_flight'), /invalid_transition/);
assert.throws(
  () => transition({ ...base, state: 'queued', leaseValid: false }, 'in_flight'),
  /authorization_required/
);
assert.throws(
  () => transition({ ...base, state: 'in_flight', expiresAt: 10 }, 'acknowledged', 10),
  /operation_expired/
);
assert.equal(transition({ ...base, state: 'in_flight', expiresAt: 10 }, 'expired', 10).state, 'expired');

const retryable = retry({ ...base, state: 'in_flight' }, true);
assert.equal(retryable.state, 'retry_wait');
assert.equal(retryable.attemptCount, 1);
assert.equal(retry({ ...base, state: 'in_flight', expiresAt: 10 }, true, 10).state, 'expired');
assert.equal(retry({ ...base, state: 'in_flight' }, false).state, 'rejected');

assert.throws(
  () => transition({ ...base, state: 'completed' }, 'queued'),
  /invalid_transition/
);
