import type {
  ResearchProvider,
  ResearchQuery,
  ResearchResult,
  ResearchWork,
} from './research-intelligence.ts';

export type FixtureWork = ResearchWork & { providerId: string };

export class DeterministicResearchProvider implements ResearchProvider {
  readonly providerId = 'fixture';
  readonly adapterVersion = '1.0.0';
  private readonly works: readonly FixtureWork[];

  constructor(works: readonly FixtureWork[]) {
    this.works = works;
  }

  async search(query: ResearchQuery): Promise<ResearchResult> {
    const matches = this.works.filter(work =>
      work.title.toLowerCase().includes(query.text.trim().toLowerCase()),
    );
    return {
      queryId: query.queryId,
      providerId: this.providerId,
      providerQueryReference: `fixture:${query.queryId}`,
      retrievedAt: '1970-01-01T00:00:00.000Z',
      results: matches.slice(0, query.pageSize),
      nextCursor: matches.length > query.pageSize ? 'next' : undefined,
      partial: matches.length > query.pageSize,
      warnings: [],
    };
  }
}
