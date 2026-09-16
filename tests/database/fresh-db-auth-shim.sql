-- Minimal Supabase Auth compatibility shim for disposable migration testing only.
-- This is not a replacement for Supabase Auth integration tests.

create role anon noinherit;
create role authenticated noinherit;

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
