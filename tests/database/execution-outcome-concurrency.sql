-- Concurrent durable-outcome CAS gate: two writers for one attempt must yield one recorded outcome.
-- Executed by the CI fresh-DB reconciliation job.
DO $$
DECLARE
  r record;
BEGIN
  SELECT * INTO r FROM operations.record_execution_outcome(
    '00000000-0000-0000-0000-0000000000f1', 1, 'acknowledged', NULL,
    'result://concurrency-a', 'hash-concurrency-a'
  );
  IF NOT r.recorded OR r.decision <> 'recorded' THEN
    RAISE EXCEPTION 'first outcome writer did not record';
  END IF;
END $$;

DO $$
DECLARE
  r record;
BEGIN
  SELECT * INTO r FROM operations.record_execution_outcome(
    '00000000-0000-0000-0000-0000000000f1', 1, 'acknowledged', NULL,
    'result://concurrency-b', 'hash-concurrency-b'
  );
  IF r.recorded OR r.decision <> 'attempt_already_recorded' THEN
    RAISE EXCEPTION 'duplicate outcome writer was not rejected';
  END IF;
END $$;
