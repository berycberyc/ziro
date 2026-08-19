-- Migration: online test-taking — session-to-question-bank assignment,
-- and per-registration attempt tracking (timer, answers, anti-cheat, score).
-- Run in Supabase SQL Editor after 016_question_bank.sql

-- Which question_bank_test covers which subject block for a given session.
-- block_key examples: 'math', 'sandyq', 'zharatylystanu', 'tilder',
-- 'bil_math', 'bil_reading', 'rfmsh'
create table if not exists session_stage_tests (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references test_sessions(id) on delete cascade,
  block_key text not null,
  question_bank_test_id uuid not null references question_bank_tests(id),
  duration_minutes int not null,
  block_order int not null default 1,
  unique (session_id, block_key)
);

-- One row per student's online attempt at a registration's test.
create table if not exists online_attempts (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null unique references registrations(id) on delete cascade,
  variant_number int not null,
  status text not null default 'in_progress' check (status in ('in_progress', 'submitted', 'flagged_ended')),
  current_block_key text,
  current_block_started_at timestamptz,
  -- Frozen per-block question/choice order, computed once at attempt start so
  -- reloading the page never reshuffles mid-attempt.
  -- { "<block_key>": { "item_ids": ["..."], "choice_order": { "<item_id>": [0,2,1,3] } } }
  block_orders jsonb not null default '{}'::jsonb,
  -- answers: { "<block_key>": { "<item_id>": "<chosen letter or numeric text>" } }
  answers jsonb not null default '{}'::jsonb,
  score numeric,
  started_at timestamptz not null default now(),
  submitted_at timestamptz
);

alter table session_stage_tests enable row level security;
alter table online_attempts enable row level security;

create policy "Admins manage stage tests" on session_stage_tests
  for all using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));

create policy "Anyone can view stage tests for sessions" on session_stage_tests
  for select using (true);

create policy "Parents manage own attempts" on online_attempts
  for all using (
    exists (
      select 1 from registrations r
      where r.id = online_attempts.registration_id and r.parent_id = auth.uid()
    )
  );

create policy "Admins view all attempts" on online_attempts
  for select using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));

-- Students taking an online test need to read the actual question content.
-- (See the security note below — this currently also exposes which choice
-- is correct in the browser's network response.)
create policy "Authenticated users can view question bank items" on question_bank_items
  for select to authenticated using (true);
