import { executeOperation } from "../../packages/contracts/src/execution-coordinator";

const assert = (v: boolean, m: string) => { if (!v) throw new Error(m); };
const events: string[] = [];
let handled = 0;
let released = 0;

const deps = {
  authorize: () => ({ allowed: true, decision: "allow" }),
  reserveExecution: () => ({ allowed: true, decision: "allow" }),
  handle: async () => { handled += 1; },
  audit: async (e: { outcome: string }) => { events.push(e.outcome); },
  release: async () => { released += 1; },
};

const operation = {
  operationId: "op-1",
  idempotencyKey: "key-1",
  action: "field.capture",
  organisationId: "org-1",
  purpose: "document context",
  state: "queued" as const,
  createdAt: "2026-09-18T00:00:00Z",
  attemptCount: 0,
};

const lease = {
  leaseId: "lease-1",
  operationId: "op-1",
  capability: "field.capture",
  purpose: "document context",
  issuedAt: "2026-09-18T00:00:00Z",
  expiresAt: "2026-09-18T00:10:00Z",
};

assert(
  await executeOperation(operation, { ...lease }, deps, "2026-09-18T00:05:00Z") === "completed",
  "valid execution must complete",
);
assert(handled === 1 && released === 1, "handler and release must execute once");
assert(events.includes("completed"), "completion must be audited");

const denied = {
  ...deps,
  authorize: () => ({ allowed: false, decision: "deny_policy" }),
};
assert(
  await executeOperation(operation, lease, denied, "2026-09-18T00:05:00Z") === "denied",
  "current policy denial must stop execution",
);
assert(handled === 1, "denial must happen before handler");

const expired = { ...lease, expiresAt: "2026-09-18T00:04:00Z" };
assert(
  await executeOperation(operation, expired, deps, "2026-09-18T00:05:00Z") === "expired",
  "expired lease must stop execution",
);
assert(handled === 1, "expired lease must not reach handler");

const duplicate = {
  ...deps,
  isDuplicate: () => true,
};
assert(
  await executeOperation(operation, lease, duplicate, "2026-09-18T00:05:00Z") === "duplicate",
  "duplicate must stop execution",
);
assert(handled === 1, "duplicate must not reach handler");

// TOCTOU regression: preflight authorization may pass, but the atomic reservation
// must be able to deny before the handler is invoked.
let authChecks = 0;
let raceHandled = 0;
const revokedBeforeReservation = {
  ...deps,
  authorize: () => ({ allowed: ++authChecks === 1, decision: authChecks === 1 ? "allow" : "deny_policy" }),
  reserveExecution: () => ({ allowed: false, decision: "deny_policy" }),
  handle: async () => { raceHandled += 1; },
};
assert(
  await executeOperation(operation, lease, revokedBeforeReservation, "2026-09-18T00:05:00Z") === "denied",
  "execution reservation must fail closed when authorization changes before reservation",
);
assert(raceHandled === 0, "reservation denial must prevent side effects");
