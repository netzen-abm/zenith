export type EpistemicStatus =
  | "observed"
  | "documented"
  | "derived"
  | "interpreted"
  | "hypothesized"
  | "traditional_oral"
  | "contested_disputed"
  | "unknown";

export interface ProvenanceRef {
  sourceId: string;
  evidenceId?: string;
  recordedAt?: string;
}

export interface ClaimContract {
  id: string;
  statement: string;
  status: EpistemicStatus;
  provenance: ProvenanceRef[];
}
