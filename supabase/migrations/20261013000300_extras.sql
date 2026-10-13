-- Closed-job detection: set when no working source has listed the posting for a while,
-- cleared when it shows up again. Descriptions of long-closed jobs are pruned to save space.
alter table public.jobs add column closed_at timestamptz;
create index jobs_closed_at_idx on public.jobs (closed_at) where closed_at is not null;

alter table public.sync_runs add column jobs_closed integer not null default 0;

-- Company watch list: public Greenhouse and Lever job boards a user follows
create table public.watched_companies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  provider text not null check (provider in ('greenhouse', 'lever')),
  -- The board token in the board's URL, e.g. boards.greenhouse.io/<board>, jobs.lever.co/<board>
  board text not null check (board ~ '^[a-z0-9][a-z0-9-]{0,99}$'),
  name text not null check (length(trim(name)) > 0),
  created_at timestamptz not null default now(),
  unique (user_id, provider, board)
);

alter table public.jobs drop constraint jobs_source_check;
alter table public.jobs
  add constraint jobs_source_check check (source in ('adzuna', 'jooble', 'jsearch', 'greenhouse', 'lever'));

alter table public.watched_companies enable row level security;
revoke all on public.watched_companies from anon;
grant select, insert, delete on public.watched_companies to authenticated;

create policy "Users read their own watched companies"
on public.watched_companies for select to authenticated
using ((select auth.uid()) = user_id);

create policy "Users watch companies for themselves"
on public.watched_companies for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users stop watching their own companies"
on public.watched_companies for delete to authenticated
using ((select auth.uid()) = user_id);
