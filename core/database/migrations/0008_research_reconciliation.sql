set lock_timeout = '5s';

-- Data-bearing live tables are reconciled in place. Never reconstruct them destructively.
do $$
declare
  t text;
  required text[] := array['id','organisation_id'];
begin
  foreach t in array array['research_questions','research_projects','datasets','methods'] loop
    if to_regclass('core.' || t) is not null then
      if not exists (
        select 1 from information_schema.columns
        where table_schema='core' and table_name=t and column_name='organisation_id'
      ) then raise exception 'research reconciliation refused: core.% lacks organisation_id', t; end if;
    end if;
  end loop;
end $$;

create table if not exists core.research_questions (
  id uuid primary key default gen_random_uuid(), organisation_id uuid not null references core.organisations(id) on delete restrict,
  question text not null, status text not null default 'open' check (status in ('draft','open','active','answered','closed','superseded')),
  epistemic_scope text, created_by_identity_id uuid references core.identities(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists core.research_projects (
  id uuid primary key default gen_random_uuid(), organisation_id uuid not null references core.organisations(id) on delete restrict,
  name text not null, description text, status text not null default 'planning' check (status in ('planning','active','paused','completed','archived')),
  created_by_identity_id uuid references core.identities(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists core.research_project_questions (
  project_id uuid not null references core.research_projects(id) on delete cascade,
  question_id uuid not null references core.research_questions(id) on delete cascade,
  primary key (project_id, question_id)
);
create table if not exists core.datasets (
  id uuid primary key default gen_random_uuid(), organisation_id uuid not null references core.organisations(id) on delete restrict,
  name text not null, description text, version text, source_resource_id uuid references core.resources(id) on delete set null,
  status text not null default 'draft' check (status in ('draft','active','deprecated','archived')), created_at timestamptz not null default now()
);
create table if not exists core.research_project_datasets (
  project_id uuid not null references core.research_projects(id) on delete cascade,
  dataset_id uuid not null references core.datasets(id) on delete cascade,
  role text not null default 'input' check (role in ('input','output','reference')),
  primary key (project_id, dataset_id)
);
create table if not exists core.methods (
  id uuid primary key default gen_random_uuid(), organisation_id uuid not null references core.organisations(id) on delete restrict,
  name text not null, description text, method_type text, protocol jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);
create table if not exists core.research_project_methods (
  project_id uuid not null references core.research_projects(id) on delete cascade,
  method_id uuid not null references core.methods(id) on delete cascade,
  primary key (project_id, method_id)
);
create table if not exists core.research_runs (
  id uuid primary key default gen_random_uuid(), project_id uuid not null references core.research_projects(id) on delete cascade,
  method_id uuid references core.methods(id) on delete set null, dataset_id uuid references core.datasets(id) on delete set null,
  status text not null default 'planned' check (status in ('planned','running','completed','failed','cancelled')),
  started_at timestamptz, completed_at timestamptz, parameters jsonb not null default '{}'::jsonb,
  created_by_identity_id uuid references core.identities(id) on delete set null, created_at timestamptz not null default now(),
  check (completed_at is null or started_at is null or completed_at >= started_at)
);
create table if not exists core.research_outputs (
  id uuid primary key default gen_random_uuid(), run_id uuid not null references core.research_runs(id) on delete cascade,
  resource_id uuid references core.resources(id) on delete set null, output_type text not null, output jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists research_questions_org_idx on core.research_questions(organisation_id);
create index if not exists research_projects_org_idx on core.research_projects(organisation_id);
create index if not exists datasets_org_idx on core.datasets(organisation_id);
create index if not exists datasets_source_resource_idx on core.datasets(source_resource_id);
create index if not exists methods_org_idx on core.methods(organisation_id);
create index if not exists research_runs_project_idx on core.research_runs(project_id);
create index if not exists research_runs_method_idx on core.research_runs(method_id);
create index if not exists research_runs_dataset_idx on core.research_runs(dataset_id);
create index if not exists research_outputs_run_idx on core.research_outputs(run_id);
create index if not exists research_outputs_resource_idx on core.research_outputs(resource_id);

alter table core.research_questions enable row level security;
alter table core.research_projects enable row level security;
alter table core.research_project_questions enable row level security;
alter table core.datasets enable row level security;
alter table core.research_project_datasets enable row level security;
alter table core.methods enable row level security;
alter table core.research_project_methods enable row level security;
alter table core.research_runs enable row level security;
alter table core.research_outputs enable row level security;

-- Recreate the audited read boundary; no write policy is introduced here.
drop policy if exists research_questions_read on core.research_questions;
drop policy if exists research_projects_read on core.research_projects;
drop policy if exists project_questions_read on core.research_project_questions;
drop policy if exists datasets_read on core.datasets;
drop policy if exists project_datasets_read on core.research_project_datasets;
drop policy if exists methods_read on core.methods;
drop policy if exists project_methods_read on core.research_project_methods;
drop policy if exists research_runs_read on core.research_runs;
drop policy if exists research_outputs_read on core.research_outputs;

create policy research_questions_read on core.research_questions for select to authenticated using (exists (select 1 from core.resources r where r.organisation_id=research_questions.organisation_id and core.can_read_resource(r.id)));
create policy research_projects_read on core.research_projects for select to authenticated using (exists (select 1 from core.resources r where r.organisation_id=research_projects.organisation_id and core.can_read_resource(r.id)));
create policy project_questions_read on core.research_project_questions for select to authenticated using (exists (select 1 from core.research_projects p join core.resources r on r.organisation_id=p.organisation_id where p.id=research_project_questions.project_id and core.can_read_resource(r.id)));
create policy datasets_read on core.datasets for select to authenticated using (source_resource_id is null or exists (select 1 from core.resources r where r.id=datasets.source_resource_id and core.can_read_resource(r.id)));
create policy project_datasets_read on core.research_project_datasets for select to authenticated using (exists (select 1 from core.research_projects p join core.resources r on r.organisation_id=p.organisation_id where p.id=research_project_datasets.project_id and core.can_read_resource(r.id)));
create policy methods_read on core.methods for select to authenticated using (exists (select 1 from core.resources r where r.organisation_id=methods.organisation_id and core.can_read_resource(r.id)));
create policy project_methods_read on core.research_project_methods for select to authenticated using (exists (select 1 from core.research_projects p join core.resources r on r.organisation_id=p.organisation_id where p.id=research_project_methods.project_id and core.can_read_resource(r.id)));
create policy research_runs_read on core.research_runs for select to authenticated using (exists (select 1 from core.research_projects p join core.resources r on r.organisation_id=p.organisation_id where p.id=research_runs.project_id and core.can_read_resource(r.id)));
create policy research_outputs_read on core.research_outputs for select to authenticated using (exists (select 1 from core.research_runs rr join core.research_projects p on p.id=rr.project_id join core.resources r on r.organisation_id=p.organisation_id where rr.id=research_outputs.run_id and core.can_read_resource(r.id)));

grant select on core.research_questions, core.research_projects, core.research_project_questions, core.datasets, core.research_project_datasets, core.methods, core.research_project_methods, core.research_runs, core.research_outputs to authenticated;

create or replace view core.public_research_questions with (security_invoker=true) as
select id, question, status, created_at, updated_at from core.research_questions where status in ('open','active');
grant select on core.public_research_questions to anon, authenticated;

comment on view core.public_research_questions is 'Public discovery projection: open/active questions only; organisation and creator identity are excluded.';
comment on table core.research_outputs is 'Research result record. Prefer linking substantive claims/evidence/provenance through Core resources rather than treating JSON output as authoritative evidence.';
