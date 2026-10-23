import type { OperationEnvelope, OperationState } from '../../contracts/src/operation.ts';
import type { CreateOrGetOperationInput, CreateOrGetOperationResult, OperationStore } from '../../contracts/src/operation-store.ts';

export type OperationStoreSqlExecutor = {
  query<T extends Record<string, unknown>>(sql: string, params: readonly unknown[]): Promise<T[]>;
};

/** PostgreSQL persistence adapter; policy and execution remain in Core/coordinator. */
export class PostgresOperationStore implements OperationStore {
  private readonly db: OperationStoreSqlExecutor;

  constructor(db: OperationStoreSqlExecutor) {
    this.db = db;
  }

  async createOrGet(input: CreateOrGetOperationInput): Promise<CreateOrGetOperationResult> {
    const hashAware = input.payloadIdentity !== undefined;
    if (hashAware && input.action === 'research.query' && input.resourceId) {
      throw new Error('research_payload_identity_must_not_have_resource_id');
    }
    if (hashAware && input.action !== 'research.query' && !input.resourceId) {
      throw new Error('operation_payload_identity_requires_resource_id');
    }
    const sql = hashAware
      ? 'select * from operations.create_or_get_with_payload_hash($1::uuid,$2::uuid,$3,$4,$5::uuid,$6,$7::timestamptz,$8::uuid,$9,$10::jsonb)'
      : 'select * from operations.create_or_get($1::uuid,$2::uuid,$3,$4,$5::uuid,$6,$7::timestamptz,$8)';
    const params = hashAware
      ? [
          input.operationId, input.organisationId, input.idempotencyKey, input.action, input.identityId,
          input.purpose, input.expiresAt, input.resourceId ?? null, input.payloadRef ?? null, JSON.stringify(input.payloadIdentity),
        ]
      : [
          input.operationId, input.organisationId, input.idempotencyKey, input.action, input.identityId,
          input.purpose, input.expiresAt, input.payloadRef ?? null,
        ];
    const rows = await this.db.query<{
      created: boolean;
      operation_id: string;
      organisation_id: string;
      idempotency_key: string;
      action: string;
      identity_id: string;
      purpose: string;
      state: OperationEnvelope['state'];
      created_at: string;
      expires_at: string;
      attempt_count: number;
      payload_ref: string | null;
      payload_hash?: string | null;
    }>(sql, params);
    const row = rows[0];
    if (!row) throw new Error('operation_create_or_get_no_result');
    return {
      created: row.created === true,
      operation: {
        operationId: row.operation_id,
        idempotencyKey: row.idempotency_key,
        action: row.action,
        ...(input.resourceId ? { resourceId: input.resourceId } : {}),
        organisationId: row.organisation_id,
        identityId: row.identity_id,
        purpose: row.purpose,
        state: row.state,
        createdAt: row.created_at,
        expiresAt: row.expires_at,
        attemptCount: row.attempt_count,
        ...(row.payload_ref == null ? {} : { payloadRef: row.payload_ref }),
        ...(row.payload_hash == null ? {} : { contentHash: row.payload_hash }),
      },
    };
  }

  async transition(operationId: string, expectedState: OperationState, nextState: OperationState): Promise<void> {
    const rows = await this.db.query<{ transition: unknown }>(
      'select operations.transition($1::uuid, $2, $3)',
      [operationId, expectedState, nextState],
    );
    if (rows.length === 0) throw new Error('operation_transition_no_result');
  }

}
