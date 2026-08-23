-- Migration: student first_name/last_name (spec says separate fields, like
-- the parent's own registration) + a city field that was missing entirely.
-- Run in Supabase SQL Editor after 027_student_delete_policy.sql

alter table students add column if not exists first_name text;
alter table students add column if not exists last_name text;
alter table students add column if not exists city text;

-- Best-effort backfill for any students already added under the old
-- single full_name field — splits on the first space.
update students
set first_name = split_part(full_name, ' ', 1),
    last_name = trim(substring(full_name from position(' ' in full_name)))
where first_name is null and full_name is not null and position(' ' in full_name) > 0;
