-- Restore the canonical RLS execution path without exposing authorization helpers as RPCs.
-- SECURITY DEFINER helpers are intentionally callable by authenticated RLS evaluation,
-- but remain inaccessible to anon and therefore are not a client authorization API.
revoke execute on function core.current_identity_id() from public;
revoke execute on function core.current_organisation_id() from public;
revoke execute on function core.can_read_resource(uuid) from public;
revoke execute on function core.can_write_resource(uuid) from public;

grant execute on function core.current_identity_id() to authenticated;
grant execute on function core.current_organisation_id() to authenticated;
grant execute on function core.can_read_resource(uuid) to authenticated;
grant execute on function core.can_write_resource(uuid) to authenticated;
