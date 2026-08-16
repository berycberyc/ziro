-- STEP 1 — DIAGNOSTIC: run this first to see which account is admin.
-- Look at the "email" column and check whether your logged-in account's
-- row shows role = 'admin'. If it shows something else (or null), that's
-- the problem.
select au.email, p.role, p.id
from profiles p
join auth.users au on au.id = p.id;

-- STEP 2 — if your account is NOT marked admin, run this
-- (replace the email with your real login email):
-- update profiles set role = 'admin' where id = (
--   select id from auth.users where email = 'YOUR_EMAIL_HERE'
-- );

-- STEP 3 — strengthen the RLS policy with an explicit WITH CHECK clause
-- for inserts (safe to run even if step 1/2 already fixed it).
drop policy if exists "Admins can manage test sessions" on test_sessions;
create policy "Admins can manage test sessions" on test_sessions
  for all
  using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));
