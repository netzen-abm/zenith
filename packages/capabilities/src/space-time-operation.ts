import { randomUUID } from 'node:crypto';
import type { OperationEnvelope } from '../../contracts/src/operation.ts';
import { ExecutionCoordinator, type ExecutionAuthorization, type ExecutionOutcomeRecorder, type ExecutionReservation } from '../../operation-queue/src/execution-coordinator.ts';
import { validateSpatialRepresentation, type SpatialRepresentation } from './space-time.ts';

export type SpaceTimeRepresentationRequest = Omit<SpatialRepresentation, 'id'> & { geom?: unknown };
export type SpaceTimeExecutionContext = {
  organisationId: string;
  identityId: string;
  purpose: string;
  authorization: ExecutionAuthorization;
  reservation: ExecutionReservation;
  outcomeRecorder: ExecutionOutcomeRecorder;
};
type Db = { query<T extends Record<string, unknown>>(sql: string, params: readonly unknown[]): Promise<T[]> };
type Store = { transaction<T>(work: (db: Db) => Promise<T>): Promise<T> };

export class SpaceTimeOperation {
  private readonly coordinator: ExecutionCoordinator;
  private readonly db: Store;
  private readonly context: SpaceTimeExecutionContext;

  constructor(db: Store, context: SpaceTimeExecutionContext) {
    this.db = db;
    this.context = context;
    this.coordinator = new ExecutionCoordinator(
      context.authorization, context.reservation,
      operation => this.handle(operation), context.outcomeRecorder,
    );
  }

  async execute(request: SpaceTimeRepresentationRequest): Promise<OperationEnvelope> {
    const requestId = randomUUID();
    const operationId = randomUUID();
    const representation = { ...request, id: requestId };
    validateSpatialRepresentation(representation);
    const operation: OperationEnvelope = {
      operationId, idempotencyKey: operationId, action: 'space_time.spatial_representation_create',
      resourceId: representation.resourceId, organisationId: this.context.organisationId,
      identityId: this.context.identityId, purpose: this.context.purpose, state: 'created',
      createdAt: new Date().toISOString(), attemptCount: 0, payloadRef: requestId,
    };

    if (!await this.context.authorization.authorize(operation)) throw new Error('space_time_unauthorized');

    await this.persist(operation, representation, requestId);
    const result = await this.coordinator.execute(operation);
    if (!result.executed) throw new Error('space_time_not_executed:' + result.decision);
    return operation;
  }

  private async persist(
    operation: OperationEnvelope, representation: SpaceTimeRepresentationRequest, requestId: string,
  ): Promise<void> {
    await this.db.transaction(async db => {
      await db.query(
        'insert into core.space_time_representation_requests(id,organisation_id,identity_id,resource_id,representation_type,geom,precision_level,coordinate_confidence,source_evidence_id) values ($1,$2,$3,$4,$5,$6::geometry,$7,$8,$9)',
        [
          requestId, this.context.organisationId, this.context.identityId, representation.resourceId,
          representation.representationType, representation.geom ?? null, representation.precisionLevel,
          representation.coordinateConfidence ?? null, representation.sourceEvidenceId ?? null,
        ],
      );
      await db.query(
        'insert into operations.operations(id,organisation_id,identity_id,idempotency_key,action,resource_id,purpose,expires_at,payload_ref) values ($1,$2,$3,$4,$5,$6,$7,clock_timestamp()+interval \'1 hour\',$8)',
        [
          operation.operationId, this.context.organisationId, this.context.identityId,
          operation.idempotencyKey, operation.action, operation.resourceId, this.context.purpose, requestId,
        ],
      );
      await db.query('select operations.transition($1,\'created\',\'authorized\')', [operation.operationId]);
      await db.query('select operations.transition($1,\'authorized\',\'queued\')', [operation.operationId]);
    });
  }

  private async handle(operation: OperationEnvelope) {
    const rows = await this.db.transaction(db => db.query(
      'select representation_id, decision from core_private.consume_space_time_representation_request($1::uuid)',
      [operation.payloadRef],
    ));
    const result = rows[0];
    if (!result || result.decision !== 'created') {
      return { outcome: 'rejected' as const, errorCode: String(result?.decision ?? 'request_missing') };
    }
    return { outcome: 'acknowledged' as const, resultRef: String(result.representation_id) };
  }
}
