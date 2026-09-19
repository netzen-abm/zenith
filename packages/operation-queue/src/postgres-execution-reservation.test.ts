import { strict as assert } from 'node:assert';
import { PostgresExecutionReservation, type SqlExecutor } from './postgres-execution-reservation.ts';

const calls: { sql: string; params: readonly unknown[] }[] = [];
const db: SqlExecutor = {
  async query(sql, params) {
    calls.push({ sql, params });
    return [{ allowed: true, decision: 'allow' }];
  },
};

const reservation = new PostgresExecutionReservation(db);
const operationId = '00000000-0000-0000-0000-0000000000e1';
assert.deepEqual(await reservation.reserve(operationId), {
  allowed: true,
  decision: 'allow',
});
assert.equal(calls.length, 1);
assert.match(calls[0].sql, /operations\.reserve_execution\(\$1::uuid\)/);
assert.deepEqual(calls[0].params, [operationId]);

const denied = new PostgresExecutionReservation({
  async query() {
    return [{ allowed: false, decision: 'deny_policy' }];
  },
});
assert.deepEqual(
  await denied.reserve('00000000-0000-0000-0000-0000000000e2'),
  { allowed: false, decision: 'deny_policy' },
);

await assert.rejects(
  new PostgresExecutionReservation({ async query() { return []; } })
    .reserve('00000000-0000-0000-0000-0000000000e3'),
  /execution_reservation_no_result/,
);
