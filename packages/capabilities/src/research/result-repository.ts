import type { OperationEnvelope } from '../../contracts/src/operation.ts';
import type { ResearchProvider, ResearchQuery, ResearchResult } from '../research-intelligence.ts';

export type StoredResearchResult = {
  resultSetId: string;
  resultHash: string;
  result: ResearchResult;
};

/** Domain persistence boundary for immutable provider-result snapshots, separate from query admission. */
export interface ResearchResultStore {
  save(operation: OperationEnvelope, query: ResearchQuery, provider: Pick<ResearchProvider, 'providerId' | 'adapterVersion'>, result: ResearchResult): Promise<StoredResearchResult>;
  findForOperation(operation: OperationEnvelope, query: ResearchQuery, providerId: string): Promise<StoredResearchResult | undefined>;
  get(resultSetId: string, organisationId: string, identityId: string): Promise<StoredResearchResult | undefined>;
}
