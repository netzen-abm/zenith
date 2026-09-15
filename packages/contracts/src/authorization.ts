export type CapabilityAction =
  | "read"
  | "discover"
  | "search"
  | "explore"
  | "write"
  | "create"
  | "update"
  | "annotate"
  | "research_write";

export type AuthorizationDecision =
  | "allow"
  | "deny"
  | "deny_unauthenticated"
  | "deny_policy"
  | "invalid_action";

export interface AuthorizationRequest {
  action: CapabilityAction | string;
  resourceId?: string;
  purpose: string;
  actorId?: string;
  organisationId?: string;
  requestedAt: string;
}

export interface AuthorizationDecisionResult {
  allowed: boolean;
  decision: AuthorizationDecision;
  identityId?: string;
  organisationId?: string;
  resourceId?: string;
  action: string;
  purpose?: string;
}
