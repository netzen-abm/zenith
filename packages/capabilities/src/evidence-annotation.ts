import { randomUUID } from 'node:crypto';
import type { OperationEnvelope } from '../../contracts/src/operation.ts';
import {
  ExecutionCoordinator,
  type ExecutionAuthorization,
  type ExecutionOutcomeRecorder,
  type ExecutionReservation,
} from '../../operation-queue/src/execution-coordinator.ts';

export type EvidenceAnnotationRequest = {
  resourceId: string; sourceId: string; evidenceType: string;
  locator?: Record<string, unknown>; excerpt?: string;
  evidencePayload?: Record<string, unknown>; epistemicStatus?: string; sensitivity?: string;
};
export type QueryExecutor = {
  query<T extends Record<string, unknown>>(sql: string, params: readonly unknown[]): Promise<T[]>;
};
export type TransactionExecutor = {
  transaction<T>(work: (db: QueryExecutor) => Promise<T>): Promise<T>;
};
type Context = { organisationId: string; identityId: string; purpose: string };

export class EvidenceAnnotationCapability {
  private readonly coordinator: ExecutionCoordinator;

  constructor(
    private readonly db: TransactionExecutor,
    private readonly authorization: ExecutionAuthorization,
    reservation: ExecutionReservation,
    outcomeRecorder: ExecutionOutcomeRecorder,
  ) {
    this.coordinator = new ExecutionCoordinator(
      authorization, reservation, operation => this.handle(operation), outcomeRecorder,
    );
  }

  async execute(request: EvidenceAnnotationRequest, context: Context): Promise<OperationEnvelope> {
    const operationId = randomUUID();
    const requestId = randomUUID();
    const operation = this.operation(operationId, requestId, request, context);
    if (!await this.authorization.authorize(operation)) {
      throw new Error('evidence_annotation_unauthorized');
    }
    await this.persist(operation, requestId, request, context);
    const result = await this.coordinator.execute(operation);
    if (!result.executed) throw new Error(`evidence_annotation_not_executed:${result.decision}`);
    return operation;
  }

  private operation(
    operationId: string, requestId: string, request: EvidenceAnnotationRequest, context: Context,
  ): OperationEnvelope {
    return {
      operationId, idempotencyKey: operationId, action: 'annotate',
      resourceId: request.resourceId, organisationId: context.organisationId,
      identityId: context.identityId, purpose: context.purpose,
      state: 'created', createdAt: new Date().toISOString(),
      attemptCount: 0, payloadRef: requestId,
    };
  }

  private async persist(
    operation: OperationEnvelope, requestId: string,
    request: EvidenceAnnotationRequest, context: Context,
  ): Promise<void> {
    await this.db.transaction(async db => {
      await db.query(
        'insert into core.evidence_annotation_requests(id,organisation_id,identity_id,resource_id,source_id,evidence_type,locator,excerpt,evidence_payload,epistemic_status,sensitivity) values ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9::jsonb,$10,$11)',
        [requestId, context.organisationId, context.identityId, request.resourceId, request.sourceId,
          request.evidenceType, JSON.stringify(request.locator ?? {}), request.excerpt ?? null,
          JSON.stringify(request.evidencePayload ?? {}), request.epistemicStatus ?? 'documented',
          request.sensitivity ?? 'public'],
      );
      await db.query(
        'insert into operations.operations(id,organisation_id,identity_id,idempotency_key,action,resource_id,purpose,expires_at,payload_ref) values ($1,$2,$3,$4,$5,$6,$7,clock_timestamp()+interval \'1 hour\',$8)',
        [operation.operationId, context.organisationId, context.identityId, operation.idempotencyKey,
          operation.action, request.resourceId, context.purpose, requestId],
      );
      await db.query('select operations.transition($1,\'created\',\'authorized\')', [operation.operationId]);
      await db.query('select operations.transition($1,\'authorized\',\'queued\')', [operation.operationId]);
    });
  }

  private async handle(operation: OperationEnvelope) {
    const rows = await this.db.transaction(db => db.query(
      'select evidence_id, decision from core.consume_evidence_annotation_request($1::uuid)',
      [operation.payloadRef],
    ));
    const result = rows[0];
    if (!result || result.decision !== 'created') {
      return { outcome: 'rejected' as const, errorCode: String(result?.decision ?? 'request_missing') };
    }
    return { outcome: 'acknowledged' as const, resultRef: String(result.evidence_id) };
  }
}
