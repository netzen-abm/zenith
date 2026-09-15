-- ZENITH canonical capability authorization / policy decision boundary.
-- Runtime deployment must apply the equivalent migration through the managed
-- Supabase migration workflow; this file is the repository source of truth.

create or replace function core.authorize_capability(
  p_action text,
  p_resource_id uuid default null,
  p_purpose text default null
)
returns table (
  allowed boolean,
  decision text,
  identity_id uuid,
  organisation_id uuid,
  resource_id uuid,
  action text,
  purpose text
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_identity uuid := core.current_identity_id();
  v_org uuid := core.current_organisation_id();
  v_allowed boolean := false;
  v_decision text := 'deny';
begin
  if p_action is null or btrim(p_action) = '' then
    return query select false, 'invalid_action', v_identity, v_org, p_resource_id, p_action, p_purpose;
    return;
  end if;

  if p_action in ('read','discover','search','explore') then
    if p_resource_id is null then
      v_allowed := v_identity is not null;
    else
      v_allowed := core.can_read_resource(p_resource_id);
    end if;
  elsif p_action in ('write','create','update','annotate','research_write') then
    v_allowed := p_resource_id is not null and core.can_write_resource(p_resource_id);
  else
    v_allowed := false;
  end if;

  if v_allowed then
    v_decision := 'allow';
  elsif v_identity is null then
    v_decision := 'deny_unauthenticated';
  else
    v_decision := 'deny_policy';
  end if;

  return query select v_allowed, v_decision, v_identity, v_org, p_resource_id, p_action, p_purpose;
end;
$$;

revoke execute on function core.authorize_capability(text, uuid, text) from public;
grant execute on function core.authorize_capability(text, uuid, text) to authenticated;
