begin;
select plan(16);

insert into auth.users (id, email)
values
  ('11111111-1111-1111-1111-111111111111', 'a@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'b@example.com');

-- The job sync (service role) writes jobs, matches and runs
insert into public.jobs (id, source, external_id, company, title, url)
values ('bbbbbbbb-0000-0000-0000-000000000001', 'adzuna', 'ad-1', 'Acme', 'React Developer', 'https://example.com/1');
insert into public.job_matches (user_id, job_id, keyword_score)
values
  ('11111111-1111-1111-1111-111111111111', 'bbbbbbbb-0000-0000-0000-000000000001', 3),
  ('22222222-2222-2222-2222-222222222222', 'bbbbbbbb-0000-0000-0000-000000000001', 4);
insert into public.sync_runs (finished_at, jobs_seen, jobs_new, matches_new) values (now(), 1, 1, 2);

select throws_ok(
  $$ insert into public.jobs (source, external_id, company, title, url) values ('adzuna', 'ad-1', 'X', 'Y', 'Z') $$,
  '23505', null, 'a posting is stored once per source'
);

set local role anon;
select throws_ok($$ select * from public.jobs $$, '42501', null, 'anon cannot read jobs');
select throws_ok($$ select * from public.search_profiles $$, '42501', null, 'anon cannot read searches');
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

select results_eq($$ select count(*)::integer from public.jobs $$, $$ values (1) $$, 'signed-in users read jobs');
select results_eq($$ select count(*)::integer from public.sync_runs $$, $$ values (1) $$, 'signed-in users read sync runs');
select throws_ok(
  $$ insert into public.jobs (source, external_id, company, title, url) values ('adzuna', 'ad-2', 'X', 'Y', 'Z') $$,
  '42501', null, 'users cannot write jobs'
);
select throws_ok($$ update public.jobs set title = 'Hacked' $$, '42501', null, 'users cannot change jobs');
select throws_ok(
  $$ insert into public.job_matches (user_id, job_id, keyword_score)
     values ('11111111-1111-1111-1111-111111111111', 'bbbbbbbb-0000-0000-0000-000000000001', 99) $$,
  '42501', null, 'users cannot create matches'
);
select results_eq(
  $$ select keyword_score from public.job_matches $$,
  $$ values (3) $$,
  'users see only their own matches'
);

update public.job_matches set state = 'dismissed', verdict = '{"verdict": "Hard Pass"}';
select throws_ok(
  $$ update public.job_matches set keyword_score = 100 $$,
  '42501', null, 'users can change only the verdict and state of a match'
);

insert into public.search_profiles (name, keywords) values ('React', array['react']);
select throws_ok(
  $$ insert into public.search_profiles (name, keywords) values ('Empty', '{}') $$,
  '23514', null, 'a search needs at least one keyword'
);

-- User B can't touch user A's match or search
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
update public.job_matches set state = 'applied' where user_id = '11111111-1111-1111-1111-111111111111';
select is_empty($$ select 1 from public.search_profiles $$, 'other users see no searches');
select results_eq(
  $$ select new_matches, judged, dismissed from public.match_stats $$,
  $$ values (1, 0, 0) $$,
  'match stats count only the caller''s matches'
);
reset role;

select results_eq(
  $$ select state::text, verdict ->> 'verdict' from public.job_matches
     where user_id = '11111111-1111-1111-1111-111111111111' $$,
  $$ values ('dismissed', 'Hard Pass') $$,
  'users triage and judge their own matches, and nobody else''s'
);

set local role service_role;
select lives_ok(
  $$ insert into public.jobs (source, external_id, company, title, url)
       values ('jooble', 'jb-1', 'Globex', 'Engineer', 'https://example.com/2');
     insert into public.job_matches (user_id, job_id, keyword_score)
       select '22222222-2222-2222-2222-222222222222', id, 3 from public.jobs where external_id = 'jb-1';
     insert into public.sync_runs default values $$,
  'the job sync (service role) writes jobs, matches and runs'
);
reset role;

delete from public.jobs;
select is_empty($$ select 1 from public.job_matches $$, 'deleting a job removes its matches');

select * from finish();
rollback;
