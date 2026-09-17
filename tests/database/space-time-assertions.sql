-- Executable assertions for the Space/Time reconciliation.
DO $$
DECLARE v_count integer;
BEGIN
  SELECT count(*) INTO v_count FROM information_schema.tables
  WHERE table_schema='core' AND table_name IN ('spatial_representations','resource_spatial_relations','time_spans','resource_time_spans');
  IF v_count <> 4 THEN RAISE EXCEPTION 'space/time table count mismatch: %', v_count; END IF;

  SELECT count(*) INTO v_count FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='core' AND c.relname IN ('spatial_representations','resource_spatial_relations','time_spans','resource_time_spans') AND c.relrowsecurity;
  IF v_count <> 4 THEN RAISE EXCEPTION 'space/time RLS count mismatch: %', v_count; END IF;

  SELECT count(*) INTO v_count FROM pg_policies
  WHERE schemaname='core' AND tablename IN ('spatial_representations','resource_spatial_relations','time_spans','resource_time_spans');
  IF v_count <> 4 THEN RAISE EXCEPTION 'space/time policy count mismatch: %', v_count; END IF;

  SELECT count(*) INTO v_count FROM pg_constraint
  WHERE connamespace='core'::regnamespace AND conname IN (
    'spatial_representations_resource_id_fkey','spatial_representations_source_evidence_id_fkey',
    'spatial_representations_precision_level_check','spatial_representations_coordinate_confidence_check',
    'resource_spatial_relations_subject_fkey','resource_spatial_relations_object_fkey','resource_spatial_relations_evidence_fkey',
    'resource_spatial_relations_distinct_check','resource_spatial_relations_confidence_check','resource_spatial_relations_epistemic_status_check',
    'time_spans_organisation_fkey','time_spans_order_check',
    'resource_time_spans_resource_fkey','resource_time_spans_time_span_fkey','resource_time_spans_evidence_fkey',
    'resource_time_spans_confidence_check','resource_time_spans_epistemic_status_check');
  IF v_count <> 17 THEN RAISE EXCEPTION 'space/time constraint count mismatch: %', v_count; END IF;

  SELECT count(*) INTO v_count FROM pg_indexes
  WHERE schemaname='core' AND indexname IN (
    'spatial_representations_resource_idx','spatial_representations_geom_idx','spatial_representations_evidence_idx',
    'resource_spatial_relations_object_idx','resource_spatial_relations_evidence_idx','time_spans_org_idx',
    'resource_time_spans_time_idx','resource_time_spans_evidence_idx');
  IF v_count <> 8 THEN RAISE EXCEPTION 'space/time index count mismatch: %', v_count; END IF;

  SELECT count(*) INTO v_count FROM pg_views WHERE schemaname='core' AND viewname IN (
    'public_spatial_representations','public_resource_spatial_relations','public_resource_time_spans');
  IF v_count <> 3 THEN RAISE EXCEPTION 'space/time public view count mismatch: %', v_count; END IF;

  SELECT count(*) INTO v_count FROM pg_policies
  WHERE schemaname='core' AND tablename IN ('spatial_representations','resource_spatial_relations','time_spans','resource_time_spans')
    AND policyname IN ('spatial_representations_read','resource_spatial_relations_read','time_spans_read','resource_time_spans_read');
  IF v_count <> 4 THEN RAISE EXCEPTION 'space/time named policy count mismatch: %', v_count; END IF;
END $$;

-- Public projection must retain the precision gate around geometry.
DO $$
DECLARE v_def text;
BEGIN
  SELECT definition INTO v_def FROM pg_views WHERE schemaname='core' AND viewname='public_spatial_representations';
  IF v_def IS NULL OR position('sr.geom' in v_def) = 0 OR position('generalized' in v_def) = 0 OR position('regional' in v_def) = 0 THEN
    RAISE EXCEPTION 'public spatial projection does not contain the required precision-gated geometry contract';
  END IF;
END $$;

SELECT 'space-time-assertions: PASS' AS result;
