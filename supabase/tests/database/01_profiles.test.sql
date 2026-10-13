begin;
select plan(10);

insert into auth.users (id, email)
values
  ('11111111-1111-1111-1111-111111111111', 'a@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'b@example.com');

-- anon reads and writes nothing
set local role anon;
select throws_ok($$ select * from public.profiles $$, '42501', null, 'anon cannot read profiles');
select throws_ok(
  $$ insert into public.profiles (user_id) values ('11111111-1111-1111-1111-111111111111') $$,
  '42501', null, 'anon cannot insert profiles'
);
reset role;

-- User A
set local role authenticated;
set local request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

select lives_ok(
  $$ insert into public.profiles (user_id, home_city) values ('11111111-1111-1111-1111-111111111111', 'Pune') $$,
  'a user can create their own profile'
);
select throws_ok(
  $$ insert into public.profiles (user_id) values ('22222222-2222-2222-2222-222222222222') $$,
  '42501', null, 'a user cannot create a profile for someone else'
);
select results_eq(
  $$ select search_radius_km, include_remote from public.profiles $$,
  $$ values (50, true) $$,
  'new profiles default to 50 km and include remote'
);

-- User B
set local request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';
insert into public.profiles (user_id, home_city) values ('22222222-2222-2222-2222-222222222222', 'Delhi');

select results_eq(
  $$ select home_city from public.profiles $$,
  $$ values ('Delhi') $$,
  'a user sees only their own profile'
);

update public.profiles set home_city = 'Hacked' where user_id = '11111111-1111-1111-1111-111111111111';
delete from public.profiles where user_id = '11111111-1111-1111-1111-111111111111';
reset role;

select results_eq(
  $$ select home_city from public.profiles where user_id = '11111111-1111-1111-1111-111111111111' $$,
  $$ values ('Pune') $$,
  'a user cannot change or delete someone else''s profile'
);

-- updated_at follows updates
update public.profiles set updated_at = now() - interval '1 day', home_city = 'Pune'
where user_id = '11111111-1111-1111-1111-111111111111';
select ok(
  (select updated_at > now() - interval '1 minute' from public.profiles
   where user_id = '11111111-1111-1111-1111-111111111111'),
  'updated_at is set on update'
);

select throws_ok(
  $$ update public.profiles set home_country = 'India' where user_id = '11111111-1111-1111-1111-111111111111' $$,
  '23514', null, 'home_country must be an ISO alpha-2 code'
);

-- Deleting the account removes the profile
delete from auth.users where id = '11111111-1111-1111-1111-111111111111';
select is_empty(
  $$ select 1 from public.profiles where user_id = '11111111-1111-1111-1111-111111111111' $$,
  'deleting a user removes their profile'
);

select * from finish();
rollback;
