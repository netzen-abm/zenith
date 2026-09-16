-- ZENITH Core foundation reconciliation: security contract.
set lock_timeout = '5s';

drop policy if exists organisations_same_tenant on core.organisations;
drop policy if exists identities_same_tenant on core.identities;
drop policy if exists resources_read_policy on core.resources;
drop policy if exists resources_insert_policy on core.resources;
drop policy if exists resources_update_policy on core.resources;
drop policy if exists resources_delete_policy on core.resources;
drop policy if exists memberships_read_policy on core.resource_memberships;
drop policy if exists policy_obligations_read_policy on core.policy_obligations;
drop policy if exists organisations_member_read on core.organisations;
drop policy if exists identities_self_read on core.identities;
drop policy if exists resources_anon_public_read on core.resources;
drop policy if exists resources_authenticated_read on core.resources;
drop policy if exists resource_memberships_self_read on core.resource_memberships;
drop policy if exists policy_obligations_read on core.policy_obligations;

drop function if exists core.can_read_resource(core.resources);
drop function if exists core.can_write_resource(core.resources);

create or replace function core.current_identity_id()
returns uuid language sql stable security definer set search_path = '' as $$
  select i.id from core.identities i where i.auth_user_id = (select auth.uid()) limit 1
$$;

create or replace function core.current_organisation_id()
returns uuid language sql stable security definer set search_path = '' as $$
  select r.organisation_id from core.resources r
  join core.resource_memberships rm on rm.resource_id = r.id
  where rm.identity_id = core.current_identity_id()
  order by r.created_at asc limit 1
$$;

create or replace function core.can_read_resource(p_resource_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from core.resources r
    left join core.resource_memberships rm on rm.resource_id = r.id and rm.identity_id = core.current_identity_id()
    where r.id = p_resource_id and (r.sensitivity = 'public' or rm.membership_role in ('viewer','editor','owner'))
  )
$$;

create or replace function core.can_write_resource(p_resource_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from core.resource_memberships rm
    where rm.resource_id = p_resource_id and rm.identity_id = core.current_identity_id()
      and rm.membership_role in ('editor','owner')
  )
$$;

alter table core.organisations enable row level security;
alter table core.identities enable row level security;
alter table core.resources enable row level security;
alter table core.resource_memberships enable row level security;
alter table core.policy_obligations enable row level security;

create policy organisations_member_read on core.organisations for select to authenticated using (
  exists (select 1 from core.resources r join core.resource_memberships rm on rm.resource_id = r.id
    where r.organisation_id = organisations.id and rm.identity_id = core.current_identity_id())
);
create policy identities_self_read on core.identities for select to authenticated using (id = core.current_identity_id());
create policy resources_anon_public_read on core.resources for select to anon using (sensitivity = 'public');
create policy resources_authenticated_read on core.resources for select to authenticated using (sensitivity = 'public' or core.can_read_resource(id));
create policy resource_memberships_self_read on core.resource_memberships for select to authenticated using (identity_id = core.current_identity_id() or core.can_read_resource(resource_id));
create policy policy_obligations_read on core.policy_obligations for select to authenticated using (core.can_read_resource(resource_id));

grant select on core.organisations, core.identities, core.resource_memberships, core.policy_obligations to authenticated;
grant select on core.resources to anon, authenticated;

revoke execute on function core.current_identity_id() from public;
revoke execute on function core.current_organisation_id() from public;
revoke execute on function core.can_read_resource(uuid) from public;
revoke execute on function core.can_write_resource(uuid) from public;
grant execute on function core.current_identity_id() to authenticated;
grant execute on function core.current_organisation_id() to authenticated;
grant execute on function core.can_read_resource(uuid) to authenticated;
grant execute on function core.can_write_resource(uuid) to authenticated;
