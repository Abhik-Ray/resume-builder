-- Nothing in public is readable, writable or callable without a signed-in user.
-- Supabase grants anon (and PUBLIC, for functions) access by default; take it away for
-- everything that exists now and everything later migrations create.
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke all on all functions in schema public from anon, public;
alter default privileges for role postgres in schema public revoke all on tables from anon;
alter default privileges for role postgres in schema public revoke all on sequences from anon;
alter default privileges for role postgres in schema public revoke all on functions from anon;
-- PUBLIC's default execute grant can only be revoked globally, not per schema
alter default privileges for role postgres revoke execute on functions from public;

-- Keeps updated_at current on every update
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- One row per user, created by the web app on first sign-in
create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  -- ResumeDataType; null until the user saves their own
  resume_data jsonb,
  home_city text,
  home_region text,
  -- ISO 3166-1 alpha-2, e.g. IN
  home_country text check (home_country ~ '^[A-Z]{2}$'),
  search_radius_km integer not null default 50 check (search_radius_km between 1 and 500),
  include_remote boolean not null default true,
  -- Set when the Details page is saved with every required field
  details_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;

revoke all on public.profiles from anon;
grant select, insert, update, delete on public.profiles to authenticated;

create policy "Users read their own profile"
on public.profiles for select to authenticated
using ((select auth.uid()) = user_id);

create policy "Users create their own profile"
on public.profiles for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users update their own profile"
on public.profiles for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users delete their own profile"
on public.profiles for delete to authenticated
using ((select auth.uid()) = user_id);
