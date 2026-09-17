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

const retryable = retry({ ...base, state: 'in_flight' }, true);
assert.equal(retryable.state, 'retry_wait');
assert.equal(retryable.attemptCount, 1);

const rejected = retry({ ...base, state: 'in_flight' }, false);
assert.equal(rejected.state, 'rejected');

const expired = retry(
  { ...base, state: 'in_flight', expiresAt: 10 }, true, 10
);
assert.equal(expired.state, 'expired');

assert.throws(
  () => transition({ ...base, expiresAt: 10 }, 'authorized', 10),
  /operation_expired/
);
