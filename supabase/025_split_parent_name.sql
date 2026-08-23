-- Migration: parent registration now collects Имя/Фамилия as separate
-- fields. Adds first_name/last_name to profiles and updates the signup
-- trigger to populate them (full_name is kept in sync too, since other
-- screens still read it for display).
-- Run in Supabase SQL Editor after 024_one_booking_per_student.sql

alter table profiles add column if not exists first_name text;
alter table profiles add column if not exists last_name text;

create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, first_name, last_name, phone, role)
  values (
    new.id,
    trim(concat(new.raw_user_meta_data->>'first_name', ' ', new.raw_user_meta_data->>'last_name')),
    new.raw_user_meta_data->>'first_name',
    new.raw_user_meta_data->>'last_name',
    new.raw_user_meta_data->>'phone',
    'parent'
  );
  return new;
end;
$$ language plpgsql security definer;
