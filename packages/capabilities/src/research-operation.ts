import { randomUUID } from 'node:crypto';
import type { OperationEnvelope } from '../../contracts/src/operation.ts';
import { ExecutionCoordinator, type ExecutionAuthorization, type ExecutionOutcomeRecorder, type ExecutionReservation } from '../../operation-queue/src/execution-coordinator.ts';
import { validateResearchQuery, type ResearchQuery, type ResearchProvider } from './research-intelligence.ts';

export type ResearchExecutionContext = { authorization: ExecutionAuthorization; reservation: ExecutionReservation; outcomeRecorder: ExecutionOutcomeRecorder };

export class ResearchOperation {
  private readonly coordinator: ExecutionCoordinator;
  constructor(private readonly provider: ResearchProvider, private readonly context: ResearchExecutionContext) {
    this.coordinator = new ExecutionCoordinator(context.authorization, context.reservation, operation => this.handle(operation), context.outcomeRecorder);
  }

  async execute(query: ResearchQuery): Promise<OperationEnvelope> {
    validateResearchQuery(query);
    const operation = this.createOperation(query);
    const result = await this.coordinator.execute(operation);
    if (!result.executed) throw new Error('research_not_executed:' + result.decision);
    return operation;
  }

  private createOperation(query: ResearchQuery): OperationEnvelope {
    const id = randomUUID();
    return { operationId: id, idempotencyKey: query.queryId, action: 'research.query', organisationId: query.organisationId, identityId: query.requesterIdentityId, purpose: query.purpose, state: 'created', createdAt: new Date().toISOString(), attemptCount: 0, payloadRef: query.queryId };
  }

  private async handle(operation: OperationEnvelope) {
    if (!operation.payloadRef) return { outcome: 'rejected' as const, errorCode: 'research_query_reference_missing' };
    return { outcome: 'acknowledged' as const, resultRef: operation.payloadRef };
  }
}
