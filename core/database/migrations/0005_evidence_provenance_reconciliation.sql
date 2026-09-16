-- ZENITH Core evidence/provenance reconciliation: schema contract.
set lock_timeout = '5s';

create table if not exists core.sources (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid,
  source_type text not null,
  title text not null,
  citation jsonb not null default '{}'::jsonb,
  external_identifier text,
  canonical_uri text,
  rights jsonb not null default '{}'::jsonb,
  sensitivity text not null default 'public',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sources_organisation_id_fkey foreign key (organisation_id) references core.organisations(id) on delete restrict,
  constraint sources_sensitivity_check check (sensitivity = any (array['public','controlled','sensitive']))
);

create table if not exists core.evidence (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null,
  resource_id uuid,
  evidence_type text not null,
  locator jsonb not null default '{}'::jsonb,
  excerpt text,
  evidence_payload jsonb not null default '{}'::jsonb,
  epistemic_status text not null default 'documented',
  sensitivity text not null default 'public',
  created_by uuid,
  created_at timestamptz not null default now(),
  constraint evidence_source_id_fkey foreign key (source_id) references core.sources(id) on delete restrict,
  constraint evidence_resource_id_fkey foreign key (resource_id) references core.resources(id) on delete set null,
  constraint evidence_created_by_fkey foreign key (created_by) references core.identities(id) on delete set null,
  constraint evidence_epistemic_status_check check (epistemic_status = any (array['observed','documented','derived','interpreted','hypothesized','traditional_oral','contested_disputed','unknown'])),
  constraint evidence_sensitivity_check check (sensitivity = any (array['public','controlled','sensitive']))
);

create table if not exists core.observations (
  id uuid primary key default gen_random_uuid(),
  evidence_id uuid not null,
  observation_type text not null,
  value jsonb not null,
  method jsonb not null default '{}'::jsonb,
  observed_at timestamptz,
  observer_identity_id uuid,
  uncertainty jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint observations_evidence_id_fkey foreign key (evidence_id) references core.evidence(id) on delete cascade,
  constraint observations_observer_identity_id_fkey foreign key (observer_identity_id) references core.identities(id) on delete set null
);

create table if not exists core.measurements (
  id uuid primary key default gen_random_uuid(),
  observation_id uuid not null,
  quantity numeric,
  unit text,
  value jsonb,
  method jsonb not null default '{}'::jsonb,
  uncertainty jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint measurements_observation_id_fkey foreign key (observation_id) references core.observations(id) on delete cascade
);

create table if not exists core.claims (
  id uuid primary key default gen_random_uuid(),
  resource_id uuid,
  claim_text text not null,
  epistemic_status text not null,
  confidence numeric,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint claims_resource_id_fkey foreign key (resource_id) references core.resources(id) on delete set null,
  constraint claims_created_by_fkey foreign key (created_by) references core.identities(id) on delete set null,
  constraint claims_epistemic_status_check check (epistemic_status = any (array['observed','documented','derived','interpreted','hypothesized','traditional_oral','contested_disputed','unknown'])),
  constraint claims_confidence_check check (confidence is null or (confidence >= 0 and confidence <= 1))
);

create table if not exists core.claim_evidence (
  claim_id uuid not null,
  evidence_id uuid not null,
  support_type text not null,
  rationale text,
  created_at timestamptz not null default now(),
  primary key (claim_id, evidence_id, support_type),
  constraint claim_evidence_claim_id_fkey foreign key (claim_id) references core.claims(id) on delete cascade,
  constraint claim_evidence_evidence_id_fkey foreign key (evidence_id) references core.evidence(id) on delete cascade,
  constraint claim_evidence_support_type_check check (support_type = any (array['supports','contradicts','contextualizes','derives_from']))
);

create table if not exists core.interpretations (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null,
  interpretation_text text not null,
  method jsonb not null default '{}'::jsonb,
  epistemic_status text not null default 'interpreted',
  confidence numeric,
  created_by uuid,
  created_at timestamptz not null default now(),
  constraint interpretations_claim_id_fkey foreign key (claim_id) references core.claims(id) on delete cascade,
  constraint interpretations_created_by_fkey foreign key (created_by) references core.identities(id) on delete set null,
  constraint interpretations_epistemic_status_check check (epistemic_status = any (array['interpreted','hypothesized','contested_disputed','unknown'])),
  constraint interpretations_confidence_check check (confidence is null or (confidence >= 0 and confidence <= 1))
);

