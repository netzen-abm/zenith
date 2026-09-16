-- ZENITH Core knowledge-graph reconciliation: relationship/assertion contract.
set lock_timeout = '5s';

drop policy if exists entity_relationships_read on core.entity_relationships;
drop policy if exists entity_assertions_read on core.entity_assertions;

create table if not exists core.entity_relationships (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null,
  subject_resource_id uuid not null,
  predicate text not null,
  object_resource_id uuid not null,
  asserted_by_identity_id uuid,
  evidence_id uuid,
  epistemic_status text not null,
  confidence numeric,
  valid_from timestamptz,
  valid_to timestamptz,
  assertion jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint entity_relationships_organisation_id_fkey foreign key (organisation_id) references core.organisations(id) on delete restrict,
  constraint entity_relationships_subject_resource_id_fkey foreign key (subject_resource_id) references core.resources(id) on delete cascade,
  constraint entity_relationships_object_resource_id_fkey foreign key (object_resource_id) references core.resources(id) on delete cascade,
  constraint entity_relationships_asserted_by_identity_id_fkey foreign key (asserted_by_identity_id) references core.identities(id) on delete set null,
  constraint entity_relationships_evidence_id_fkey foreign key (evidence_id) references core.evidence(id) on delete set null,
  constraint entity_relationships_check check (subject_resource_id <> object_resource_id),
  constraint entity_relationships_check1 check (valid_to is null or valid_from is null or valid_to >= valid_from),
  constraint entity_relationships_confidence_check check (confidence is null or (confidence >= 0 and confidence <= 1)),
  constraint entity_relationships_epistemic_status_check check (epistemic_status = any (array['observed','documented','derived','interpreted','hypothesized','traditional_oral','contested_disputed','unknown']))
);

create table if not exists core.entity_assertions (
  id uuid primary key default gen_random_uuid(),
  relationship_id uuid not null,
  assertion_type text not null,
  evidence_id uuid,
  source_id uuid,
  note text,
  created_at timestamptz not null default now(),
  constraint entity_assertions_relationship_id_fkey foreign key (relationship_id) references core.entity_relationships(id) on delete cascade,
  constraint entity_assertions_evidence_id_fkey foreign key (evidence_id) references core.evidence(id) on delete set null,
  constraint entity_assertions_source_id_fkey foreign key (source_id) references core.sources(id) on delete set null,
  constraint entity_assertions_assertion_type_check check (assertion_type = any (array['support','contradict','qualify','derive','contextualize']))
);

create index if not exists entity_relationships_org_idx on core.entity_relationships(organisation_id);
create index if not exists entity_relationships_subject_idx on core.entity_relationships(subject_resource_id);
create index if not exists entity_relationships_object_idx on core.entity_relationships(object_resource_id);
create index if not exists entity_relationships_evidence_idx on core.entity_relationships(evidence_id);
create index if not exists entity_assertions_relationship_idx on core.entity_assertions(relationship_id);
create index if not exists entity_assertions_evidence_idx on core.entity_assertions(evidence_id);

alter table core.entity_relationships enable row level security;
alter table core.entity_assertions enable row level security;

create policy entity_relationships_read on core.entity_relationships for select to authenticated using (
  core.can_read_resource(subject_resource_id) and core.can_read_resource(object_resource_id)
);
create policy entity_assertions_read on core.entity_assertions for select to authenticated using (
  core.can_read_resource((select r.subject_resource_id from core.entity_relationships r where r.id = entity_assertions.relationship_id))
);

grant select on core.entity_relationships, core.entity_assertions to authenticated;

create or replace view core.public_entity_relationships with (security_invoker = true) as
select er.id, er.subject_resource_id, er.predicate, er.object_resource_id,
       er.epistemic_status, er.confidence, er.valid_from, er.valid_to,
       er.created_at, er.updated_at
from core.entity_relationships er
join core.resources s on s.id = er.subject_resource_id
join core.resources o on o.id = er.object_resource_id
where s.sensitivity = 'public' and o.sensitivity = 'public';

grant select on core.public_entity_relationships to anon, authenticated;
comment on view core.public_entity_relationships is 'Public-safe relationship projection. Relationship payload, tenant identity, evidence linkage, and assertions are intentionally excluded.';
