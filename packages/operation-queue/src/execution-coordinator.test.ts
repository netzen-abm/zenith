import { strict as assert } from 'node:assert';
import type { OperationEnvelope } from '../../contracts/src/operation.ts';
import {
  ExecutionCoordinator,
  type ExecutionReservation,
} from './execution-coordinator.ts';
import { PostgresCoreAuthorization } from './postgres-core-authorization.ts';

const operation: OperationEnvelope = {
  operationId: 'op-concurrent-1',
  idempotencyKey: 'idem-1',
  action: 'test.execute',
  purpose: 'execution-boundary-test',
  state: 'queued',
  createdAt: new Date().toISOString(),
  attemptCount: 1,
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

  get calls() {
    return this.contenders;
  }
}

const authorizationCalls: string[] = [];
const authorization = new PostgresCoreAuthorization({
  async query(sql, params) {
    authorizationCalls.push(String(sql) + '|' + params.join('|'));
    return [{ allowed: true, decision: 'allow' }];
  },
});

const recorded: string[] = [];
const outcomeRecorder = {
  async record(_operation: OperationEnvelope, outcome: { outcome: string }) {
    recorded.push(outcome.outcome);
    return { recorded: true, decision: 'recorded' };
  },
};

let handlerEntries = 0;
const reservation = new ExactlyOneReservation();
const coordinator = new ExecutionCoordinator(
  authorization,
  reservation,
  async () => {
    handlerEntries += 1;
    return { outcome: 'acknowledged' };
  },
  outcomeRecorder,
);

const results = await Promise.all([
  coordinator.execute(operation),
  coordinator.execute(operation),
]);

assert.equal(authorizationCalls.length, 2);
assert.match(authorizationCalls[0], /core\.authorize_capability/);
assert.equal(reservation.calls, 2);
assert.equal(results.filter((result) => result.executed).length, 1);
assert.equal(
  results.filter((result) => result.decision === 'deny_reservation').length,
  1,
);
assert.equal(handlerEntries, 1);
assert.deepEqual(recorded, ['acknowledged']);

let deniedHandlerEntries = 0;
let deniedOutcomeRecords = 0;
const denied = new ExecutionCoordinator(
  authorization,
  { reserve: async () => ({ allowed: false, decision: 'deny_state' }) },
  async () => {
    deniedHandlerEntries += 1;
    return { outcome: 'acknowledged' };
  },
  {
    record: async () => {
      deniedOutcomeRecords += 1;
      return { recorded: true, decision: 'recorded' };
    },
  },
);
const deniedResult = await denied.execute(operation);
assert.deepEqual(deniedResult, {
  executed: false,
  decision: 'deny_reservation',
});
assert.equal(deniedHandlerEntries, 0);
assert.equal(deniedOutcomeRecords, 0);

const failedDurability = new ExecutionCoordinator(
  authorization,
  { reserve: async () => ({ allowed: true, decision: 'allow' }) },
  async () => ({ outcome: 'acknowledged' }),
  {
    record: async () => ({
      recorded: false,
      decision: 'operation_not_in_flight',
    }),
  },
);
await assert.rejects(
  () => failedDurability.execute(operation),
  /execution_outcome_not_durable:operation_not_in_flight/,
);
