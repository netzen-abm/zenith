-- Read-only, tenant-scoped receipt lookup for ambiguous Space-Time outcomes.
-- Authenticated roles deliberately have no direct SELECT on the request table.
set lock_timeout = '5s';

create or replace function core_private.get_space_time_consumed_receipt(p_request_id uuid)
returns table (representation_id uuid)
language sql
stable
security definer
set search_path = ''
as $receipt$
  select r.representation_id
    from core.space_time_representation_requests r
   where r.id = p_request_id
     and r.organisation_id = core.current_organisation_id()
     and r.identity_id = core.current_identity_id()
     and r.status = 'consumed'
     and r.representation_id is not null
$receipt$;

revoke all on function core_private.get_space_time_consumed_receipt(uuid) from public, anon;
grant execute on function core_private.get_space_time_consumed_receipt(uuid) to authenticated;

comment on function core_private.get_space_time_consumed_receipt(uuid) is
  'Read-only receipt recovery for the current authenticated tenant and identity; does not expose direct request-table SELECT or perform a mutation.';
