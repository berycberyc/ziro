-- Migration: admin needs to see a parent's contact info (email + phone)
-- from the Оплата page without navigating away. Email currently only
-- lives in auth.users, which normal client-side queries can't read for
-- OTHER users — denormalize it into profiles instead.
-- Run in Supabase SQL Editor after 034_fix_results_subject_labels.sql

alter table profiles add column if not exists email text;

-- One-time backfill for everyone who registered before this migration.
update profiles p
set email = u.email
from auth.users u
where p.id = u.id
  and p.email is null;

-- Keep it in sync for every new signup going forward.
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, first_name, last_name, phone, email, role)
  values (
    new.id,
    trim(concat(new.raw_user_meta_data->>'first_name', ' ', new.raw_user_meta_data->>'last_name')),
    new.raw_user_meta_data->>'first_name',
    new.raw_user_meta_data->>'last_name',
    new.raw_user_meta_data->>'phone',
    new.email,
    'parent'
  );
  return new;
end;
$$ language plpgsql security definer;
