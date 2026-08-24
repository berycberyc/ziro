-- Migration: one place for RAW answers, whatever their source.
--
-- Scoring now runs over online and offline answers together (НИШ question
-- weights depend on the whole cohort), so both have to land in the same
-- shape. `answer_sheets` is that shape: one row per student per subject,
-- holding what they actually marked — nothing scored, nothing interpreted.
--
--   answers:  {"1": "A", "2": "", "3": "CD", "17": "556"}
--             "" = blank, "CD" = two bubbles filled (counts as wrong),
--             a number = РФМШ-style numeric answer.
--   source:   'online'   — taken in the browser, copied over from
--                          test_attempts by the admin screen
--             'zipgrade' — imported from a ZipGrade export file
--
-- Тілдер is stored as ONE subject with questions 1–60; the split into three
-- 200-point language scores happens only while scoring, by question range.
-- Run in Supabase SQL Editor after 047_resumable_test.sql

begin;

create table if not exists answer_sheets (
  id uuid primary key default gen_random_uuid(),
  test_session_id uuid not null references test_sessions(id) on delete cascade,
  zipgrade_id text not null,
  subject text not null check (subject in (
    'math', 'sandyq', 'zharatylystanu', 'tilder',
    'bil_math', 'bil_reading', 'rfmsh'
  )),
  variant_number int not null check (variant_number between 1 and 4),
  source text not null check (source in ('online', 'zipgrade')),
  answers jsonb not null default '{}'::jsonb,
  imported_at timestamptz not null default now(),
  -- Бір оқушының бір пән бойынша бір ғана парағы болады. Қайта жүктегенде
  -- жаңасы ескісінің орнын басады.
  unique (test_session_id, zipgrade_id, subject)
);

create index if not exists answer_sheets_session_idx
  on answer_sheets(test_session_id, subject);

alter table answer_sheets enable row level security;

create policy "Admins manage answer sheets" on answer_sheets
  for all using (is_admin()) with check (is_admin());

commit;
