-- Executable assertions for the Knowledge Graph reconciliation.
DO $$
DECLARE v_count integer;
BEGIN
  SELECT count(*) INTO v_count FROM information_schema.tables
  WHERE table_schema='core' AND table_name IN ('entity_relationships','entity_assertions');
  IF v_count <> 2 THEN RAISE EXCEPTION 'knowledge graph table count mismatch: %', v_count; END IF;

  SELECT count(*) INTO v_count FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='core' AND c.relname IN ('entity_relationships','entity_assertions') AND c.relrowsecurity;
  IF v_count <> 2 THEN RAISE EXCEPTION 'knowledge graph RLS count mismatch: %', v_count; END IF;

  SELECT count(*) INTO v_count FROM pg_policies
  WHERE schemaname='core' AND tablename IN ('entity_relationships','entity_assertions');
  IF v_count <> 2 THEN RAISE EXCEPTION 'knowledge graph policy count mismatch: %', v_count; END IF;

  SELECT count(*) INTO v_count FROM pg_constraint
  WHERE connamespace='core'::regnamespace AND conname IN (
    'entity_relationships_organisation_id_fkey','entity_relationships_subject_resource_id_fkey','entity_relationships_object_resource_id_fkey',
    'entity_relationships_asserted_by_identity_id_fkey','entity_relationships_evidence_id_fkey','entity_relationships_check',
    'entity_relationships_check1','entity_relationships_confidence_check','entity_relationships_epistemic_status_check',
    'entity_assertions_relationship_id_fkey','entity_assertions_evidence_id_fkey','entity_assertions_source_id_fkey','entity_assertions_assertion_type_check');
  IF v_count <> 13 THEN RAISE EXCEPTION 'knowledge graph constraint count mismatch: %', v_count; END IF;

  SELECT count(*) INTO v_count FROM pg_indexes
  WHERE schemaname='core' AND indexname IN ('entity_relationships_org_idx','entity_relationships_subject_idx','entity_relationships_object_idx',
    'entity_relationships_evidence_idx','entity_assertions_relationship_idx','entity_assertions_evidence_idx');
  IF v_count <> 6 THEN RAISE EXCEPTION 'knowledge graph index count mismatch: %', v_count; END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_views WHERE schemaname='core' AND viewname='public_entity_relationships') THEN
    RAISE EXCEPTION 'public_entity_relationships view missing';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='core' AND tablename='entity_relationships' AND policyname='entity_relationships_read') THEN
    RAISE EXCEPTION 'entity_relationships policy missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='core' AND tablename='entity_assertions' AND policyname='entity_assertions_read') THEN
    RAISE EXCEPTION 'entity_assertions policy missing';
  END IF;
END $$;
SELECT 'knowledge-graph-assertions: PASS' AS result;
