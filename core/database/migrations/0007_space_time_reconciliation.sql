-- ZENITH Core space/time reconciliation: spatial and temporal contract.
set lock_timeout = '5s';

-- Existing live tables are data-bearing. Never silently accept an incompatible legacy shape.
DO $$
DECLARE t text; required text[]; col text;
BEGIN
  FOREACH t IN ARRAY ARRAY['spatial_representations','resource_spatial_relations','time_spans','resource_time_spans'] LOOP
    IF to_regclass('core.' || t) IS NOT NULL THEN
      required := CASE t
        WHEN 'spatial_representations' THEN ARRAY['id','resource_id','representation_type','geom','precision_level','coordinate_confidence','source_evidence_id','created_at']
        WHEN 'resource_spatial_relations' THEN ARRAY['subject_resource_id','object_resource_id','relation_type','evidence_id','epistemic_status','confidence']
        WHEN 'time_spans' THEN ARRAY['id','organisation_id','label','start_at','end_at','start_precision','end_precision','chronology_system','uncertainty','created_at']
        ELSE ARRAY['resource_id','time_span_id','relation_type','evidence_id','epistemic_status','confidence']
      END;
      FOREACH col IN ARRAY required LOOP
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='core' AND table_name=t AND column_name=col) THEN
          RAISE EXCEPTION 'space/time reconciliation refused: existing core.% is missing required column %', t, col;
        END IF;
      END LOOP;
    END IF;
  END LOOP;
END $$;

drop policy if exists spatial_representations_read on core.spatial_representations;
drop policy if exists resource_spatial_relations_read on core.resource_spatial_relations;
drop policy if exists time_spans_read on core.time_spans;
drop policy if exists resource_time_spans_read on core.resource_time_spans;

create table if not exists core.spatial_representations (
  id uuid primary key default gen_random_uuid(), resource_id uuid not null, representation_type text not null,
  geom geometry(Geometry,4326), precision_level text not null, coordinate_confidence numeric, source_evidence_id uuid,
  created_at timestamptz not null default now(),
  constraint spatial_representations_resource_id_fkey foreign key (resource_id) references core.resources(id) on delete cascade,
  constraint spatial_representations_source_evidence_id_fkey foreign key (source_evidence_id) references core.evidence(id) on delete set null,
  constraint spatial_representations_precision_level_check check (precision_level = any (array['exact','generalized','regional','unknown'])),
  constraint spatial_representations_coordinate_confidence_check check (coordinate_confidence is null or (coordinate_confidence >= 0 and coordinate_confidence <= 1))
);

create table if not exists core.resource_spatial_relations (
  subject_resource_id uuid not null, object_resource_id uuid not null, relation_type text not null, evidence_id uuid,
  epistemic_status text not null, confidence numeric,
  primary key (subject_resource_id, object_resource_id, relation_type),
  constraint resource_spatial_relations_subject_fkey foreign key (subject_resource_id) references core.resources(id) on delete cascade,
  constraint resource_spatial_relations_object_fkey foreign key (object_resource_id) references core.resources(id) on delete cascade,
  constraint resource_spatial_relations_evidence_fkey foreign key (evidence_id) references core.evidence(id) on delete set null,
  constraint resource_spatial_relations_distinct_check check (subject_resource_id <> object_resource_id),
  constraint resource_spatial_relations_confidence_check check (confidence is null or (confidence >= 0 and confidence <= 1)),
  constraint resource_spatial_relations_epistemic_status_check check (epistemic_status = any (array['observed','documented','derived','interpreted','hypothesized','traditional_oral','contested_disputed','unknown']))
);

create table if not exists core.time_spans (
  id uuid primary key default gen_random_uuid(), organisation_id uuid not null, label text not null,
  start_at timestamptz, end_at timestamptz, start_precision text not null, end_precision text not null,
  chronology_system text, uncertainty jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(),
  constraint time_spans_organisation_fkey foreign key (organisation_id) references core.organisations(id) on delete restrict,
  constraint time_spans_order_check check (end_at is null or start_at is null or end_at >= start_at)
);

