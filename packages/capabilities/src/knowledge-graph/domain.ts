export type KnowledgeGraphEpistemicStatus =
  | 'observed' | 'documented' | 'derived' | 'interpreted'
  | 'hypothesized' | 'traditional_oral' | 'contested_disputed' | 'unknown';

export type KnowledgeGraphAssertionType =
  | 'support' | 'contradict' | 'qualify' | 'derive' | 'contextualize';

export type KnowledgeGraphRelationship = {
  id: string;
  organisationId: string;
  subjectResourceId: string;
  predicate: string;
  objectResourceId: string;
  assertedByIdentityId?: string;
  evidenceId?: string;
  epistemicStatus: KnowledgeGraphEpistemicStatus;
  confidence?: number;
  validFrom?: string;
  validTo?: string;
  assertion?: Readonly<Record<string, unknown>>;
};

export type KnowledgeGraphAssertion = {
  id: string;
  relationshipId: string;
  assertionType: KnowledgeGraphAssertionType;
  evidenceId?: string;
  sourceId?: string;
  note?: string;
};