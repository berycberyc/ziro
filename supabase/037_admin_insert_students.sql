-- Migration: DummyDataButton (and any future admin tooling) needs to insert
-- students on behalf of a parent that isn't the currently logged-in user.
-- Students only had a "parents insert their own" policy before — add an
-- admin bypass for insert, matching the existing admin-select policy.
-- Run in Supabase SQL Editor after 036_full_test_data_wipe.sql

create policy "Admins can insert students" on students
  for insert with check (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );
