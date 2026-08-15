-- Migration: answers (per-question) and results (final scores) tables
-- Run this in Supabase SQL Editor

-- Answers: what each student answered on each question of their test
create table if not exists answers (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null references registrations(id) on delete cascade,
  question_number int not null,
  subject text,                    -- which stage/subject this question belongs to
  given_answer text,               -- 'A' / 'B' / 'C' / 'D' or a number, as recognized
  is_correct boolean,
  created_at timestamptz not null default now(),
  unique (registration_id, question_number)
);

-- Results: final computed score per registration
create table if not exists results (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null unique references registrations(id) on delete cascade,
  total_score numeric(10,2),
  breakdown jsonb,                 -- e.g. [{"subject":"Математика","score":35,"max":40}, ...]
  status text not null default 'draft' check (status in ('draft', 'verified', 'published')),
  verified_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

alter table answers enable row level security;
alter table results enable row level security;

create policy "Parents can view own students' answers" on answers
  for select using (
    exists (
      select 1 from registrations r
      where r.id = answers.registration_id and r.parent_id = auth.uid()
    )
  );

create policy "Parents can view own students' results" on results
  for select using (
    exists (
      select 1 from registrations r
      where r.id = results.registration_id and r.parent_id = auth.uid()
    )
    and status = 'published'
  );
