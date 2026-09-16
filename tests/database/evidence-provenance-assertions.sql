-- Executable assertions for the evidence/provenance reconciliation.
-- Runtime Auth integration remains a separate boundary.
DO $$
DECLARE v_count integer;
BEGIN
  SELECT count(*) INTO v_count FROM information_schema.tables
  WHERE table_schema='core' AND table_name IN ('sources','evidence','observations','measurements','claims','claim_evidence','interpretations','hypotheses','provenance_links');
  IF v_count <> 9 THEN RAISE EXCEPTION 'evidence/provenance table count mismatch: %', v_count; END IF;

  SELECT count(*) INTO v_count FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='core' AND c.relname IN ('sources','evidence','observations','measurements','claims','claim_evidence','interpretations','hypotheses','provenance_links') AND c.relrowsecurity;
  IF v_count <> 9 THEN RAISE EXCEPTION 'evidence/provenance RLS count mismatch: %', v_count; END IF;

  SELECT count(*) INTO v_count FROM pg_policies
  WHERE schemaname='core' AND tablename IN ('sources','evidence','observations','measurements','claims','claim_evidence','interpretations','hypotheses','provenance_links');
  IF v_count <> 9 THEN RAISE EXCEPTION 'evidence/provenance policy count mismatch: %', v_count; END IF;

  SELECT count(*) INTO v_count FROM pg_constraint
  WHERE connamespace='core'::regnamespace AND conname IN (
    'sources_organisation_id_fkey','sources_sensitivity_check','evidence_source_id_fkey','evidence_resource_id_fkey','evidence_created_by_fkey',
    'evidence_epistemic_status_check','evidence_sensitivity_check','observations_evidence_id_fkey','observations_observer_identity_id_fkey',
    'measurements_observation_id_fkey','claims_resource_id_fkey','claims_created_by_fkey','claims_epistemic_status_check','claims_confidence_check',
    'claim_evidence_claim_id_fkey','claim_evidence_evidence_id_fkey','claim_evidence_support_type_check','interpretations_claim_id_fkey',
    'interpretations_created_by_fkey','interpretations_epistemic_status_check','interpretations_confidence_check','hypotheses_created_by_fkey',
    'hypotheses_epistemic_status_check','hypotheses_confidence_check','provenance_links_agent_identity_id_fkey');
  IF v_count <> 25 THEN RAISE EXCEPTION 'evidence/provenance constraint count mismatch: %', v_count; END IF;

  SELECT count(*) INTO v_count FROM pg_indexes
  WHERE schemaname='core' AND indexname IN ('sources_org_idx','evidence_resource_idx','evidence_source_idx','observations_evidence_idx','measurements_observation_idx','claims_resource_idx','interpretations_claim_idx','claim_evidence_evidence_idx','provenance_from_idx','provenance_to_idx');
  IF v_count <> 10 THEN RAISE EXCEPTION 'evidence/provenance index count mismatch: %', v_count; END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='core' AND tablename='sources' AND policyname='sources_read') THEN RAISE EXCEPTION 'sources policy missing'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='core' AND tablename='evidence' AND policyname='evidence_read') THEN RAISE EXCEPTION 'evidence policy missing'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='core' AND tablename='claims' AND policyname='claims_read') THEN RAISE EXCEPTION 'claims policy missing'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='core' AND tablename='provenance_links' AND policyname='provenance_read') THEN RAISE EXCEPTION 'provenance policy missing'; END IF;
END $$;
SELECT 'evidence-provenance-assertions: PASS' AS result;
