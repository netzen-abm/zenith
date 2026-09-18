import {
  classifyFailure,
  idempotencyScope,
  nextRetry,
} from "../../packages/contracts/src/operation-policy";

const policy = {
  maxAttempts: 3,
  retryBaseMs: 1000,
  retryMaxMs: 5000,
  requireLease: true,
  reauthorizeOnExecution: true,
};

const assert = (value: boolean, message: string) => {
  if (!value) throw new Error(message);
};

assert(classifyFailure("timeout") === "retryable", "timeout must retry");
assert(classifyFailure("permission_denied") === "non_retryable", "authorization failure must not retry");
assert(classifyFailure("conflict") === "conflict", "conflict must be explicit");

const now = new Date("2026-09-18T00:00:00Z");
const retry = nextRetry(policy, 1, "timeout", now);
assert(retry.retry === true, "retryable failure should schedule retry");
assert(retry.nextAttemptAt === "2026-09-18T00:00:01.000Z", "retry delay must be deterministic");

const expired = nextRetry(
  policy,
  1,
  "timeout",
  now,
  new Date("2026-09-18T00:00:00.500Z"),
);
assert(expired.retry === false && expired.reason === "expired", "retry cannot cross expiry");

const exhausted = nextRetry(policy, 3, "timeout", now);
assert(exhausted.retry === false && exhausted.reason === "attempt_limit", "attempt limit must stop retry");

assert(
  idempotencyScope("org-1", "request-7") === "org-1:request-7",
  "idempotency scope must include organisation",
);
assert(
  idempotencyScope(undefined, "request-7") === "global:request-7",
  "global scope must be explicit",
);
