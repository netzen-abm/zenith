import type { OperationEnvelope } from '../../contracts/src/operation.ts';
import type { ExecutionAuthorization } from './execution-coordinator.ts';

type AuthorizationRow = { allowed: boolean; decision: string };

export type AuthorizationSqlExecutor = {
  query<T extends Record<string, unknown>>(sql: string, params: readonly unknown[]): Promise<T[]>;
};

export class PostgresCoreAuthorization implements ExecutionAuthorization {
  private readonly db: AuthorizationSqlExecutor;

  constructor(db: AuthorizationSqlExecutor) {
    this.db = db;
  }

  async authorize(operation: OperationEnvelope): Promise<boolean> {
    const rows = await this.db.query<AuthorizationRow>(
      'select allowed, decision from core.authorize_capability($1, $2::uuid, $3)',
      [operation.action, operation.resourceId ?? null, operation.purpose],
    );
    const decision = rows[0];
    return decision?.allowed === true && decision.decision === 'allow';
  }
}