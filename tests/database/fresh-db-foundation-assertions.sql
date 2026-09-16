-- Executable assertions for the repository's Core foundation reconciliation.
-- This validates migration shape/security, not Supabase Auth itself.

DO $$
DECLARE
  v_count integer;
BEGIN
  SELECT count(*) INTO v_count FROM information_schema.columns
  WHERE table_schema='core' AND table_name='resources'
    AND column_name IN ('lifecycle','sensitive','public_geometry','precise_geometry','created_by');
  IF v_count <> 0 THEN RAISE EXCEPTION 'legacy resource columns remain'; END IF;

  SELECT count(*) INTO v_count FROM information_schema.columns
  WHERE table_schema='core' AND table_name='identities' AND column_name='organisation_id';
  IF v_count <> 0 THEN RAISE EXCEPTION 'legacy identity organisation_id remains'; END IF;

  SELECT count(*) INTO v_count FROM information_schema.columns
  WHERE table_schema='core' AND table_name='policy_obligations' AND column_name IN ('code','description');
  IF v_count <> 0 THEN RAISE EXCEPTION 'legacy policy obligation columns remain'; END IF;

  SELECT count(*) INTO v_count FROM information_schema.columns
  WHERE table_schema='core' AND table_name='resource_memberships' AND column_name='membership_role';
  IF v_count <> 1 THEN RAISE EXCEPTION 'membership_role missing'; END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='core' AND table_name='resources' AND column_name='geom') THEN
    RAISE EXCEPTION 'resources.geom missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='core' AND table_name='resources' AND column_name='epistemic_status') THEN
    RAISE EXCEPTION 'resources.epistemic_status missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='core' AND table_name='resources' AND column_name='sensitivity') THEN
    RAISE EXCEPTION 'resources.sensitivity missing';
  END IF;

  SELECT count(*) INTO v_count FROM pg_constraint
  WHERE conrelid='core.resources'::regclass AND conname IN ('resources_epistemic_status_check','resources_sensitivity_check','resources_organisation_id_fkey');
  IF v_count <> 3 THEN RAISE EXCEPTION 'resource constraints incomplete'; END IF;

  SELECT count(*) INTO v_count FROM pg_constraint
  WHERE conrelid='core.identities'::regclass AND conname IN ('identities_auth_user_id_fkey','identities_auth_user_id_key');
  IF v_count <> 2 THEN RAISE EXCEPTION 'identity auth constraints incomplete'; END IF;

  SELECT count(*) INTO v_count FROM pg_constraint
  WHERE conrelid='core.policy_obligations'::regclass AND conname='policy_obligations_resource_id_fkey';
  IF v_count <> 1 THEN RAISE EXCEPTION 'policy obligation resource FK missing'; END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE oid='core.resources'::regclass AND relrowsecurity) THEN RAISE EXCEPTION 'resources RLS disabled'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE oid='core.organisations'::regclass AND relrowsecurity) THEN RAISE EXCEPTION 'organisations RLS disabled'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE oid='core.identities'::regclass AND relrowsecurity) THEN RAISE EXCEPTION 'identities RLS disabled'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE oid='core.resource_memberships'::regclass AND relrowsecurity) THEN RAISE EXCEPTION 'memberships RLS disabled'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE oid='core.policy_obligations'::regclass AND relrowsecurity) THEN RAISE EXCEPTION 'policy obligations RLS disabled'; END IF;

  SELECT count(*) INTO v_count FROM pg_policies WHERE schemaname='core' AND tablename='resources' AND policyname IN ('resources_anon_public_read','resources_authenticated_read');
  IF v_count <> 2 THEN RAISE EXCEPTION 'resource read policies incomplete'; END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_views WHERE schemaname='core' AND viewname='public_resources') THEN RAISE EXCEPTION 'public_resources view missing'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='core' AND c.relname='public_resources' AND c.relkind='v') THEN RAISE EXCEPTION 'public_resources is not a view'; END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid='core.current_identity_id()'::regprocedure AND prosecdef AND coalesce(proconfig::text,'') like '%search_path%') THEN RAISE EXCEPTION 'current_identity_id security contract failed'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid='core.current_organisation_id()'::regprocedure AND prosecdef AND coalesce(proconfig::text,'') like '%search_path%') THEN RAISE EXCEPTION 'current_organisation_id security contract failed'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid='core.can_read_resource(uuid)'::regprocedure AND prosecdef AND coalesce(proconfig::text,'') like '%search_path%') THEN RAISE EXCEPTION 'can_read_resource security contract failed'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid='core.can_write_resource(uuid)'::regprocedure AND prosecdef AND coalesce(proconfig::text,'') like '%search_path%') THEN RAISE EXCEPTION 'can_write_resource security contract failed'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid='core.authorize_capability(text,uuid,text)'::regprocedure AND NOT prosecdef AND coalesce(proconfig::text,'') like '%search_path%') THEN RAISE EXCEPTION 'authorize_capability security contract failed'; END IF;
END $$;

SELECT 'fresh-db-foundation-assertions: PASS' AS result;
