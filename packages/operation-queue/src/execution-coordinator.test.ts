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


// A provider side effect may succeed even when durable outcome recording fails.
// Keep the reservation in-flight and prove a caller retry cannot enter the
// non-idempotent handler a second time. This is the crash-window safety gate.
let providerEffects = 0;
let reservationClaimed = false;
const crashWindowCoordinator = new ExecutionCoordinator(
  authorization,
  {
    async reserve() {
      if (reservationClaimed) {
        return { allowed: false, decision: 'deny_state' };
      }
      reservationClaimed = true;
      return { allowed: true, decision: 'allow', attemptCount: 2 };
    },
  },
  async () => {
    providerEffects += 1;
    return { outcome: 'acknowledged', resultRef: 'provider-operation-42' };
  },
  {
    async record() {
      throw new Error('simulated_process_interruption_before_durable_outcome');
    },
  },
);

await assert.rejects(
  () => crashWindowCoordinator.execute(operation),
  /simulated_process_interruption_before_durable_outcome/,
);
assert.equal(providerEffects, 1, 'first attempt reached the provider once');

// Retrying the same operation must be rejected at reservation; do not infer
// provider failure from the missing database outcome and repeat the side effect.
const ambiguousRetry = await crashWindowCoordinator.execute(operation);
assert.deepEqual(ambiguousRetry, {
  executed: false,
  decision: 'deny_reservation',
});
assert.equal(providerEffects, 1, 'ambiguous operation must not blindly replay');

// Ambiguous handler failures are durably recorded as conflicts before rethrow.
const handlerFailureOutcomes: string[] = [];
const handlerFailureCoordinator = new ExecutionCoordinator(
  authorization,
  { reserve: async () => ({ allowed: true, decision: 'allow', attemptCount: 3 }) },
  async () => { throw new Error('simulated_handler_failure'); },
  { async record(_operation, outcome) {
    handlerFailureOutcomes.push(`${outcome.outcome}:${outcome.errorCode}`);
    return { recorded: true, decision: 'recorded' };
  } },
);
await assert.rejects(() => handlerFailureCoordinator.execute(operation), /simulated_handler_failure/);
assert.deepEqual(handlerFailureOutcomes, ['conflict:handler_outcome_unknown']);


// Newly created canonical operations must traverse the database lifecycle before reservation.
const lifecycleCalls: string[] = [];
const createdLifecycleOperation: OperationEnvelope = {
  ...operation,
  operationId: 'op-created-lifecycle',
  idempotencyKey: 'idem-created-lifecycle',
  state: 'created',
  attemptCount: 0,
};
const lifecycleCoordinator = new ExecutionCoordinator(
  authorization,
  {
    async reserve(operationId) {
      assert.equal(operationId, createdLifecycleOperation.operationId);
      assert.deepEqual(lifecycleCalls, [
        'created:authorized',
        'authorized:queued',
      ]);
      return { allowed: true, decision: 'allow', attemptCount: 1 };
    },
  },
  async (admitted) => {
    assert.equal(admitted.state, 'queued');
    return { outcome: 'acknowledged' };
  },
  { async record() { return { recorded: true, decision: 'recorded' }; } },
  {
    async transition(operationId, expectedState, nextState) {
      assert.equal(operationId, createdLifecycleOperation.operationId);
      lifecycleCalls.push(expectedState + ':' + nextState);
    },
  },
);
const lifecycleResult = await lifecycleCoordinator.execute(createdLifecycleOperation);
assert.deepEqual(lifecycleResult, { executed: true, decision: 'allow', outcome: { outcome: 'acknowledged' } });
assert.deepEqual(lifecycleCalls, ['created:authorized', 'authorized:queued']);



// A durable prior outcome wins over reservation: retries return the recorded result
// without re-entering the provider handler.
let replayReservationCalls = 0;
let replayHandlerCalls = 0;
const replayCoordinator = new ExecutionCoordinator(
  authorization,
  { reserve: async () => { replayReservationCalls += 1; return { allowed: true, decision: 'allow' }; } },
  async () => { replayHandlerCalls += 1; return { outcome: 'acknowledged' }; },
  {
    async record() { throw new Error('replay_must_not_record_again'); },
    async findLatest(operationId) {
      assert.equal(operationId, operation.operationId);
      return { outcome: 'acknowledged', resultRef: 'durable:research-result-1' };
    },
  },
);
const replayResult = await replayCoordinator.execute(operation);
assert.deepEqual(replayResult, {
  executed: true,
  decision: 'allow',
  outcome: { outcome: 'acknowledged', resultRef: 'durable:research-result-1' },
});
assert.equal(replayReservationCalls, 0);
assert.equal(replayHandlerCalls, 0);

