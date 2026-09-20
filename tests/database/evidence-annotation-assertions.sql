DO $$
DECLARE v_count integer;
BEGIN
  SELECT count(*) INTO v_count FROM information_schema.tables
  WHERE table_schema='core' AND table_name='evidence_annotation_requests';
  IF v_count <> 1 THEN RAISE EXCEPTION 'evidence annotation request table missing'; END IF;

  SELECT count(*) INTO v_count FROM pg_class c
  JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='core' AND c.relname='evidence_annotation_requests' AND c.relrowsecurity;
  IF v_count <> 1 THEN RAISE EXCEPTION 'evidence annotation request RLS missing'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='core' AND tablename='evidence_annotation_requests'
      AND policyname='evidence_annotation_requests_select'
  ) THEN RAISE EXCEPTION 'annotation request select policy missing'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='core' AND tablename='evidence_annotation_requests'
      AND policyname='evidence_annotation_requests_insert'
  ) THEN RAISE EXCEPTION 'annotation request insert policy missing'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='core_private' AND p.proname='consume_evidence_annotation_request'
      AND p.prosecdef AND p.proconfig @> ARRAY['search_path=""']
  ) THEN RAISE EXCEPTION 'annotation mutation function security boundary missing'; END IF;

  IF has_function_privilege('authenticated', 'core_private.consume_evidence_annotation_request(uuid)', 'EXECUTE') IS NOT TRUE
     OR has_function_privilege('anon', 'core_private.consume_evidence_annotation_request(uuid)', 'EXECUTE') IS TRUE
  THEN RAISE EXCEPTION 'annotation mutation function grants are unsafe'; END IF;
END $$;
SELECT 'evidence-annotation-assertions: PASS' AS result;
