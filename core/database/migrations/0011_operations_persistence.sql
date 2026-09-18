-- ZENITH operations persistence: first PostgreSQL lifecycle store.
-- Shared execution infrastructure only; authorization authority remains core policy.
set lock_timeout = '5s';

create schema if not exists operations;

create table if not exists operations.operations (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references core.organisations(id) on delete restrict,
  identity_id uuid references core.identities(id) on delete set null,
  idempotency_key text not null,
  action text not null,
  resource_id uuid references core.resources(id) on delete set null,
  purpose text not null,
  state text not null default 'created',
  created_at timestamptz not null default now(),
  not_before timestamptz,
  expires_at timestamptz not null,
  attempt_count integer not null default 0,
  payload_ref text,
  content_hash text,
  classification text,
  epistemic_status text,
  provenance_ref uuid,
  lease_ref uuid,
  parent_operation_id uuid references operations.operations(id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint operations_idempotency_key_check check (btrim(idempotency_key) <> ''),
  constraint operations_action_check check (btrim(action) <> ''),
  constraint operations_purpose_check check (btrim(purpose) <> ''),
  constraint operations_state_check check (state in (
    'created','authorized','queued','in_flight','acknowledged','retry_wait',
    'blocked','conflict','expired','rejected','completed','cancelled'
  )),
  constraint operations_attempt_count_check check (attempt_count >= 0),
  constraint operations_expiry_check check (expires_at > created_at),
  constraint operations_payload_minimal_check check (
    payload_ref is null or length(payload_ref) <= 2048
  ),
  constraint operations_content_hash_check check (
    content_hash is null or length(content_hash) <= 256
  )
);

create unique index if not exists operations_org_idempotency_key_uq
  on operations.operations(organisation_id, idempotency_key);

create index if not exists operations_org_state_idx
  on operations.operations(organisation_id, state, expires_at);

create index if not exists operations_resource_idx
  on operations.operations(resource_id);

create index if not exists operations_lease_idx
  on operations.operations(lease_ref);

alter table operations.operations enable row level security;
alter table operations.operations force row level security;

drop policy if exists operations_tenant_select on operations.operations;
drop policy if exists operations_tenant_insert on operations.operations;
drop policy if exists operations_tenant_update on operations.operations;

create policy operations_tenant_select
  on operations.operations for select to authenticated
  using (
    organisation_id = core.current_organisation_id()
  );

create policy operations_tenant_insert
  on operations.operations for insert to authenticated
  with check (
    organisation_id = core.current_organisation_id()
    and (identity_id is null or identity_id = core.current_identity_id())
  );

create policy operations_tenant_update
  on operations.operations for update to authenticated
  using (
    organisation_id = core.current_organisation_id()
  )
  with check (
    organisation_id = core.current_organisation_id()
    and (identity_id is null or identity_id = core.current_identity_id())
  );

grant select, insert, update on operations.operations to authenticated;

create or replace function operations.transition(
  p_operation_id uuid,
  p_expected_state text,
  p_next_state text
)
returns operations.operations
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_row operations.operations;
begin
  if p_expected_state is null or p_next_state is null then
    raise exception 'invalid_operation_transition:missing_state';
  end if;

  if p_next_state = 'expired' then
    -- Expiry is authoritative: only an already-due operation may enter expired.
    if now() < (select o.expires_at from operations.operations o where o.id = p_operation_id) then
      raise exception 'operation_not_expired';
    end if;
  elsif exists (
    select 1 from operations.operations o
    where o.id = p_operation_id
      and o.expires_at <= now()
      and o.state <> 'expired'
  ) then
    raise exception 'operation_expired';
  end if;

  if not (
    (p_expected_state='created' and p_next_state in ('authorized','rejected','cancelled')) or
    (p_expected_state='authorized' and p_next_state in ('queued','rejected','cancelled','expired')) or
    (p_expected_state='queued' and p_next_state in ('in_flight','cancelled','expired','blocked')) or
    (p_expected_state='in_flight' and p_next_state in ('acknowledged','retry_wait','conflict','blocked','expired','rejected')) or
    (p_expected_state='acknowledged' and p_next_state='completed') or
    (p_expected_state='retry_wait' and p_next_state in ('queued','expired','blocked','cancelled')) or
    (p_expected_state='blocked' and p_next_state in ('queued','cancelled','expired','rejected')) or
    (p_expected_state='conflict' and p_next_state in ('queued','cancelled','rejected'))
  ) then
    raise exception 'invalid_operation_transition:%->%', p_expected_state, p_next_state;
  end if;

  update operations.operations
     set state = p_next_state,
         attempt_count = case when p_next_state = 'in_flight' then attempt_count + 1 else attempt_count end,
         updated_at = now()
   where id = p_operation_id
     and organisation_id = core.current_organisation_id()
     and state = p_expected_state
     and (
       p_next_state = 'expired'
       or expires_at > now()
     )
  returning * into v_row;

  if v_row.id is null then
    raise exception 'operation_transition_conflict';
  end if;

  return v_row;
end;
$$;

revoke execute on function operations.transition(uuid,text,text) from public;
grant execute on function operations.transition(uuid,text,text) to authenticated;

comment on schema operations is 'Shared execution infrastructure. Not an authorization authority.';
comment on table operations.operations is 'Minimal tenant-scoped operation lifecycle state. Protected payloads remain in domain evidence/storage systems.';
comment on column operations.operations.idempotency_key is 'Client/provider key. Uniqueness is enforced atomically per organisation.';
comment on column operations.operations.expires_at is 'Authoritative execution deadline; stale operations cannot transition into non-terminal execution states.';
