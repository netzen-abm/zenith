-- ZENITH explicit identity -> organisation context contract.
set lock_timeout = '5s';

create table if not exists core.identity_organisation_memberships (
  identity_id uuid not null references core.identities(id) on delete cascade,
  organisation_id uuid not null references core.organisations(id) on delete cascade,
  membership_role text not null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (identity_id, organisation_id),
  check (membership_role in ('member','researcher','editor','admin','owner')),
  check (status in ('active','suspended','revoked'))
);

create index if not exists identity_org_memberships_org_idx
  on core.identity_organisation_memberships(organisation_id, status);

alter table core.identity_organisation_memberships enable row level security;

drop policy if exists identity_org_memberships_self_read on core.identity_organisation_memberships;
create policy identity_org_memberships_self_read
  on core.identity_organisation_memberships for select to authenticated
  using (identity_id = core.current_identity_id());

grant select on core.identity_organisation_memberships to authenticated;

-- Preserve any already-existing tenant relationships represented by resource membership.
insert into core.identity_organisation_memberships
  (identity_id, organisation_id, membership_role)
select distinct rm.identity_id, r.organisation_id,
  case when bool_or(rm.membership_role = 'owner') then 'owner'
       when bool_or(rm.membership_role = 'editor') then 'editor'
       else 'member' end
from core.resource_memberships rm
join core.resources r on r.id = rm.resource_id
join core.identities i on i.id = rm.identity_id
join core.organisations o on o.id = r.organisation_id
group by rm.identity_id, r.organisation_id
on conflict (identity_id, organisation_id) do nothing;

create or replace function core.current_organisation_id()
returns uuid language sql stable security definer set search_path = '' as $$
  select m.organisation_id
  from core.identity_organisation_memberships m
  where m.identity_id = core.current_identity_id()
    and m.organisation_id = nullif(current_setting('app.organisation_id', true), '')::uuid
    and m.status = 'active'
  limit 1
$$;

create or replace function core.has_active_organisation_membership(p_organisation_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from core.identity_organisation_memberships m
    where m.identity_id = core.current_identity_id()
      and m.organisation_id = p_organisation_id
      and m.status = 'active'
  )
$$;

revoke execute on function core.has_active_organisation_membership(uuid) from public;
grant execute on function core.has_active_organisation_membership(uuid) to authenticated;

comment on table core.identity_organisation_memberships is
  'Explicit identity-to-organisation membership. Resource memberships remain resource-level authorization.';
comment on function core.current_organisation_id() is
  'Returns the explicitly selected organisation only when the authenticated identity has an active membership. app.organisation_id is trusted server-side context, never client-controlled.';
