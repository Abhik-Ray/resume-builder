-- Declaration order matters: the funnel compares statuses with < and >, so the forward path
-- (saved → accepted) comes first and the exits after it. Mirrored in packages/shared.
create type public.application_status as enum (
  'saved',
  'applied',
  'screening',
  'interview',
  'offer',
  'accepted',
  'rejected',
  'withdrawn',
  'ghosted'
);

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- The matched posting, once the job sync exists (foreign key added with the jobs table)
  job_id uuid,
  company text not null check (length(trim(company)) > 0),
  title text not null check (length(trim(title)) > 0),
  url text,
  jd_text text,
  -- The exact resume sent (ResumeSnapshot), so the PDF can be rebuilt
  resume_snapshot jsonb,
  status public.application_status not null default 'saved',
  -- Set the first time the status reaches applied (or later)
  applied_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index applications_user_id_idx on public.applications (user_id, created_at desc);

create trigger applications_set_updated_at
before update on public.applications
for each row execute function public.set_updated_at();

-- Every status change, written only by the trigger below; the source for the charts
create table public.application_events (
  id bigint generated always as identity primary key,
  application_id uuid not null references public.applications (id) on delete cascade,
  -- Copied from the application so RLS and the stats views don't need a join
  user_id uuid not null references auth.users (id) on delete cascade,
  from_status public.application_status,
  to_status public.application_status not null,
  at timestamptz not null default now(),
  note text
);

create index application_events_application_id_idx on public.application_events (application_id, at);
create index application_events_user_id_idx on public.application_events (user_id, at);

-- applied_at follows the first move past "saved"
create function public.set_applied_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.applied_at is null and new.status <> 'saved' then
    new.applied_at = now();
  end if;
  return new;
end;
$$;

create trigger applications_set_applied_at
before insert or update of status on public.applications
for each row execute function public.set_applied_at();

-- Records the status history. security definer because users can't insert events
-- themselves; the only security definer function in the schema.
create function public.log_application_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into public.application_events (application_id, user_id, from_status, to_status)
    values (new.id, new.user_id, case when tg_op = 'UPDATE' then old.status end, new.status);
  end if;
  return null;
end;
$$;

-- Trigger functions run without EXECUTE; nobody should be able to call it directly
revoke all on function public.log_application_status() from public, anon, authenticated;

create trigger applications_log_status
after insert or update of status on public.applications
for each row execute function public.log_application_status();

alter table public.applications enable row level security;
alter table public.application_events enable row level security;

revoke all on public.applications, public.application_events from anon;
grant select, insert, update, delete on public.applications to authenticated;
revoke all on public.application_events from authenticated;
grant select on public.application_events to authenticated;

create policy "Users read their own applications"
on public.applications for select to authenticated
using ((select auth.uid()) = user_id);

create policy "Users create their own applications"
on public.applications for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users update their own applications"
on public.applications for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users delete their own applications"
on public.applications for delete to authenticated
using ((select auth.uid()) = user_id);

create policy "Users read the history of their own applications"
on public.application_events for select to authenticated
using ((select auth.uid()) = user_id);

-- Stats views. security_invoker makes them run as the caller, so RLS limits them to the
-- caller's rows; without it a view runs as its owner and would return every user's rows.

-- Applications that reached each stage of the forward path (funnel). Reaching a later stage
-- counts as passing the earlier ones, even when a status was skipped.
create view public.application_funnel
with (security_invoker = true)
as
with furthest as (
  select application_id, max(to_status) as status
  from public.application_events
  where to_status <= 'accepted'
  group by application_id
)
select stage.status, stage.position::integer as position, count(furthest.application_id)::integer as applications
from unnest(enum_range('saved'::public.application_status, 'accepted'::public.application_status))
  with ordinality as stage (status, position)
left join furthest on furthest.status >= stage.status
group by stage.status, stage.position
order by stage.position;

-- Applications per ISO week (bars)
create view public.applications_weekly
with (security_invoker = true)
as
select date_trunc('week', applied_at)::date as week, count(*)::integer as applications
from public.applications
where applied_at is not null
group by 1
order by 1;

-- Count of each from → to change (stage flow)
create view public.status_transitions
with (security_invoker = true)
as
select from_status, to_status, count(*)::integer as transitions
from public.application_events
where from_status is not null
group by from_status, to_status
order by transitions desc, from_status, to_status;

-- Response rate and median days from applied to first response (stat tiles). A response is
-- the first move to screening or later, or a rejection.
create view public.response_stats
with (security_invoker = true)
as
with first_response as (
  select application_id, min(at) as at
  from public.application_events
  where to_status in ('screening', 'interview', 'offer', 'accepted', 'rejected')
  group by application_id
)
select
  count(*)::integer as applied,
  count(first_response.at)::integer as responded,
  round(count(first_response.at)::numeric / nullif(count(*), 0), 3)::double precision as response_rate,
  round(
    (percentile_cont(0.5) within group (
      order by extract(epoch from first_response.at - applications.applied_at) / 86400
    ))::numeric,
    1
  )::double precision as median_days_to_response
from public.applications
left join first_response on first_response.application_id = applications.id
where applications.applied_at is not null;

revoke all on public.application_funnel, public.applications_weekly, public.status_transitions,
  public.response_stats from anon;
grant select on public.application_funnel, public.applications_weekly, public.status_transitions,
  public.response_stats to authenticated;
