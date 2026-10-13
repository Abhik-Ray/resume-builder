begin;
select plan(7);

insert into auth.users (id, email)
values
  ('11111111-1111-1111-1111-111111111111', 'a@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'b@example.com');

set local role anon;
select throws_ok($$ select * from public.watched_companies $$, '42501', null, 'anon cannot read watched companies');
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select lives_ok(
  $$ insert into public.watched_companies (provider, board, name) values ('greenhouse', 'acme', 'Acme') $$,
  'a user watches a company board'
);
select throws_ok(
  $$ insert into public.watched_companies (provider, board, name) values ('greenhouse', 'acme', 'Acme again') $$,
  '23505', null, 'a board is watched once per user'
);
select throws_ok(
  $$ insert into public.watched_companies (provider, board, name) values ('lever', 'https://jobs.lever.co/x', 'X') $$,
  '23514', null, 'the board is a token, not a URL'
);
select throws_ok(
  $$ insert into public.watched_companies (user_id, provider, board, name)
     values ('22222222-2222-2222-2222-222222222222', 'lever', 'globex', 'Globex') $$,
  '42501', null, 'a user cannot add companies for someone else'
);

set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
select is_empty($$ select 1 from public.watched_companies $$, 'other users see no watched companies');
reset role;

select lives_ok(
  $$ insert into public.jobs (source, external_id, company, title, url, closed_at)
     values ('greenhouse', '1', 'Acme', 'Engineer', 'https://example.com', now()) $$,
  'jobs accept the board sources and a closed date'
);

select * from finish();
rollback;
