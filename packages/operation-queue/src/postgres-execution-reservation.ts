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
  private readonly db: SqlExecutor;

  constructor(db: SqlExecutor) {
    this.db = db;
  }

  async reserve(operationId: string): Promise<ReservationResult> {
    const rows = await this.db.query<{ allowed: boolean; decision: string; attempt_count: number | null }>(
      `select allowed, decision, attempt_count
         from operations.reserve_execution($1::uuid)`,
      [operationId],
    );
    const result = rows[0];
    if (!result) throw new Error('execution_reservation_no_result');

    return {
      allowed: result.allowed === true,
      decision: result.decision,
      ...(result.attempt_count == null ? {} : { attemptCount: result.attempt_count }),
    };
  }
}
