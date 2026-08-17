-- Migration: add a 5-digit unique zipgrade_id to students (for ZipGrade roster
-- import), plus a storage bucket + policy for student photos.
-- Run this in Supabase SQL Editor, after 013_short_code.sql

-- 1. zipgrade_id: 5 unique random digits per student, auto-generated on insert
alter table students add column if not exists zipgrade_id text unique;

create or replace function generate_zipgrade_id() returns text as $$
declare
  result text;
  attempt int := 0;
begin
  loop
    result := lpad(floor(random() * 100000)::text, 5, '0');
    exit when not exists (select 1 from students where zipgrade_id = result);
    attempt := attempt + 1;
    exit when attempt > 30; -- safety valve
  end loop;
  return result;
end;
$$ language plpgsql;

create or replace function set_student_zipgrade_id() returns trigger as $$
begin
  if new.zipgrade_id is null then
    new.zipgrade_id := generate_zipgrade_id();
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_set_student_zipgrade_id on students;
create trigger trg_set_student_zipgrade_id
  before insert on students
  for each row execute function set_student_zipgrade_id();

-- Backfill any existing rows that don't have one yet.
update students set zipgrade_id = generate_zipgrade_id() where zipgrade_id is null;

-- 2. Storage bucket for student photos (public read, so photo_url works directly)
insert into storage.buckets (id, name, public)
values ('student-photos', 'student-photos', true)
on conflict (id) do nothing;

-- Parents may only upload into a folder named after their own user id
-- (the app uploads to `${parentId}/${filename}`), preventing them from
-- writing into another parent's folder.
create policy "Parents can upload own student photos"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'student-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Parents can update own student photos"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'student-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
