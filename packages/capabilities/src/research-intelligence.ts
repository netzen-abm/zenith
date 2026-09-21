export type ResearchQuery = {
  queryId: string;
  researchQuestionId?: string;
  intent: string;
  text: string;
  concepts?: readonly string[];
  filters?: Readonly<Record<string, unknown>>;
  sort?: readonly string[];
  pageSize: number;
  cursor?: string;
  requestedFields?: readonly string[];
  openAccessRequired?: boolean;
  requesterIdentityId: string;
  organisationId: string;
  purpose: string;
};

export type ResearchProvider = {
  providerId: string;
  adapterVersion: string;
  search(query: ResearchQuery): Promise<ResearchResult>;
};

export type ResearchWork = {
  canonicalWorkId?: string;
  title: string;
  workType?: string;
  publicationDate?: string;
  identifiers: readonly string[];
  sourceProvenance: string;
  rightsMetadata?: Readonly<Record<string, unknown>>;
};

export type ResearchResult = {
  queryId: string;
  providerId: string;
  providerQueryReference: string;
  retrievedAt: string;
  results: readonly ResearchWork[];
  nextCursor?: string;
  partial: boolean;
  warnings: readonly string[];
};

export function validateResearchQuery(query: ResearchQuery): void {
  if (!query.queryId || !query.requesterIdentityId || !query.organisationId) {
    throw new Error('research_query_context_required');
  }
  if (!query.text.trim() || !query.intent.trim()) {
    throw new Error('research_query_content_required');
  }
  if (!Number.isInteger(query.pageSize) || query.pageSize < 1 || query.pageSize > 100) {
    throw new Error('research_query_page_size_invalid');
  }
}
