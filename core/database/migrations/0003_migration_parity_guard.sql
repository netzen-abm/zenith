-- ZENITH migration parity guard.
-- This migration records the minimum verified Core contract required before a
-- fresh environment may be considered reproducible. It intentionally does not
-- weaken or replace the live security model.

create schema if not exists core;

create table if not exists core.migration_parity_contract (
  contract_id text primary key,
  contract_version text not null,
  status text not null,
  verification_scope jsonb not null,
  created_at timestamptz not null default now(),
  check (status in ('required','verified'))
);

insert into core.migration_parity_contract (
  contract_id, contract_version, status, verification_scope
) values (
  'past-intelligence-core',
  '2026-09-15',
  'required',
  jsonb_build_object(
    'live_migration_generations', 14,
    'repository_migration_generations_before_guard', 2,
    'required_domains', jsonb_build_array(
      'security',
      'public_data_surface',
      'postgis',
      'evidence_provenance',
      'knowledge_graph',
      'space_time',
      'research_workflow',
      'authorization',
      'capability_policy'
    ),
    'requirement', 'Fresh non-production environments must be provisionable from repository migrations with equivalent effective schema and security behavior.'
  )
)
on conflict (contract_id) do update
set contract_version = excluded.contract_version,
    status = excluded.status,
    verification_scope = excluded.verification_scope;

comment on table core.migration_parity_contract is
  'Governance marker for repository/live Core migration convergence. A required status means parity is not yet proven.';
