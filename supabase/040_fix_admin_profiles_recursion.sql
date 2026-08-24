-- URGENT FIX: migration 039 created a policy ON profiles that subqueries
-- profiles ITSELF to check "is this user an admin" — a self-referencing
-- RLS policy, which Postgres either fails on ("infinite recursion
-- detected in policy for relation profiles") or resolves unpredictably.
-- In practice this blocked EVERYONE, including the admin, from reading
-- their own profile row — which is why the admin panel started
-- rejecting even the real admin.
-- Run this in Supabase SQL Editor immediately.

-- Remove the broken policy.
drop policy if exists "Admins can view all profiles" on profiles;

-- A security-definer function runs with the privileges of whoever
-- created it (not the calling user), which bypasses RLS for its own
-- internal query — this is the standard, safe way to check a role
-- without triggering the same table's RLS recursively.
create or replace function is_admin()
returns boolean as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'admin'
  );
$$ language sql security definer stable;

-- Recreate the policy using the helper function instead of a raw
-- self-referencing subquery.
create policy "Admins can view all profiles" on profiles
  for select using (is_admin());
