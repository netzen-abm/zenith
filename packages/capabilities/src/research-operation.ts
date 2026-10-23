import { randomUUID } from 'node:crypto';
import type { OperationEnvelope } from '../../contracts/src/operation.ts';
import type { OperationStore } from '../../contracts/src/operation-store.ts';
import { ExecutionCoordinator, type ExecutionAuthorization, type ExecutionOutcomeRecorder, type ExecutionReservation } from '../../operation-queue/src/execution-coordinator.ts';
import { validateResearchQuery, type ResearchQuery, type ResearchProvider } from './research-intelligence.ts';
import type { ResearchQueryStore } from './research/repository.ts';

export type ResearchExecutionContext = { authorization: ExecutionAuthorization; reservation: ExecutionReservation; outcomeRecorder: ExecutionOutcomeRecorder; operationStore: OperationStore };

function canonicalizePayload(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalizePayload);
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return Object.fromEntries(
      Object.keys(record).sort().map(key => [key, canonicalizePayload(record[key])]),
    );
  }
  return value;
}

function normalizeResearchQuery(query: ResearchQuery): Record<string, unknown> {
  return {
    queryId: query.queryId.trim().toLowerCase(),
    researchQuestionId: query.researchQuestionId?.trim().toLowerCase() ?? null,
    intent: query.intent,
    text: query.text,
    concepts: query.concepts ?? [],
    filters: query.filters ?? {},
    sort: query.sort ?? [],
    pageSize: query.pageSize,
    cursor: query.cursor ?? null,
    requestedFields: query.requestedFields ?? [],
    openAccessRequired: query.openAccessRequired ?? false,
    requesterIdentityId: query.requesterIdentityId.trim().toLowerCase(),
    organisationId: query.organisationId.trim().toLowerCase(),
    purpose: query.purpose,
  };
}

/** Immutable canonical identity persisted with the operation before handler admission. */
function researchPayloadIdentity(query: ResearchQuery): Record<string, unknown> {
  const normalized = normalizeResearchQuery(query);
  return {
    action: 'research.query',
    organisationId: query.organisationId.trim().toLowerCase(),
    identityId: query.requesterIdentityId.trim().toLowerCase(),
    purpose: query.purpose,
    resourceId: null,
    ...normalized,
  };
}

function sameResearchQuery(a: ResearchQuery, b: ResearchQuery): boolean {
  return JSON.stringify(canonicalizePayload(normalizeResearchQuery(a))) ===
    JSON.stringify(canonicalizePayload(normalizeResearchQuery(b)));
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
        payloadRef: query.queryId.trim().toLowerCase(),
        payloadIdentity: researchPayloadIdentity(query),
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
    const outcomeState = result.outcome?.outcome === 'acknowledged' ? 'acknowledged'
      : result.outcome?.outcome === 'retry_wait' ? 'retry_wait'
      : result.outcome?.outcome === 'conflict' ? 'conflict'
      : result.outcome?.outcome === 'rejected' ? 'rejected'
      : canonicalOperation.state;
    return {
      ...canonicalOperation,
      state: outcomeState,
      ...(result.outcome?.resultRef ? { resultRef: result.outcome.resultRef } : {}),
    };
  }

  private createOperation(query: ResearchQuery): OperationEnvelope {
    const id = randomUUID();
    const canonicalQueryId = query.queryId.trim().toLowerCase();
    return { operationId: id, idempotencyKey: canonicalQueryId, action: 'research.query', organisationId: query.organisationId, identityId: query.requesterIdentityId, purpose: query.purpose, state: 'created', createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), attemptCount: 0, payloadRef: canonicalQueryId };
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
