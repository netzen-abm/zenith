-- ZENITH / Past Intelligence Core Security Kernel v0.1
-- Portable PostgreSQL/PostGIS implementation artifact.
-- Apply only through the target environment's migration tooling.

create extension if not exists pgcrypto;
create extension if not exists postgis;
create schema if not exists core;
create schema if not exists audit;

create type core.lifecycle_state as enum ('draft','review','published','superseded','withdrawn','archived');
create type core.policy_decision as enum ('allow','deny');

create table if not exists core.organisations (id uuid primary key default gen_random_uuid(), name text not null, created_at timestamptz not null default now());
create table if not exists core.identities (id uuid primary key, organisation_id uuid not null references core.organisations(id), created_at timestamptz not null default now());
create table if not exists core.resources (
 id uuid primary key default gen_random_uuid(), organisation_id uuid not null references core.organisations(id),
 resource_type text not null, title text, lifecycle core.lifecycle_state not null default 'draft', sensitive boolean not null default false,
 public_geometry geometry(Geometry,4326), precise_geometry geometry(Geometry,4326), created_by uuid references core.identities(id),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check (not sensitive or precise_geometry is not null or public_geometry is not null)
);
create table if not exists core.resource_memberships (resource_id uuid not null references core.resources(id) on delete cascade, identity_id uuid not null references core.identities(id) on delete cascade, role text not null, created_at timestamptz not null default now(), primary key(resource_id,identity_id));
create table if not exists core.policy_obligations (id uuid primary key default gen_random_uuid(), code text not null unique, description text not null);
create table if not exists audit.events (id uuid primary key default gen_random_uuid(), occurred_at timestamptz not null default now(), actor_identity_id uuid, actor_organisation_id uuid, action text not null, resource_type text, resource_id uuid, decision core.policy_decision, policy_version text, correlation_id uuid, metadata jsonb not null default '{}'::jsonb);

create index if not exists idx_resources_org on core.resources(organisation_id);
create index if not exists idx_memberships_identity on core.resource_memberships(identity_id);
create index if not exists idx_audit_resource on audit.events(resource_id,occurred_at desc);
create index if not exists idx_resources_public_geom on core.resources using gist(public_geometry);

create or replace function core.current_identity_id() returns uuid language sql stable as $$ select nullif(current_setting('app.identity_id',true),'')::uuid $$;
create or replace function core.current_organisation_id() returns uuid language sql stable as $$ select nullif(current_setting('app.organisation_id',true),'')::uuid $$;

create or replace function core.can_read_resource(r core.resources) returns boolean language sql stable as $$
 select r.organisation_id=core.current_organisation_id() or exists(select 1 from core.resource_memberships m where m.resource_id=r.id and m.identity_id=core.current_identity_id()) or r.lifecycle='published'
$$;
create or replace function core.can_write_resource(r core.resources) returns boolean language sql stable as $$
 select r.organisation_id=core.current_organisation_id() and (r.created_by=core.current_identity_id() or exists(select 1 from core.resource_memberships m where m.resource_id=r.id and m.identity_id=core.current_identity_id() and m.role in ('owner','editor')))
$$;

alter table core.organisations enable row level security;
alter table core.identities enable row level security;
alter table core.resources enable row level security;
alter table core.resource_memberships enable row level security;
alter table core.policy_obligations enable row level security;
alter table audit.events enable row level security;

create policy organisations_same_tenant on core.organisations for select to authenticated using(id=core.current_organisation_id());
create policy identities_same_tenant on core.identities for select to authenticated using(organisation_id=core.current_organisation_id());
create policy resources_read_policy on core.resources for select to authenticated using(core.can_read_resource(resources));
create policy resources_insert_policy on core.resources for insert to authenticated with check(organisation_id=core.current_organisation_id() and created_by=core.current_identity_id());
create policy resources_update_policy on core.resources for update to authenticated using(core.can_write_resource(resources)) with check(organisation_id=core.current_organisation_id());
create policy resources_delete_policy on core.resources for delete to authenticated using(core.can_write_resource(resources));
create policy memberships_read_policy on core.resource_memberships for select to authenticated using(exists(select 1 from core.resources r where r.id=resource_memberships.resource_id and core.can_read_resource(r)));
create policy policy_obligations_read_policy on core.policy_obligations for select to authenticated using(true);
create policy audit_insert_policy on audit.events for insert to authenticated with check(actor_identity_id=core.current_identity_id() and actor_organisation_id=core.current_organisation_id());

create view core.public_resources with(security_invoker=true) as
select id,organisation_id,resource_type,title,lifecycle,sensitive,public_geometry,created_by,created_at,updated_at from core.resources;
comment on view core.public_resources is 'Public-safe resource projection. Precise geometry intentionally excluded.';

-- The app.identity_id and app.organisation_id transaction context must be established by a trusted server-side authentication boundary. Clients must never set arbitrary tenant context.