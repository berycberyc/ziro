-- Migration: published results — the frozen snapshot parents actually see.
--
-- Until now `results` held one row per subject per student, and the parent
-- page ranked people subject by subject. That does not match how these
-- exams actually report:
--   НИШ  — per-subject scores + day totals + overall place out of everyone,
--          with a pass/fail line for the two gated subjects
--   БИЛ  — correct/wrong/score per part, plus totals
--   РФМШ — correct in 1–10 / 11–20 / 21–30 and one final score
--
-- Ranking also cannot be recomputed on the fly: НИШ question weights depend
-- on the whole cohort, so a score is only meaningful as part of one
-- calculation run. Everything is therefore computed once, when the admin
-- presses "Жариялау", and stored exactly as shown.
--
-- `results` (the old table) is left untouched so nothing existing breaks.
-- Run in Supabase SQL Editor after 050_online_schedule.sql

begin;

create table if not exists published_results (
  id uuid primary key default gen_random_uuid(),
  test_session_id uuid not null references test_sessions(id) on delete cascade,
  test_type_code text not null check (test_type_code in ('NIS', 'BIL', 'RFMS')),
  zipgrade_id text not null,

  place int not null,
  total_score numeric not null,

  -- Per-subject figures, shaped for the test type. Read by the parent page
  -- as-is; kept as jsonb because the three tests report different things.
  --   НИШ : {"math": {"score": 364, "pct": 91.0}, ...,
  --          "day1": 771, "day2": 445,
  --          "below": ["math"]}
  --   БИЛ : {"bil_math": {"correct": 35, "wrong": 10, "blank": 5, "score": 130}, ...}
  --   РФМШ: {"bands": [{"from":1,"to":10,"correct":9}, ...]}
  breakdown jsonb not null default '{}'::jsonb,

  -- [{"subject":"math","topic":"Пайыздар","correct":8,"total":10}, ...]
  -- Sorted worst-first when written, so the page can just print it.
  topics jsonb not null default '[]'::jsonb,

  published_at timestamptz not null default now(),
  unique (test_session_id, zipgrade_id, test_type_code)
);

create index if not exists published_results_session_idx
  on published_results(test_session_id, test_type_code, place);

alter table published_results enable row level security;

create policy "Admins manage published results" on published_results
  for all using (is_admin()) with check (is_admin());

-- The full ranking table is public by design — exactly like the official
-- lists, rows carry a ZipGrade id and scores, never a name.
create policy "Anyone can view published results" on published_results
  for select using (true);

-- When the current snapshot was published, so the admin can tell which
-- calculation parents are looking at.
alter table test_sessions add column if not exists results_published_at timestamptz;

commit;
