import { canTransition, isTerminal, transition } from "../../packages/contracts/src/operation-state";

const assert = (condition: boolean, message: string) => {
  if (!condition) throw new Error(message);
};

assert(canTransition("created", "authorized"), "created must authorize");
assert(canTransition("authorized", "queued"), "authorized must queue");
assert(canTransition("queued", "in_flight"), "queued must execute");
assert(canTransition("in_flight", "retry_wait"), "execution must retry");
assert(canTransition("in_flight", "conflict"), "execution must surface conflict");
assert(!canTransition("completed", "queued"), "completed must remain terminal");
assert(!canTransition("expired", "queued"), "expired must never resurrect");
assert(isTerminal("completed"), "completed is terminal");
assert(isTerminal("expired"), "expired is terminal");

const event = transition("op-1", "created", "authorized", "2026-09-18T00:00:00Z");
assert(event.operationId === "op-1", "transition preserves operation identity");

let rejected = false;
try {
  transition("op-1", "created", "completed", "2026-09-18T00:00:00Z");
} catch {
  rejected = true;
}
assert(rejected, "invalid transition must fail closed");