// A durable retry_wait is replayed while terminal for that attempt, but a deliberate
// retry_wait -> queued transition permits a new reservation and exactly one next attempt.
const retryWaitOperation: OperationEnvelope = {
  ...operation,
  operationId: 'op-retry-wait-requeued',
  idempotencyKey: 'idem-retry-wait-requeued',
  state: 'queued',
  attemptCount: 1,
};
let retryReservationCalls = 0;
let retryHandlerCalls = 0;
const retryRecordedAttempts: number[] = [];
const retryOutcomeRecorder = {
  async findLatest(id: string) {
    assert.equal(id, retryWaitOperation.operationId);
    return { outcome: 'retry_wait' as const, errorCode: 'crossref_http_429', attemptCount: 1 };
  },
  async record(op: OperationEnvelope, outcome: { outcome: string }) {
    retryRecordedAttempts.push(op.attemptCount ?? 0);
    assert.equal(outcome.outcome, 'acknowledged');
    return { recorded: true, decision: 'recorded' };
  },
};
const requeuedRetryCoordinator = new ExecutionCoordinator(
  authorization,
  {
    async reserve(id) {
      assert.equal(id, retryWaitOperation.operationId);
      retryReservationCalls += 1;
      return { allowed: true, decision: 'allow', attemptCount: 2 };
    },
  },
  async op => {
    retryHandlerCalls += 1;
    assert.equal(op.attemptCount, 2);
    return { outcome: 'acknowledged', resultRef: 'crossref:recovered-on-attempt-2' };
  },
  retryOutcomeRecorder,
);
const requeuedRetry = await requeuedRetryCoordinator.execute(retryWaitOperation);
assert.deepEqual(requeuedRetry, {
  executed: true,
  decision: 'allow',
  outcome: { outcome: 'acknowledged', resultRef: 'crossref:recovered-on-attempt-2' },
});
assert.equal(retryReservationCalls, 1, 'explicit requeue must reach the reservation gate');
assert.equal(retryHandlerCalls, 1, 're-queued retry invokes the handler exactly once');
assert.deepEqual(retryRecordedAttempts, [2], 'new outcome belongs to the newly reserved attempt');

// While the operation is still in retry_wait, a duplicate only replays the stored failure
// and never reserves another attempt.
let terminalRetryReservationCalls = 0;
let terminalRetryHandlerCalls = 0;
const terminalRetryCoordinator = new ExecutionCoordinator(
  authorization,
  { async reserve() { terminalRetryReservationCalls += 1; return { allowed: true, decision: 'allow' }; } },
  async () => { terminalRetryHandlerCalls += 1; return { outcome: 'acknowledged' }; },
  retryOutcomeRecorder,
);
const terminalRetryResult = await terminalRetryCoordinator.execute({ ...retryWaitOperation, state: 'retry_wait' });
assert.equal(terminalRetryResult.executed, true);
assert.equal(terminalRetryResult.outcome?.outcome, 'retry_wait');
assert.equal(terminalRetryReservationCalls, 0);
assert.equal(terminalRetryHandlerCalls, 0);

// A prior retry_wait must not mask a newer in-flight attempt whose outcome is missing.
let ambiguousNewerReservationCalls = 0;
let ambiguousNewerHandlerCalls = 0;
const staleOutcomeCoordinator = new ExecutionCoordinator(
  authorization,
  { async reserve() { ambiguousNewerReservationCalls += 1; return { allowed: true, decision: 'allow' }; } },
  async () => { ambiguousNewerHandlerCalls += 1; return { outcome: 'acknowledged' }; },
  retryOutcomeRecorder,
);
const ambiguousNewer = await staleOutcomeCoordinator.execute({ ...retryWaitOperation, state: 'in_flight', attemptCount: 2 });
assert.deepEqual(ambiguousNewer, { executed: false, decision: 'deny_reservation' });
assert.equal(ambiguousNewerReservationCalls, 0, 'do not re-enter a newer attempt when only the old attempt outcome is durable');
assert.equal(ambiguousNewerHandlerCalls, 0);

