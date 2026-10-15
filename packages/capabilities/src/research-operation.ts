import { randomUUID } from 'node:crypto';
import type { OperationEnvelope } from '../../contracts/src/operation.ts';
import type { OperationStore } from '../../contracts/src/operation-store.ts';
import { ExecutionCoordinator, type ExecutionAuthorization, type ExecutionOutcomeRecorder, type ExecutionReservation } from '../../operation-queue/src/execution-coordinator.ts';
import { validateResearchQuery, type ResearchQuery, type ResearchProvider } from './research-intelligence.ts';
import type { ResearchQueryStore } from './research/repository.ts';

export type ResearchExecutionContext = { authorization: ExecutionAuthorization; reservation: ExecutionReservation; outcomeRecorder: ExecutionOutcomeRecorder; operationStore: OperationStore };

function sameResearchQuery(a: ResearchQuery, b: ResearchQuery): boolean {
  const normalize = (q: ResearchQuery) => ({
    queryId: q.queryId, researchQuestionId: q.researchQuestionId ?? null,
    intent: q.intent, text: q.text, concepts: q.concepts ?? [], filters: q.filters ?? {},
    sort: q.sort ?? [], pageSize: q.pageSize, cursor: q.cursor ?? null,
    requestedFields: q.requestedFields ?? [], openAccessRequired: q.openAccessRequired ?? false,
    requesterIdentityId: q.requesterIdentityId, organisationId: q.organisationId, purpose: q.purpose,
  });
  return JSON.stringify(normalize(a)) === JSON.stringify(normalize(b));
}

export class ResearchOperation {
  private readonly coordinator: ExecutionCoordinator;
  private readonly store: ResearchQueryStore;
  private readonly provider: ResearchProvider;
  private readonly context: ResearchExecutionContext;
  constructor(store: ResearchQueryStore, provider: ResearchProvider, context: ResearchExecutionContext) {
    this.store = store;
    this.provider = provider;
    this.context = context;
    this.coordinator = new ExecutionCoordinator(context.authorization, context.reservation, operation => this.handle(operation), context.outcomeRecorder, context.operationStore);
  }

  async execute(query: ResearchQuery): Promise<OperationEnvelope> {
    validateResearchQuery(query);
    const operation = this.createOperation(query);
    let canonicalOperation = operation;
    const result = await this.coordinator.execute(operation, async () => {
      const resolved = await this.context.operationStore.createOrGet({
        operationId: operation.operationId,
        idempotencyKey: operation.idempotencyKey,
        action: operation.action,
        organisationId: query.organisationId,
        identityId: query.requesterIdentityId,
        purpose: query.purpose,
        expiresAt: operation.expiresAt!,
        payloadRef: query.queryId,
      });
      canonicalOperation = resolved.operation;
      const existingQuery = await this.store.get(query.queryId, query.organisationId);
      if (existingQuery) {
        if (!sameResearchQuery(existingQuery, query)) throw new Error('research_query_id_conflict');
      } else {
        await this.store.save(query);
      }
      return resolved.operation;
    });
    if (!result.executed) throw new Error('research_not_executed:' + result.decision);
    return result.outcome?.resultRef
      ? { ...canonicalOperation, resultRef: result.outcome.resultRef }
      : canonicalOperation;
  }

  private createOperation(query: ResearchQuery): OperationEnvelope {
    const id = randomUUID();
    return { operationId: id, idempotencyKey: query.queryId, action: 'research.query', organisationId: query.organisationId, identityId: query.requesterIdentityId, purpose: query.purpose, state: 'created', createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), attemptCount: 0, payloadRef: query.queryId };
  }

  private async handle(operation: OperationEnvelope) {
    const query = operation.payloadRef ? await this.store.get(operation.payloadRef, operation.organisationId ?? '') : undefined;
    if (!query) return { outcome: 'rejected' as const, errorCode: 'research_query_not_found' };
    try {
      const result = await this.provider.search(query);
      return { outcome: 'acknowledged' as const, resultRef: result.providerQueryReference };
    } catch {
      return { outcome: 'retry_wait' as const, errorCode: 'research_provider_failure' };
    }
  }
}