create table if not exists core.hypotheses (
  id uuid primary key default gen_random_uuid(),
  research_question_id uuid,
  hypothesis_text text not null,
  epistemic_status text not null default 'hypothesized',
  confidence numeric,
  created_by uuid,
  created_at timestamptz not null default now(),
  constraint hypotheses_created_by_fkey foreign key (created_by) references core.identities(id) on delete set null,
  constraint hypotheses_epistemic_status_check check (epistemic_status = any (array['hypothesized','contested_disputed','unknown'])),
  constraint hypotheses_confidence_check check (confidence is null or (confidence >= 0 and confidence <= 1))
);

create table if not exists core.provenance_links (
  id uuid primary key default gen_random_uuid(),
  from_entity_type text not null,
  from_entity_id uuid not null,
  relation_type text not null,
  to_entity_type text not null,
  to_entity_id uuid not null,
  agent_identity_id uuid,
  activity jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint provenance_links_agent_identity_id_fkey foreign key (agent_identity_id) references core.identities(id) on delete set null
);

create index if not exists sources_org_idx on core.sources(organisation_id);
create index if not exists evidence_resource_idx on core.evidence(resource_id);
create index if not exists evidence_source_idx on core.evidence(source_id);
create index if not exists observations_evidence_idx on core.observations(evidence_id);
create index if not exists measurements_observation_idx on core.measurements(observation_id);
create index if not exists claims_resource_idx on core.claims(resource_id);
create index if not exists interpretations_claim_idx on core.interpretations(claim_id);
create index if not exists claim_evidence_evidence_idx on core.claim_evidence(evidence_id);
create index if not exists provenance_from_idx on core.provenance_links(from_entity_type, from_entity_id);
create index if not exists provenance_to_idx on core.provenance_links(to_entity_type, to_entity_id);

alter table core.sources enable row level security;
alter table core.evidence enable row level security;
alter table core.observations enable row level security;
alter table core.measurements enable row level security;
alter table core.claims enable row level security;
alter table core.claim_evidence enable row level security;
alter table core.interpretations enable row level security;
alter table core.hypotheses enable row level security;
alter table core.provenance_links enable row level security;

create policy sources_read on core.sources for select to authenticated using (
  sensitivity = 'public' or organisation_id = core.current_organisation_id()
);
create policy evidence_read on core.evidence for select to authenticated using (
  sensitivity = 'public' or exists (select 1 from core.resources r where r.id = evidence.resource_id and core.can_read_resource(r.id))
  or exists (select 1 from core.sources s where s.id = evidence.source_id and s.organisation_id = core.current_organisation_id())
);
create policy observations_read on core.observations for select to authenticated using (
  exists (select 1 from core.evidence e where e.id = observations.evidence_id and (e.sensitivity = 'public' or core.can_read_resource(e.resource_id)))
);
create policy measurements_read on core.measurements for select to authenticated using (
  exists (select 1 from core.observations o join core.evidence e on e.id = o.evidence_id where o.id = measurements.observation_id and (e.sensitivity = 'public' or core.can_read_resource(e.resource_id)))
);
create policy claims_read on core.claims for select to authenticated using (resource_id is null or core.can_read_resource(resource_id));
create policy claim_evidence_read on core.claim_evidence for select to authenticated using (
  exists (select 1 from core.claims c where c.id = claim_evidence.claim_id and (c.resource_id is null or core.can_read_resource(c.resource_id)))
);
create policy interpretations_read on core.interpretations for select to authenticated using (
  exists (select 1 from core.claims c where c.id = interpretations.claim_id and (c.resource_id is null or core.can_read_resource(c.resource_id)))
);
create policy hypotheses_read on core.hypotheses for select to authenticated using (created_by = core.current_identity_id());
create policy provenance_read on core.provenance_links for select to authenticated using (agent_identity_id = core.current_identity_id());

grant select on core.sources, core.evidence, core.observations, core.measurements, core.claims, core.claim_evidence, core.interpretations, core.hypotheses, core.provenance_links to authenticated;
