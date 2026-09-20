import type { OperationEnvelope } from '../../contracts/src/operation.ts';
import type {
  DurableOutcomeResult,
  ExecutionOutcome,
  ExecutionOutcomeRecorder,
} from './execution-coordinator.ts';

export type OutcomeSqlExecutor = {
  query<T extends Record<string, unknown>>(sql: string, params: readonly unknown[]): Promise<T[]>;
};

export class PostgresExecutionOutcomeRecorder implements ExecutionOutcomeRecorder {
  private readonly db: OutcomeSqlExecutor;

  constructor(db: OutcomeSqlExecutor) {
    this.db = db;
  }

  async record(operation: OperationEnvelope, outcome: ExecutionOutcome): Promise<DurableOutcomeResult> {
    const rows = await this.db.query<DurableOutcomeResult>(
      'select recorded, decision from operations.record_execution_outcome($1::uuid, $2, $3, $4, $5, $6, $7)',
      [
        operation.operationId,
        operation.attemptCount,
        outcome.outcome,
        outcome.errorCode ?? null,
        outcome.resultRef ?? null,
        outcome.resultHash ?? null,
        outcome.occurredAt ?? new Date().toISOString(),
      ],
    );
    const result = rows[0];
    if (!result) throw new Error('execution_outcome_no_result');
    return { recorded: result.recorded === true, decision: result.decision };
  }
}