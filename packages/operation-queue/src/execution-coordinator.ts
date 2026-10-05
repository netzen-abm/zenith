import type { OperationEnvelope } from '../../contracts/src/operation.ts';

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
}
export interface ExecutionAdmission {
  admit(
    operation: OperationEnvelope,
    persist: (db: { query<T extends Record<string, unknown>>(sql: string, params: readonly unknown[]): Promise<T[]> }) => Promise<void>,
  ): Promise<OperationEnvelope>;
}
export type ExecutionPreparation = (operation: OperationEnvelope) => Promise<OperationEnvelope | void>;
export type ExecutionHandler = (operation: OperationEnvelope) => Promise<ExecutionOutcome>;
export type ExecutionResult = { executed: boolean; decision: ExecutionDecision };

export class ExecutionCoordinator {
  private readonly authorization: ExecutionAuthorization;
  private readonly reservation: ExecutionReservation;
  private readonly handler: ExecutionHandler;
  private readonly outcomeRecorder: ExecutionOutcomeRecorder;

  constructor(
    authorization: ExecutionAuthorization,
    reservation: ExecutionReservation,
    handler: ExecutionHandler,
    outcomeRecorder: ExecutionOutcomeRecorder,
  ) {
    this.authorization = authorization;
    this.reservation = reservation;
    this.handler = handler;
    this.outcomeRecorder = outcomeRecorder;
  }

  async execute(
    operation: OperationEnvelope,
    preparationOrAdmission?: ExecutionPreparation | ExecutionAdmission,
    persist?: Parameters<ExecutionAdmission['admit']>[1],
  ): Promise<ExecutionResult> {
    if (!await this.authorization.authorize(operation)) {
      return { executed: false, decision: 'deny_authorization' };
    }

    let admittedOperation = operation;
    if (typeof preparationOrAdmission === 'function') {
      admittedOperation = (await preparationOrAdmission(operation)) ?? operation;
    } else if (preparationOrAdmission) {
      if (!persist) throw new Error('execution_admission_persistence_required');
      admittedOperation = await preparationOrAdmission.admit(operation, persist);
    }

    const reserved = await this.reservation.reserve(admittedOperation.operationId);
    if (!reserved.allowed) {
      return { executed: false, decision: 'deny_reservation' };
    }
    const executionOperation = reserved.attemptCount === undefined
      ? admittedOperation
      : { ...admittedOperation, attemptCount: reserved.attemptCount };
    const outcome = await this.handler(executionOperation);
    const durable = await this.outcomeRecorder.record(executionOperation, outcome);
    if (!durable.recorded) {
      throw new Error(`execution_outcome_not_durable:${durable.decision}`);
    }
    return { executed: true, decision: 'allow' };
  }
}