export interface CapabilityContext {
  actorId: string;
  organisationId?: string;
  purpose: string;
  requestedAt: string;
}

export interface CapabilityResult<T> {
  data: T;
  provenance?: string[];
  auditEventId: string;
}
