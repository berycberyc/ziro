-- Corrective migration: an old, unrelated "results" table already existed
-- (from an earlier stage of the project — different schema: total_score,
-- breakdown, verified_by). Renaming it out of the way instead of dropping,
-- so nothing is lost, then creating the real results table this project
-- now uses.
-- Run in Supabase SQL Editor instead of re-running 031_results.sql directly.

alter table if exists results rename to results_old_deprecated;

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

create policy "Anyone can view results" on results
  for select using (true);
