import type { ExecutionReservation, ReservationResult } from './execution-coordinator.ts';

export type SqlExecutor = {
  query<T extends Record<string, unknown>>(
    sql: string,
    params: readonly unknown[],
  ): Promise<T[]>;
};

/**
 * PostgreSQL adapter for the canonical persistent execution reservation.
 * Authorization and atomic claiming remain inside the database boundary.
 */
export class PostgresExecutionReservation implements ExecutionReservation {
  constructor(private readonly db: SqlExecutor) {}

  async reserve(operationId: string): Promise<ReservationResult> {
    const rows = await this.db.query<{ allowed: boolean; decision: string }>(
      `select allowed, decision
         from operations.reserve_execution($1::uuid)`,
      [operationId],
    );
    const result = rows[0];
    if (!result) throw new Error('execution_reservation_no_result');

    return {
      allowed: result.allowed === true,
      decision: result.decision,
    };
  }
}