create table if not exists core.resource_time_spans (
  resource_id uuid not null, time_span_id uuid not null, relation_type text not null, evidence_id uuid,
  epistemic_status text not null, confidence numeric,
  primary key (resource_id, time_span_id, relation_type),
  constraint resource_time_spans_resource_fkey foreign key (resource_id) references core.resources(id) on delete cascade,
  constraint resource_time_spans_time_span_fkey foreign key (time_span_id) references core.time_spans(id) on delete cascade,
  constraint resource_time_spans_evidence_fkey foreign key (evidence_id) references core.evidence(id) on delete set null,
  constraint resource_time_spans_confidence_check check (confidence is null or (confidence >= 0 and confidence <= 1)),
  constraint resource_time_spans_epistemic_status_check check (epistemic_status = any (array['observed','documented','derived','interpreted','hypothesized','traditional_oral','contested_disputed','unknown']))
);

create index if not exists spatial_representations_resource_idx on core.spatial_representations(resource_id);
create index if not exists spatial_representations_geom_idx on core.spatial_representations using gist(geom);
create index if not exists spatial_representations_evidence_idx on core.spatial_representations(source_evidence_id);
create index if not exists resource_spatial_relations_object_idx on core.resource_spatial_relations(object_resource_id);
create index if not exists resource_spatial_relations_evidence_idx on core.resource_spatial_relations(evidence_id);
create index if not exists time_spans_org_idx on core.time_spans(organisation_id);
create index if not exists resource_time_spans_time_idx on core.resource_time_spans(time_span_id);
create index if not exists resource_time_spans_evidence_idx on core.resource_time_spans(evidence_id);

alter table core.spatial_representations enable row level security;
alter table core.resource_spatial_relations enable row level security;
alter table core.time_spans enable row level security;
alter table core.resource_time_spans enable row level security;

create policy spatial_representations_read on core.spatial_representations for select to authenticated using (core.can_read_resource(resource_id));
create policy resource_spatial_relations_read on core.resource_spatial_relations for select to authenticated using (core.can_read_resource(subject_resource_id) and core.can_read_resource(object_resource_id));
create policy time_spans_read on core.time_spans for select to authenticated using (exists (select 1 from core.resources r where r.organisation_id = time_spans.organisation_id and core.can_read_resource(r.id)));
create policy resource_time_spans_read on core.resource_time_spans for select to authenticated using (core.can_read_resource(resource_id));

grant select on core.spatial_representations, core.resource_spatial_relations, core.time_spans, core.resource_time_spans to authenticated;

create or replace view core.public_spatial_representations with (security_invoker = true) as
select sr.id, sr.resource_id, sr.representation_type,
       case when r.sensitivity = 'public' and sr.precision_level in ('generalized','regional','unknown') then sr.geom else null::geometry end as geom,
       case when r.sensitivity = 'public' then sr.precision_level else 'unknown' end as precision_level,
       case when r.sensitivity = 'public' then sr.coordinate_confidence else null::numeric end as coordinate_confidence
from core.spatial_representations sr join core.resources r on r.id = sr.resource_id
where r.sensitivity = 'public';

create or replace view core.public_resource_spatial_relations with (security_invoker = true) as
select rsr.subject_resource_id, rsr.object_resource_id, rsr.relation_type, rsr.epistemic_status, rsr.confidence
from core.resource_spatial_relations rsr
join core.resources s on s.id = rsr.subject_resource_id join core.resources o on o.id = rsr.object_resource_id
where s.sensitivity = 'public' and o.sensitivity = 'public';

create or replace view core.public_resource_time_spans with (security_invoker = true) as
select rts.resource_id, rts.time_span_id, rts.relation_type, rts.epistemic_status, rts.confidence
from core.resource_time_spans rts join core.resources r on r.id = rts.resource_id
where r.sensitivity = 'public';

grant select on core.public_spatial_representations, core.public_resource_spatial_relations, core.public_resource_time_spans to anon, authenticated;
comment on view core.public_spatial_representations is 'Public-safe spatial projection. Exact geometry is excluded unless precision is generalized, regional, or unknown.';
comment on view core.public_resource_spatial_relations is 'Public-safe spatial relationship projection limited to public resources.';
comment on view core.public_resource_time_spans is 'Public-safe resource/time projection limited to public resources.';
