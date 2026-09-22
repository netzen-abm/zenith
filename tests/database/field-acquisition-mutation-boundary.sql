do $$
declare v_count integer; v_exec boolean;
begin
  select count(*) into v_count from information_schema.tables
   where table_schema='core' and table_name='field_observation_requests';
  if v_count <> 1 then raise exception 'field request table missing'; end if;

  select has_function_privilege(
    'authenticated',
    'core_private.consume_field_observation_request(uuid)',
    'EXECUTE'
  ) into v_exec;
  if v_exec is not true then raise exception 'field consume function privilege mismatch'; end if;

  if has_table_privilege('authenticated','core.observations','INSERT') then
    raise exception 'authenticated must not directly insert observations';
  end if;
end $$;
