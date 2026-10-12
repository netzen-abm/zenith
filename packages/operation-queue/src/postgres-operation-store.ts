import type { OperationEnvelope } from '../../contracts/src/operation.ts';

export type OperationStoreSqlExecutor = {
  query<T extends Record<string, unknown>>(sql: string, params: readonly unknown[]): Promise<T[]>;
};

export type CreateOrGetOperationInput = {
  operationId: string;
  idempotencyKey: string;
  action: string;
  organisationId: string;
  identityId: string;
  purpose: string;
  expiresAt: string;
  payloadRef?: string;
};

export type CreateOrGetOperationResult = {
  created: boolean;
  operation: OperationEnvelope;
};

export interface OperationStore {
  createOrGet(input: CreateOrGetOperationInput): Promise<CreateOrGetOperationResult>;
}

/** PostgreSQL persistence adapter; policy and execution remain in Core/coordinator. */
export class PostgresOperationStore implements OperationStore {
  private readonly db: OperationStoreSqlExecutor;

  constructor(db: OperationStoreSqlExecutor) {
    this.db = db;
  }

  async createOrGet(input: CreateOrGetOperationInput): Promise<CreateOrGetOperationResult> {
    const rows = await this.db.query<{
      created: boolean;
      operation_id: string;
      idempotency_key: string;
      action: string;
      identity_id: string;
      purpose: string;
      state: OperationEnvelope['state'];
      created_at: string;
      expires_at: string;
      attempt_count: number;
      payload_ref: string | null;
    }>(
      'select * from operations.create_or_get($1::uuid,$2,$3,$4::uuid,$5,$6::timestamptz,$7)',
      [
        input.operationId, input.idempotencyKey, input.action, input.identityId,
        input.purpose, input.expiresAt, input.payloadRef ?? null,
      ],
    );
    const row = rows[0];
    if (!row) throw new Error('operation_create_or_get_no_result');
    return {
      created: row.created === true,
      operation: {
        operationId: row.operation_id,
        idempotencyKey: row.idempotency_key,
        action: row.action,
        organisationId: input.organisationId,
        identityId: row.identity_id,
        purpose: row.purpose,
        state: row.state,
        createdAt: row.created_at,
        expiresAt: row.expires_at,
        attemptCount: row.attempt_count,
        ...(row.payload_ref == null ? {} : { payloadRef: row.payload_ref }),
      },
    };
  }
}
