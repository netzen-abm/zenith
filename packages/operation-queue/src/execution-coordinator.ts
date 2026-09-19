import type { OperationEnvelope } from '../../contracts/src/operation.ts';

export type ExecutionDecision = 'allow' | 'deny_authorization' | 'deny_reservation';

export type ReservationResult = {
  allowed: boolean;
  decision: string;
};

export interface ExecutionAuthorization {
  authorize(operation: OperationEnvelope): Promise<boolean>;
}

export interface ExecutionReservation {
  reserve(operationId: string): Promise<ReservationResult>;
}

export type ExecutionHandler = (operation: OperationEnvelope) => Promise<void>;

export type ExecutionResult = {
  executed: boolean;
  decision: ExecutionDecision;
};

/**
 * Coordinates execution without becoming an authorization authority.
 * The persistent reservation is the final concurrency gate before handler entry.
 * Keep the coordinator orchestration-only; authorization remains canonical in Core.
 */
export class ExecutionCoordinator {
  private readonly authorization: ExecutionAuthorization;
  private readonly reservation: ExecutionReservation;
  private readonly handler: ExecutionHandler;

  constructor(
    authorization: ExecutionAuthorization,
    reservation: ExecutionReservation,
    handler: ExecutionHandler,
  ) {
    this.authorization = authorization;
    this.reservation = reservation;
    this.handler = handler;
  }

  async execute(operation: OperationEnvelope): Promise<ExecutionResult> {
    const authorized = await this.authorization.authorize(operation);
    if (!authorized) return { executed: false, decision: 'deny_authorization' };

    const reserved = await this.reservation.reserve(operation.operationId);
    if (!reserved.allowed) return { executed: false, decision: 'deny_reservation' };

    await this.handler(operation);
    return { executed: true, decision: 'allow' };
  }
}
