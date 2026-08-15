-- Migration: secure test_types, test_sessions, session_test_types with RLS
-- Everyone can read (needed for homepage listing); only admins can write.
-- Run this in Supabase SQL Editor

alter table test_types enable row level security;
alter table test_sessions enable row level security;
alter table session_test_types enable row level security;

create policy "Anyone can view test types" on test_types
  for select using (true);
create policy "Anyone can view test sessions" on test_sessions
  for select using (true);
create policy "Anyone can view session test types" on session_test_types
  for select using (true);

create policy "Admins can manage test types" on test_types
  for all using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );
create policy "Admins can manage test sessions" on test_sessions
  for all using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );
create policy "Admins can manage session test types" on session_test_types
  for all using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );
