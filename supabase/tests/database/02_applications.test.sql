begin;
select plan(16);

insert into auth.users (id, email)
values
  ('11111111-1111-1111-1111-111111111111', 'a@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'b@example.com');

set local role anon;
select throws_ok($$ select * from public.applications $$, '42501', null, 'anon cannot read applications');
select throws_ok($$ select * from public.application_funnel $$, '42501', null, 'anon cannot read the stats views');
reset role;

-- User A applies to two jobs
set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

insert into public.applications (id, company, title, status)
values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Acme', 'Engineer', 'saved'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'Globex', 'Developer', 'applied');

select is(
  (select user_id from public.applications where id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  '11111111-1111-1111-1111-111111111111'::uuid,
  'user_id defaults to the signed-in user'
);
select ok(
  (select applied_at is null from public.applications where id = 'aaaaaaaa-0000-0000-0000-000000000001')
  and (select applied_at is not null from public.applications where id = 'aaaaaaaa-0000-0000-0000-000000000002'),
  'applied_at is set once the status moves past saved'
);

update public.applications set status = 'applied' where id = 'aaaaaaaa-0000-0000-0000-000000000001';
update public.applications set status = 'interview' where id = 'aaaaaaaa-0000-0000-0000-000000000001';
update public.applications set title = 'Senior Engineer' where id = 'aaaaaaaa-0000-0000-0000-000000000001';
update public.applications set status = 'rejected' where id = 'aaaaaaaa-0000-0000-0000-000000000002';

select results_eq(
  $$ select from_status::text, to_status::text from public.application_events
     where application_id = 'aaaaaaaa-0000-0000-0000-000000000001' order by id $$,
  $$ values (null, 'saved'), ('saved', 'applied'), ('applied', 'interview') $$,
  'the trigger records every status change and nothing else'
);

select throws_ok(
  $$ insert into public.application_events (application_id, user_id, to_status)
     values ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'offer') $$,
  '42501', null, 'users cannot write events themselves'
);
select throws_ok(
  $$ update public.application_events set to_status = 'offer' $$,
  '42501', null, 'users cannot rewrite history'
);
select throws_ok(
  $$ select public.log_application_status() $$,
  '42501', null, 'the trigger function cannot be called directly'
);

select results_eq(
  $$ select status::text, applications from public.application_funnel order by position $$,
  $$ values ('saved', 2), ('applied', 2), ('screening', 1), ('interview', 1), ('offer', 0), ('accepted', 0) $$,
  'the funnel counts applications that reached each stage, skipped stages included'
);
select results_eq(
  $$ select applications from public.applications_weekly $$,
  $$ values (2) $$,
  'weekly volume counts applied applications'
);
select results_eq(
  $$ select from_status::text, to_status::text, transitions from public.status_transitions
     order by 1, 2 $$,
  $$ values ('applied', 'interview', 1), ('applied', 'rejected', 1), ('saved', 'applied', 1) $$,
  'transitions count each from → to change'
);
select results_eq(
  $$ select applied, responded, response_rate from public.response_stats $$,
  $$ values (2, 2, 1.0::double precision) $$,
  'interviews and rejections count as responses'
);

-- User B sees none of it
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select is_empty($$ select 1 from public.applications $$, 'other users see no applications');
select is_empty($$ select 1 from public.application_events $$, 'other users see no history');
select results_eq(
  $$ select coalesce(sum(applications), 0)::integer from public.application_funnel $$,
  $$ values (0) $$,
  'stats views only count the caller''s rows'
);
select throws_ok(
  $$ insert into public.applications (user_id, company, title)
     values ('11111111-1111-1111-1111-111111111111', 'Evil', 'Spy') $$,
  '42501', null, 'a user cannot create an application for someone else'
);

select * from finish();
rollback;
