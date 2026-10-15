import type { OperationEnvelope } from '../../contracts/src/operation.ts';
import type { OperationStore } from '../../contracts/src/operation-store.ts';

export type ExecutionDecision = 'allow' | 'deny_authorization' | 'deny_reservation';
export type ReservationResult = { allowed: boolean; decision: string; attemptCount?: number };
export type ExecutionOutcome = {
  outcome: 'acknowledged' | 'retry_wait' | 'conflict' | 'rejected';
  errorCode?: string; resultRef?: string; resultHash?: string; occurredAt?: string;
};
export type DurableOutcomeResult = { recorded: boolean; decision: string };
export interface ExecutionAuthorization { authorize(operation: OperationEnvelope): Promise<boolean>; }
export interface ExecutionReservation { reserve(operationId: string): Promise<ReservationResult>; }
export interface ExecutionOutcomeRecorder {
  record(operation: OperationEnvelope, outcome: ExecutionOutcome): Promise<DurableOutcomeResult>;
  /** Return the latest durable outcome for an already-resolved canonical operation, if available. */
  findLatest?(operationId: string): Promise<ExecutionOutcome | undefined>;
}
export type ExecutionPreparation = (operation: OperationEnvelope) => Promise<OperationEnvelope | void>;
export type ExecutionHandler = (operation: OperationEnvelope) => Promise<ExecutionOutcome>;
export type ExecutionResult = { executed: boolean; decision: ExecutionDecision; outcome?: ExecutionOutcome };

export class ExecutionCoordinator {
  private readonly authorization: ExecutionAuthorization;
  private readonly reservation: ExecutionReservation;
  private readonly handler: ExecutionHandler;
  private readonly outcomeRecorder: ExecutionOutcomeRecorder;
  private readonly lifecycleStore?: Pick<OperationStore, 'transition'>;

  constructor(
    authorization: ExecutionAuthorization,
    reservation: ExecutionReservation,
    handler: ExecutionHandler,
    outcomeRecorder: ExecutionOutcomeRecorder,
    lifecycleStore?: Pick<OperationStore, 'transition'>,
  ) {
    this.authorization = authorization;
    this.reservation = reservation;
    this.handler = handler;
    this.outcomeRecorder = outcomeRecorder;
    this.lifecycleStore = lifecycleStore;
  }

  async execute(
    operation: OperationEnvelope,
    preparation?: ExecutionPreparation,
  ): Promise<ExecutionResult> {
    if (!await this.authorization.authorize(operation)) {
      return { executed: false, decision: 'deny_authorization' };
    }

    let admittedOperation = operation;
    if (preparation) {
      admittedOperation = (await preparation(operation)) ?? operation;
    }

    // Recover a previously committed outcome before attempting reservation. This is
    // the lost-response path: a duplicate request must return durable evidence, not
    // re-enter a provider or fail merely because the operation is already terminal.
    const priorOutcome = await this.outcomeRecorder.findLatest?.(admittedOperation.operationId);
    if (priorOutcome) {
      return { executed: true, decision: 'allow', outcome: priorOutcome };
    }

    // New canonical operations start at created. Advance them through the existing
    // compare-and-set lifecycle before reservation; never bypass the queued-state gate.
    if (this.lifecycleStore && (admittedOperation.state === 'created' || admittedOperation.state === 'authorized')) {
      if (admittedOperation.state === 'created') {
        await this.lifecycleStore.transition(admittedOperation.operationId, 'created', 'authorized');
        admittedOperation = { ...admittedOperation, state: 'authorized' };
      }
      if (admittedOperation.state === 'authorized') {
        await this.lifecycleStore.transition(admittedOperation.operationId, 'authorized', 'queued');
        admittedOperation = { ...admittedOperation, state: 'queued' };
      }
    }

    const reserved = await this.reservation.reserve(admittedOperation.operationId);
    if (!reserved.allowed) {
      return { executed: false, decision: 'deny_reservation' };
    }
    const executionOperation = reserved.attemptCount === undefined
      ? admittedOperation
      : { ...admittedOperation, attemptCount: reserved.attemptCount };
    let outcome: ExecutionOutcome;
    let handlerFailure: unknown;
    let handlerFailed = false;
    try {
      outcome = await this.handler(executionOperation);
    } catch (error) {
      // The handler may have performed an external side effect before throwing.
      // Record an ambiguous conflict so a retry cannot assume the side effect failed.
      handlerFailed = true;
      handlerFailure = error;
      outcome = { outcome: 'conflict', errorCode: 'handler_outcome_unknown' };
    }

    const durable = await this.outcomeRecorder.record(executionOperation, outcome);
    if (!durable.recorded) {
      throw new Error(`execution_outcome_not_durable:${durable.decision}`);
    }
    if (handlerFailed) {
      if (handlerFailure instanceof Error) throw handlerFailure;
      throw new Error('execution_handler_failed:conflict_outcome_recorded');
    }
    return { executed: true, decision: 'allow', outcome };
  }
}