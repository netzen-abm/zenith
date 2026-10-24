import { createHash } from 'node:crypto';
import type { OperationEnvelope } from '../../contracts/src/operation.ts';
import type { ResearchProvider, ResearchQuery, ResearchResult } from './research-intelligence.ts';
import type { ResearchResultStore, StoredResearchResult } from './research/result-repository.ts';

type Entry = { queryId: string; organisationId: string; identityId: string; providerId: string; saved: StoredResearchResult };
export class MemoryResearchResultStore implements ResearchResultStore {
  private readonly byOperation = new Map<string, Entry>();
  private readonly byId = new Map<string, Entry>();
  private sequence = 0;

  async save(operation: OperationEnvelope, query: ResearchQuery, provider: Pick<ResearchProvider,'providerId'|'adapterVersion'>, result: ResearchResult): Promise<StoredResearchResult> {
    if (result.queryId !== query.queryId || result.providerId !== provider.providerId) throw new Error('research_result_identity_mismatch');
    const resultHash = createHash('sha256').update(JSON.stringify(result)).digest('hex');
    const old = this.byOperation.get(operation.operationId);
    if (old && old.providerId === provider.providerId && old.saved.resultHash === resultHash) return old.saved;
    const saved = { resultSetId: 'memory-result-' + (++this.sequence), resultHash, result };
    const entry = { queryId: query.queryId, organisationId: query.organisationId, identityId: query.requesterIdentityId, providerId: provider.providerId, saved };
    this.byOperation.set(operation.operationId, entry);
    this.byId.set(saved.resultSetId, entry);
    return saved;
  }

  async findForOperation(operation: OperationEnvelope, query: ResearchQuery, providerId: string): Promise<StoredResearchResult | undefined> {
    const entry = this.byOperation.get(operation.operationId);
    return entry && entry.queryId === query.queryId && entry.organisationId === query.organisationId &&
      entry.identityId === query.requesterIdentityId && entry.providerId === providerId ? entry.saved : undefined;
  }

  async get(resultSetId: string, organisationId: string, identityId: string): Promise<StoredResearchResult | undefined> {
    const entry = this.byId.get(resultSetId);
    return entry && entry.organisationId === organisationId && entry.identityId === identityId ? entry.saved : undefined;
  }
}
