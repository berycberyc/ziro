-- Migration: allow admins to view and manage all registrations,
-- and view students (needed for the admin session/distribution page).
-- Run this in Supabase SQL Editor

create policy "Admins can view all registrations" on registrations
  for select using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

create policy "Admins can update registrations" on registrations
  for update using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

create policy "Admins can view all students" on students
  for select using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );
