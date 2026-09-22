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
import type { KnowledgeGraphRequestRepository } from './knowledge-graph/repository.ts';

export type KnowledgeGraphRelationshipRequest = Omit<KnowledgeGraphRelationship, 'id'>;
export type KnowledgeGraphExecutionContext = {
  organisationId: string;
  identityId: string;
  purpose: string;
};

export class KnowledgeGraphCapability {
  private readonly coordinator: ExecutionCoordinator;

  constructor(
    private readonly repository: KnowledgeGraphRequestRepository,
    private readonly authorization: ExecutionAuthorization,
    reservation: ExecutionReservation,
    outcomeRecorder: ExecutionOutcomeRecorder,
  ) {
    this.coordinator = new ExecutionCoordinator(
      authorization,
      reservation,
      operation => this.handle(operation),
      outcomeRecorder,
    );
  }

  async execute(
    request: KnowledgeGraphRelationshipRequest,
    context: KnowledgeGraphExecutionContext,
  ): Promise<OperationEnvelope> {
    const requestId = randomUUID();
    const operationId = randomUUID();
    const relationship = { ...request, id: requestId };
    validateKnowledgeGraphRelationship(relationship);

    const operation: OperationEnvelope = {
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

    if (!await this.authorization.authorize(operation)) {
      throw new Error('knowledge_graph_unauthorized');
    }

    await this.repository.saveRequest(relationship, context);

    const result = await this.coordinator.execute(operation);
    if (!result.executed) {
      throw new Error(`knowledge_graph_not_executed:${result.decision}`);
    }
    return operation;
  }

  private async handle(operation: OperationEnvelope) {
    const result = await this.repository.consumeRequest(operation.payloadRef);
    if (!result || result.decision !== 'created') {
      return {
        outcome: 'rejected' as const,
        errorCode: result?.decision ?? 'request_missing',
      };
    }
    return {
      outcome: 'acknowledged' as const,
      resultRef: result.relationshipId,
    };
  }
}
