do $$
declare v_count integer; v_exec boolean;
begin
  select count(*) into v_count from information_schema.tables
   where table_schema='core' and table_name='space_time_representation_requests';
  if v_count <> 1 then raise exception 'space-time request table missing'; end if;

  select has_function_privilege(
    'authenticated',
    'core_private.consume_space_time_representation_request(uuid)',
    'EXECUTE'
  ) into v_exec;
  if v_exec is not true then raise exception 'space-time consume function privilege mismatch'; end if;

  if has_table_privilege('authenticated','core.spatial_representations','INSERT') then
    raise exception 'authenticated must not directly insert spatial representations';
  end if;
end $$;
