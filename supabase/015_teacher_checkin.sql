-- Migration: teacher check-in scanning support
-- Run in Supabase SQL Editor after 014_zipgrade_id_and_photos.sql

-- 1. New columns on registrations
alter table registrations add column if not exists seat text;
alter table registrations add column if not exists checked_in_at timestamptz;

-- 2. RLS: teachers need to read registrations + students, and mark check-in.
--    Without these, the scan page would silently show empty data for
--    anyone with role = 'teacher' (same class of bug as the parent
--    bookings page had before short_code was added).

create policy "Teachers can view all registrations"
  on registrations for select
  to authenticated
  using (
    exists (
      select 1 from profiles
      where id = auth.uid() and role = 'teacher'
    )
  );

create policy "Teachers can check students in"
  on registrations for update
  to authenticated
  using (
    exists (
      select 1 from profiles
      where id = auth.uid() and role = 'teacher'
    )
  )
  with check (
    exists (
      select 1 from profiles
      where id = auth.uid() and role = 'teacher'
    )
  );

create policy "Teachers can view all students"
  on students for select
  to authenticated
  using (
    exists (
      select 1 from profiles
      where id = auth.uid() and role = 'teacher'
    )
  );
