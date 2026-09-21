import { randomUUID } from 'node:crypto';
import type { OperationEnvelope } from '../../contracts/src/operation.ts';
import {
  ExecutionCoordinator,
  type ExecutionAuthorization,
  type ExecutionOutcomeRecorder,
  type ExecutionReservation,
} from '../../operation-queue/src/execution-coordinator.ts';
import {
  validateKnowledgeGraphRelationship,
  type KnowledgeGraphRelationship,
} from './knowledge-graph.ts';

export type KnowledgeGraphRelationshipRequest = Omit<KnowledgeGraphRelationship, 'id'>;
type Context = { organisationId: string; identityId: string; purpose: string };
type QueryExecutor = {
  query<T extends Record<string, unknown>>(sql: string, params: readonly unknown[]): Promise<T[]>;
};
type TransactionExecutor = {
  transaction<T>(work: (db: QueryExecutor) => Promise<T>): Promise<T>;
};

export class KnowledgeGraphCapability {
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

  async execute(
    request: KnowledgeGraphRelationshipRequest,
    context: Context,
  ): Promise<OperationEnvelope> {
    const requestId = randomUUID();
    const operationId = randomUUID();
    const relationship = { ...request, id: requestId };
    validateKnowledgeGraphRelationship(relationship);
    const operation = this.operation(operationId, requestId, relationship, context);

    if (!await this.authorization.authorize(operation)) {
      throw new Error('knowledge_graph_unauthorized');
    }

    await this.persist(operation, requestId, relationship, context);
    operation.state = 'queued';
    const result = await this.coordinator.execute(operation);
    if (!result.executed) {
      throw new Error(`knowledge_graph_not_executed:${result.decision}`);
    }
    return operation;
  }

  private operation(
    operationId: string,
    requestId: string,
    relationship: KnowledgeGraphRelationship,
    context: Context,
  ): OperationEnvelope {
    return {
      operationId,
      idempotencyKey: operationId,
      action: 'knowledge_graph_relationship_create',
      resourceId: relationship.subjectResourceId,
      organisationId: context.organisationId,
      identityId: context.identityId,
      purpose: context.purpose,
      state: 'created',
      createdAt: new Date().toISOString(),
      attemptCount: 0,
      payloadRef: requestId,
    };
  }

  private async persist(
    operation: OperationEnvelope,
    requestId: string,
    relationship: KnowledgeGraphRelationship,
    context: Context,
  ): Promise<void> {
    await this.db.transaction(async db => {
      await db.query(
        'insert into core.knowledge_graph_relationship_requests(id,organisation_id,identity_id,subject_resource_id,predicate,object_resource_id,asserted_by_identity_id,evidence_id,epistemic_status,confidence,valid_from,valid_to,assertion) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb)',
        [
          requestId, context.organisationId, context.identityId,
          relationship.subjectResourceId, relationship.predicate, relationship.objectResourceId,
          relationship.assertedByIdentityId ?? context.identityId, relationship.evidenceId ?? null,
          relationship.epistemicStatus, relationship.confidence ?? null,
          relationship.validFrom ?? null, relationship.validTo ?? null,
          JSON.stringify(relationship.assertion ?? {}),
        ],
      );
      await db.query(
        'insert into operations.operations(id,organisation_id,identity_id,idempotency_key,action,resource_id,purpose,expires_at,payload_ref) values ($1,$2,$3,$4,$5,$6,$7,clock_timestamp()+interval \'1 hour\',$8)',
        [
          operation.operationId, context.organisationId, context.identityId,
          operation.idempotencyKey, operation.action, relationship.subjectResourceId,
          context.purpose, requestId,
        ],
      );
      await db.query('select operations.transition($1,\'created\',\'authorized\')', [operation.operationId]);
      await db.query('select operations.transition($1,\'authorized\',\'queued\')', [operation.operationId]);
    });
  }

  private async handle(operation: OperationEnvelope) {
    const rows = await this.db.transaction(db => db.query(
      'select relationship_id, decision from core_private.consume_knowledge_graph_relationship_request($1::uuid)',
      [operation.payloadRef],
    ));
    const result = rows[0];
    if (!result || result.decision !== 'created') {
      return { outcome: 'rejected' as const, errorCode: String(result?.decision ?? 'request_missing') };
    }
    return { outcome: 'acknowledged' as const, resultRef: String(result.relationship_id) };
  }
}
