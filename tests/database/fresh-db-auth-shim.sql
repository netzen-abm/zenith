-- Minimal Supabase Auth compatibility shim for disposable migration testing only.
-- This is not a replacement for Supabase Auth integration tests.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated noinherit;
  end if;
end $$;

create schema if not exists auth;
revoke all on schema auth from public;

create table if not exists auth.users (
  id uuid primary key
);

create or replace function auth.uid()
returns uuid
language sql
stable
set search_path = ''
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

revoke all on table auth.users from public;
revoke execute on function auth.uid() from public;
