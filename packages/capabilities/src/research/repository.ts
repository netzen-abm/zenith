import type { ResearchQuery } from '../research-intelligence.ts';

export type ResearchQueryStore = {
  get(id: string): Promise<ResearchQuery | undefined>;
  save(query: ResearchQuery): Promise<string>;
};
