-- Migration: final results (online+offline combined, admin-curated outside
-- the site and uploaded as one file) — the source for parent-facing rankings.
-- Run in Supabase SQL Editor after 030_student_data_consent.sql

create table if not exists results (
  id uuid primary key default gen_random_uuid(),
  test_session_id uuid not null references test_sessions(id) on delete cascade,
  zipgrade_id text not null,
  subject_label text not null,
  score numeric not null,
  created_at timestamptz not null default now(),
  unique (test_session_id, zipgrade_id, subject_label)
);

create index if not exists results_session_idx on results(test_session_id);
create index if not exists results_zipgrade_idx on results(zipgrade_id);

alter table results enable row level security;

create policy "Admins manage results" on results
  for all using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));

-- Anyone can read results for the anonymized "весь список" ranking — the
-- rows only contain zipgrade_id + subject + score, no names, so this is safe.
create policy "Anyone can view results" on results
  for select using (true);
