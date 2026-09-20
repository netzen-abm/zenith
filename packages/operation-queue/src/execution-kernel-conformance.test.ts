import { strict as assert } from 'node:assert';
import type { OperationEnvelope } from '../../contracts/src/operation.ts';
import {
  ExecutionCoordinator,
  type ExecutionAuthorization,
  type ExecutionReservation,
  type ExecutionOutcomeRecorder,
} from './execution-coordinator.ts';

const operation: OperationEnvelope = {
  operationId: 'conformance-op',
  idempotencyKey: 'conformance-idem',
  action: 'conformance.execute',
  purpose: 'kernel-conformance',
  state: 'queued',
  createdAt: new Date().toISOString(),
  attemptCount: 0,
};

class AllowAuthorization implements ExecutionAuthorization {
  async authorize(): Promise<boolean> { return true; }
}
class DenyAuthorization implements ExecutionAuthorization {
  async authorize(): Promise<boolean> { return false; }
}
class AllowReservation implements ExecutionReservation {
  async reserve(): Promise<{ allowed: boolean; decision: string; attemptCount: number }> {
    return { allowed: true, decision: 'allow', attemptCount: 1 };
  }
}
class DenyReservation implements ExecutionReservation {
  async reserve(): Promise<{ allowed: boolean; decision: string }> {
    return { allowed: false, decision: 'deny_state' };
  }
}
class RecordingOutcome implements ExecutionOutcomeRecorder {
  calls: OperationEnvelope[] = [];
  async record(op: OperationEnvelope, outcome: { outcome: string }) {
    this.calls.push(op);
    return { recorded: true, decision: outcome.outcome };
  }
}
class FailingOutcome implements ExecutionOutcomeRecorder {
  async record() {
    return { recorded: false, decision: 'operation_not_in_flight' };
  }
}

const coordinator = (
  authorization: ExecutionAuthorization,
  reservation: ExecutionReservation,
  recorder: ExecutionOutcomeRecorder,
  onHandle: (op: OperationEnvelope) => void = () => {},
) => new ExecutionCoordinator(
  authorization,
  reservation,
  async (op) => {
    onHandle(op);
    return { outcome: 'acknowledged' };
  },
  recorder,
);

{
  const recorder = new RecordingOutcome();
  let entered = 0;
  const result = await coordinator(new DenyAuthorization(), new AllowReservation(), recorder, () => entered++).execute(operation);
  assert.deepEqual(result, { executed: false, decision: 'deny_authorization' });
  assert.equal(entered, 0);
  assert.equal(recorder.calls.length, 0);
}

{
  const recorder = new RecordingOutcome();
  let entered = 0;
  const result = await coordinator(new AllowAuthorization(), new DenyReservation(), recorder, () => entered++).execute(operation);
  assert.deepEqual(result, { executed: false, decision: 'deny_reservation' });
  assert.equal(entered, 0);
  assert.equal(recorder.calls.length, 0);
}

{
  const recorder = new RecordingOutcome();
  const seen: OperationEnvelope[] = [];
  const result = await coordinator(new AllowAuthorization(), new AllowReservation(), recorder, op => seen.push(op)).execute(operation);
  assert.deepEqual(result, { executed: true, decision: 'allow' });
  assert.equal(seen.length, 1);
  assert.equal(seen[0].attemptCount, 1);
  assert.equal(recorder.calls.length, 1);
  assert.equal(recorder.calls[0].attemptCount, 1);
}

{
  const recorder = new FailingOutcome();
  await assert.rejects(
    () => coordinator(new AllowAuthorization(), new AllowReservation(), recorder).execute(operation),
    /execution_outcome_not_durable:operation_not_in_flight/,
  );
}

{
  const recorder = new RecordingOutcome();
  let entered = 0;
  const reservation: ExecutionReservation = {
    async reserve() {
      return entered === 0
        ? (entered++, { allowed: true, decision: 'allow', attemptCount: 1 })
        : { allowed: false, decision: 'deny_state' };
    },
  };
  const results = await Promise.all([
    coordinator(new AllowAuthorization(), reservation, recorder, () => entered++).execute(operation),
    coordinator(new AllowAuthorization(), reservation, recorder, () => entered++).execute(operation),
  ]);
  assert.equal(results.filter(r => r.executed).length, 1);
}
