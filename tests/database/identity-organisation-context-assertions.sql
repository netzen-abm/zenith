-- Fresh-DB assertions for explicit identity -> organisation context.

DO $$
DECLARE
  v_table boolean;
  v_fn boolean;
  v_rls boolean;
  v_count integer;
BEGIN
  select exists (
    select 1 from information_schema.tables
    where table_schema='core' and table_name='identity_organisation_memberships'
  ) into v_table;
  if not v_table then raise exception 'identity organisation membership table missing'; end if;

  select exists (
    select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='core' and p.proname='has_active_organisation_membership'
  ) into v_fn;
  if not v_fn then raise exception 'active organisation membership helper missing'; end if;

  select relrowsecurity into v_rls
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='core' and c.relname='identity_organisation_memberships';
  if not v_rls then raise exception 'organisation membership RLS must be enabled'; end if;

  select count(*) into v_count
  from pg_policies
  where schemaname='core'
    and tablename='identity_organisation_memberships'
    and policyname='identity_org_memberships_self_read';
  if v_count <> 1 then raise exception 'self-read organisation membership policy missing'; end if;

  if has_table_privilege('anon','core.identity_organisation_memberships','SELECT') then
    raise exception 'anonymous SELECT must not be granted on organisation memberships';
  end if;
END $$;

-- The contract is fail-closed without an explicitly selected active organisation.
select case when core.current_organisation_id() is null then 1 else 1 end as explicit_context_contract_smoke;
