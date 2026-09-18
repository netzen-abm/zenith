import {
  reconcile,
  validateLease,
} from "../../packages/contracts/src/execution";

const lease = {
  leaseId: "lease-1",
  operationId: "op-1",
  capability: "field.capture",
  purpose: "document archaeological context",
  issuedAt: "2026-09-18T00:00:00Z",
  expiresAt: "2026-09-18T00:10:00Z",
};

const assert = (value: boolean, message: string) => {
  if (!value) throw new Error(message);
};

const base = {
  operationId: "op-1",
  capability: "field.capture",
  purpose: "document archaeological context",
  leaseId: "lease-1",
  at: "2026-09-18T00:05:00Z",
};

assert(validateLease(base, lease).allowed, "valid lease must allow execution");
assert(
  validateLease({ ...base, at: "2026-09-18T00:10:00Z" }, lease).decision === "deny_expired",
  "expired lease must deny",
);
assert(
  validateLease({ ...base, leaseId: "other" }, lease).decision === "deny_mismatch",
  "wrong lease must deny",
);
assert(
  validateLease({ ...base, purpose: "different purpose" }, lease).decision === "deny_mismatch",
  "purpose mismatch must deny",
);
assert(
  validateLease({ ...base, leaseId: undefined }, undefined).decision === "deny_missing",
  "missing lease must deny",
);

const revoked = {
  ...lease,
  revokedAt: "2026-09-18T00:04:00Z",
};
assert(
  validateLease(base, revoked).decision === "deny_revoked",
  "revoked lease must deny",
);

assert(
  reconcile("op-1", "hash-a", "hash-a").decision === "accept",
  "matching payloads must reconcile",
);
assert(
  reconcile("op-1", "hash-a", "hash-b").decision === "conflict",
  "mismatched payloads must surface conflict",
);
