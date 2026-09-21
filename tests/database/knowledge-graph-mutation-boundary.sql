do $$
declare
  v_count integer;
  v_exec boolean;
begin
  select count(*) into v_count
    from information_schema.tables
   where table_schema='core' and table_name='knowledge_graph_relationship_requests';
  if v_count <> 1 then raise exception 'knowledge graph request table missing'; end if;

  select has_function_privilege(
    'authenticated',
    'core_private.consume_knowledge_graph_relationship_request(uuid)',
    'EXECUTE'
  ) into v_exec;
  if v_exec is not true then raise exception 'knowledge graph consume function must be executable by authenticated'; end if;

  if has_table_privilege('authenticated','core.entity_relationships','INSERT') then
    raise exception 'authenticated must not directly insert knowledge graph relationships';
  end if;
end $$;
