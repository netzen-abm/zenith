do $$
declare
  expected text[] := array['research_questions','research_projects','research_project_questions','datasets','research_project_datasets','methods','research_project_methods','research_runs','research_outputs'];
  t text;
  n int;
begin
  foreach t in array expected loop
    if to_regclass('core.'||t) is null then raise exception 'missing research table: %',t; end if;
  end loop;
  select count(*) into n from pg_class c join pg_namespace s on s.oid=c.relnamespace where s.nspname='core' and c.relname=any(expected) and c.relrowsecurity;
  if n <> 9 then raise exception 'research RLS count mismatch: %',n; end if;
  select count(*) into n from pg_policy p join pg_class c on c.oid=p.polrelid join pg_namespace s on s.oid=c.relnamespace where s.nspname='core' and c.relname=any(expected);
  if n <> 9 then raise exception 'research policy count mismatch: %',n; end if;
  select count(*) into n from pg_constraint c where c.connamespace='core'::regnamespace and c.conrelid in (select oid from pg_class where relnamespace='core'::regnamespace and relname=any(expected));
  if n < 33 then raise exception 'research constraint count unexpectedly low: %',n; end if;
  select count(*) into n from pg_indexes where schemaname='core' and tablename=any(expected) and indexname not like '%_pkey';
  if n < 10 then raise exception 'research supporting index count unexpectedly low: %',n; end if;
  if not exists (select 1 from pg_views where schemaname='core' and viewname='public_research_questions') then raise exception 'missing public research questions view'; end if;
  if not exists (select 1 from pg_views where schemaname='core' and viewname='public_research_questions' and definition like '%status = ANY%') then raise exception 'public research question status projection missing'; end if;
end $$;
select 'research-assertions: PASS' as result;
