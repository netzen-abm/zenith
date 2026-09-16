-- ZENITH Core foundation reconciliation: schema shape.
set lock_timeout = '5s';

drop view if exists core.public_resources;

do $$
begin
  if exists (select 1 from information_schema.columns where table_schema='core' and table_name='resources' and column_name='lifecycle')
     and exists (select 1 from core.resources)
  then raise exception 'Legacy core.resources contains data; reconcile data before foundation shape migration'; end if;
  if exists (select 1 from information_schema.columns where table_schema='core' and table_name='identities' and column_name='organisation_id')
     and exists (select 1 from core.identities)
  then raise exception 'Legacy core.identities contains data; reconcile data before foundation shape migration'; end if;
  if exists (select 1 from information_schema.columns where table_schema='core' and table_name='policy_obligations' and column_name='code')
     and exists (select 1 from core.policy_obligations)
  then raise exception 'Legacy core.policy_obligations contains data; reconcile data before foundation shape migration'; end if;
end $$;

alter table core.organisations add column if not exists slug text;
alter table core.organisations alter column slug set not null;
alter table core.identities add column if not exists auth_user_id uuid;
alter table core.identities add column if not exists display_name text;
alter table core.identities alter column id set default gen_random_uuid();
alter table core.resources add column if not exists epistemic_status text;
alter table core.resources add column if not exists sensitivity text default 'public';
alter table core.resources add column if not exists geom geometry(Geometry,4326);
alter table core.policy_obligations add column if not exists resource_id uuid;
alter table core.policy_obligations add column if not exists obligation_type text;
alter table core.policy_obligations add column if not exists obligation jsonb not null default '{}'::jsonb;
alter table core.policy_obligations alter column resource_id set not null;
alter table core.policy_obligations alter column obligation_type set not null;

do $$
begin
  if exists (select 1 from information_schema.columns where table_schema='core' and table_name='resource_memberships' and column_name='role') then
    alter table core.resource_memberships rename column role to membership_role;
  end if;
  if exists (select 1 from information_schema.columns where table_schema='core' and table_name='identities' and column_name='organisation_id') then
    alter table core.identities drop column organisation_id;
  end if;
  if exists (select 1 from information_schema.columns where table_schema='core' and table_name='resources' and column_name='lifecycle') then
    alter table core.resources drop column lifecycle, drop column sensitive, drop column public_geometry, drop column precise_geometry, drop column created_by;
  end if;
  if exists (select 1 from information_schema.columns where table_schema='core' and table_name='policy_obligations' and column_name='code') then
    alter table core.policy_obligations drop column code, drop column description;
  end if;
end $$;

alter table core.identities drop constraint if exists identities_organisation_id_fkey;
alter table core.resources alter column title set not null;
alter table core.resources alter column sensitivity set default 'public';
alter table core.resources alter column epistemic_status set not null;

alter table core.organisations drop constraint if exists organisations_slug_key;
alter table core.organisations add constraint organisations_slug_key unique (slug);
alter table core.identities drop constraint if exists identities_auth_user_id_fkey;
alter table core.identities add constraint identities_auth_user_id_fkey foreign key (auth_user_id) references auth.users(id) on delete cascade;
alter table core.identities drop constraint if exists identities_auth_user_id_key;
alter table core.identities add constraint identities_auth_user_id_key unique (auth_user_id);

alter table core.resources drop constraint if exists resources_organisation_id_fkey;
alter table core.resources drop constraint if exists resources_epistemic_status_check;
alter table core.resources drop constraint if exists resources_sensitivity_check;
alter table core.resources add constraint resources_organisation_id_fkey foreign key (organisation_id) references core.organisations(id) on delete restrict;
alter table core.resources add constraint resources_epistemic_status_check check (epistemic_status = any (array['observed','documented','derived','interpreted','hypothesized','traditional_oral','contested_disputed','unknown']));
alter table core.resources add constraint resources_sensitivity_check check (sensitivity = any (array['public','controlled','sensitive']));

alter table core.resource_memberships drop constraint if exists resource_memberships_resource_id_fkey;
alter table core.resource_memberships drop constraint if exists resource_memberships_identity_id_fkey;
alter table core.resource_memberships drop constraint if exists resource_memberships_membership_role_check;
alter table core.resource_memberships add constraint resource_memberships_resource_id_fkey foreign key (resource_id) references core.resources(id) on delete cascade;
alter table core.resource_memberships add constraint resource_memberships_identity_id_fkey foreign key (identity_id) references core.identities(id) on delete cascade;
alter table core.resource_memberships add constraint resource_memberships_membership_role_check check (membership_role = any (array['viewer','editor','owner']));

alter table core.policy_obligations drop constraint if exists policy_obligations_resource_id_fkey;
alter table core.policy_obligations add constraint policy_obligations_resource_id_fkey foreign key (resource_id) references core.resources(id) on delete cascade;

drop index if exists core.idx_resources_org;
drop index if exists core.idx_memberships_identity;
drop index if exists core.idx_resources_public_geom;
create index if not exists resources_organisation_idx on core.resources(organisation_id);
create index if not exists resources_geom_idx on core.resources using gist(geom);

comment on column core.resources.epistemic_status is 'Epistemic status: observed, documented, derived, interpreted, hypothesized, traditional_oral, contested_disputed, or unknown.';
comment on column core.resources.sensitivity is 'Disclosure sensitivity: public, controlled, or sensitive.';

create view core.public_resources with (security_invoker=true) as
select id, organisation_id, resource_type, title, epistemic_status, sensitivity,
       created_at, updated_at,
       case when sensitivity='public' then geom else null::geometry end as geom
from core.resources where sensitivity='public';
grant select on core.public_resources to anon, authenticated;
