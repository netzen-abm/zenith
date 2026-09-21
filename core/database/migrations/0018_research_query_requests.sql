set lock_timeout = '5s';

create unique index if not exists research_questions_id_org_uq on core.research_questions(id, organisation_id);

create table if not exists core.research_query_requests (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references core.organisations(id) on delete restrict,
  identity_id uuid not null references core.identities(id) on delete restrict,
  research_question_id uuid,
  intent text not null,
  query_text text not null,
  concepts jsonb not null default '[]'::jsonb,
  filters jsonb not null default '{}'::jsonb,
  sort jsonb not null default '[]'::jsonb,
  page_size integer not null check (page_size between 1 and 100),
  cursor text,
  requested_fields jsonb not null default '[]'::jsonb,
  open_access_required boolean not null default false,
  purpose text not null,
  created_at timestamptz not null default now(),
  constraint research_query_question_scope foreign key (research_question_id, organisation_id)
    references core.research_questions(id, organisation_id) on delete restrict
);

create unique index if not exists research_query_requests_id_uq on core.research_query_requests(id);
create index if not exists research_query_requests_org_identity_idx on core.research_query_requests(organisation_id, identity_id, created_at desc);
create index if not exists research_query_requests_question_idx on core.research_query_requests(research_question_id);

alter table core.research_query_requests enable row level security;
alter table core.research_query_requests force row level security;

drop policy if exists research_query_requests_select on core.research_query_requests;
drop policy if exists research_query_requests_insert on core.research_query_requests;

create policy research_query_requests_select on core.research_query_requests
  for select to authenticated using (
    organisation_id = core.current_organisation_id()
    and identity_id = core.current_identity_id()
  );

create policy research_query_requests_insert on core.research_query_requests
  for insert to authenticated with check (
    organisation_id = core.current_organisation_id()
    and identity_id = core.current_identity_id()
  );

grant select, insert on core.research_query_requests to authenticated;

comment on table core.research_query_requests is 'Durable Research Intelligence query envelope; operation.payload_ref points here. Provider results and secrets remain outside this table.';
