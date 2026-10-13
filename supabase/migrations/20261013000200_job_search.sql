-- Saved searches. Location defaults to the profile's home location; no company list.
create table public.search_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  keywords text[] not null check (cardinality(keywords) > 0),
  exclude_keywords text[] not null default '{}',
  -- A city other than home, in the home country
  location_override text,
  remote_only boolean not null default false,
  -- Matches need at least this keyword score (3 per keyword in the title, 1 in the description)
  min_score integer not null default 3 check (min_score between 1 and 100),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index search_profiles_user_id_idx on public.search_profiles (user_id);

create trigger search_profiles_set_updated_at
before update on public.search_profiles
for each row execute function public.set_updated_at();

-- Every posting the job sync has seen, shared by all users and written only by the sync
create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source in ('adzuna', 'jooble', 'jsearch')),
  external_id text not null,
  company text not null,
  title text not null,
  location text,
  remote boolean not null default false,
  url text not null,
  description text,
  posted_at timestamptz,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (source, external_id)
);

create index jobs_last_seen_at_idx on public.jobs (last_seen_at);

create type public.match_state as enum ('new', 'saved', 'dismissed', 'applied');

-- A job matched to a user by one of their searches
create table public.job_matches (
  user_id uuid not null references auth.users (id) on delete cascade,
  job_id uuid not null references public.jobs (id) on delete cascade,
  search_profile_id uuid references public.search_profiles (id) on delete set null,
  keyword_score integer not null,
  -- JudgeResponseType, filled in by judging in the browser
  verdict jsonb,
  state public.match_state not null default 'new',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, job_id)
);

create index job_matches_user_state_idx on public.job_matches (user_id, state, created_at desc);

create trigger job_matches_set_updated_at
before update on public.job_matches
for each row execute function public.set_updated_at();

-- One row per job sync run, shown as "Last updated 06:02, 14 new matches"
create table public.sync_runs (
  id bigint generated always as identity primary key,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  jobs_seen integer not null default 0,
  jobs_new integer not null default 0,
  matches_new integer not null default 0,
  -- [{ source, query, message }]
  errors jsonb not null default '[]'
);

-- Applications made from a match point at its job
alter table public.applications
  add constraint applications_job_id_fkey
  foreign key (job_id) references public.jobs (id) on delete set null;

alter table public.search_profiles enable row level security;
alter table public.jobs enable row level security;
alter table public.job_matches enable row level security;
alter table public.sync_runs enable row level security;

revoke all on public.search_profiles, public.jobs, public.job_matches, public.sync_runs from anon;
revoke all on public.jobs, public.job_matches, public.sync_runs from authenticated;
revoke all on sequence public.sync_runs_id_seq from anon, authenticated;

grant select, insert, update, delete on public.search_profiles to authenticated;
-- Writes to jobs, matches and runs come from the job sync (service role, which bypasses RLS)
grant select on public.jobs, public.sync_runs to authenticated;
grant select on public.job_matches to authenticated;
-- Users only judge and triage their matches
grant update (verdict, state) on public.job_matches to authenticated;

create policy "Users read their own searches"
on public.search_profiles for select to authenticated
using ((select auth.uid()) = user_id);

create policy "Users create their own searches"
on public.search_profiles for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users update their own searches"
on public.search_profiles for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users delete their own searches"
on public.search_profiles for delete to authenticated
using ((select auth.uid()) = user_id);

create policy "Signed-in users read jobs"
on public.jobs for select to authenticated
using (true);

create policy "Signed-in users read sync runs"
on public.sync_runs for select to authenticated
using (true);

create policy "Users read their own matches"
on public.job_matches for select to authenticated
using ((select auth.uid()) = user_id);

create policy "Users update their own matches"
on public.job_matches for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

-- New, judged and dismissed matches per day (line)
create view public.match_stats
with (security_invoker = true)
as
select
  (created_at at time zone 'utc')::date as day,
  count(*)::integer as new_matches,
  count(verdict)::integer as judged,
  count(*) filter (where state = 'dismissed')::integer as dismissed
from public.job_matches
group by 1
order by 1;

revoke all on public.match_stats from anon;
grant select on public.match_stats to authenticated;
