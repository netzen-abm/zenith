import type { OperationEnvelope } from '../../contracts/src/operation.ts';
import type {
  AdmissionResult,
  ExecutionAdmission,
  ExecutionAdmissionPersistence,
  ExecutionAdmissionQueryExecutor,
} from './execution-coordinator.ts';

export type ExecutionAdmissionTransaction = {
  transaction<T>(work: (db: ExecutionAdmissionQueryExecutor) => Promise<T>): Promise<T>;
};

export class PostgresExecutionAdmission implements ExecutionAdmission {
  constructor(private readonly db: ExecutionAdmissionTransaction) {}

  async admit(
    operation: OperationEnvelope,
    persist?: ExecutionAdmissionPersistence,
  ): Promise<AdmissionResult> {
    await this.db.transaction(async db => {
      if (persist) await persist(db);
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
    return { admitted: true, decision: 'allow', operation: { ...operation, state: 'queued' } };
  }
}