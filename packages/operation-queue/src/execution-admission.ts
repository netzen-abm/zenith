import type { OperationEnvelope } from '../../contracts/src/operation.ts';

export type ExecutionAdmissionTransaction = {
  transaction<T>(work: (db: {
    query<T extends Record<string, unknown>>(sql: string, params: readonly unknown[]): Promise<T[]>;
  }) => Promise<T>): Promise<T>;
};

export type ExecutionAdmissionPersistence = (
  db: Parameters<Parameters<ExecutionAdmissionTransaction['transaction']>[0]>[0],
) => Promise<void>;

export class PostgresExecutionAdmission {
  constructor(private readonly db: ExecutionAdmissionTransaction) {}

  async admit(
    operation: OperationEnvelope,
    persist: ExecutionAdmissionPersistence,
  ): Promise<OperationEnvelope> {
    await this.db.transaction(async db => {
      await persist(db);
      await db.query(
        'insert into operations.operations(id,organisation_id,identity_id,idempotency_key,action,resource_id,purpose,expires_at,payload_ref) values ($1,$2,$3,$4,$5,$6,$7,clock_timestamp()+interval \'1 hour\',$8)',
        [
          operation.operationId, operation.organisationId, operation.identityId,
          operation.idempotencyKey, operation.action, operation.resourceId,
          operation.purpose, operation.payloadRef,
        ],
      );
      await db.query('select operations.transition($1,\'created\',\'authorized\')', [operation.operationId]);
      await db.query('select operations.transition($1,\'authorized\',\'queued\')', [operation.operationId]);
    });
    return { ...operation, state: 'queued' };
  }
}
