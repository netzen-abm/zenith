import { OperationPolicy } from "./operation";

export type RetryClass = "retryable" | "non_retryable" | "conflict";

export interface RetryDecision {
  retry: boolean;
  nextAttemptAt?: string;
  reason: RetryClass | "expired" | "attempt_limit";
}

export function classifyFailure(code: string): RetryClass {
  if (["timeout", "unavailable", "rate_limited", "transport_error"].includes(code)) return "retryable";
  if (code === "conflict") return "conflict";
  return "non_retryable";
}

export function nextRetry(
  policy: OperationPolicy,
  attemptCount: number,
  failureCode: string,
  now: Date,
  expiresAt?: Date,
): RetryDecision {
  const kind = classifyFailure(failureCode);
  if (kind !== "retryable") return { retry: false, reason: kind };
  if (attemptCount >= policy.maxAttempts) return { retry: false, reason: "attempt_limit" };

  const delay = Math.min(
    policy.retryMaxMs,
    policy.retryBaseMs * 2 ** Math.max(0, attemptCount - 1),
  );
  const next = new Date(now.getTime() + delay);
  if (expiresAt && next.getTime() >= expiresAt.getTime()) {
    return { retry: false, reason: "expired" };
  }
  return { retry: true, nextAttemptAt: next.toISOString(), reason: "retryable" };
}

export function idempotencyScope(
  organisationId: string | undefined,
  idempotencyKey: string,
): string {
  return `${organisationId ?? "global"}:${idempotencyKey}`;
}
