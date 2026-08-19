-- Migration: internal question bank for AI/admin-generated tests
-- Run in Supabase SQL Editor after 015_teacher_checkin.sql

-- A "test" here is one assembled set of questions for one subject/profile
-- (e.g. "Математика — тест 01"). Independent from test_sessions/test_types,
-- which stay about booking/scheduling.
create table if not exists question_bank_tests (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,               -- e.g. test_math_generated_01
  profile_id text not null,                -- matches lib/docxTest/profiles.ts ids
  title text not null,
  status text not null default 'draft' check (status in ('draft', 'ready')),
  created_at timestamptz not null default now()
);

-- Groups a reading passage with the questions that belong to it, so they can
-- be shuffled together as one unit (Тілдер / БІЛ грамотность чтения).
create table if not exists question_bank_reading_groups (
  id uuid primary key default gen_random_uuid(),
  test_id uuid not null references question_bank_tests(id) on delete cascade,
  order_hint int not null,                 -- original passage order, for display fallback
  passage_kk text,
  passage_ru text
);

create table if not exists question_bank_items (
  id uuid primary key default gen_random_uuid(),
  test_id uuid not null references question_bank_tests(id) on delete cascade,
  reading_group_id uuid references question_bank_reading_groups(id) on delete set null,
  question_number int not null,            -- original position within the test
  block_key text not null default 'main',  -- e.g. 'math', 'reading', 'kk', 'ru', 'en', 'p3','p5','p7'
  text_kk text,
  text_ru text,
  answer_format text not null default 'abcd' check (answer_format in ('abcd', 'numeric', 'quantity')),
  -- choices: [{"text": "...", "correct": true}, ...] for abcd; for numeric just [{"text":"42","correct":true}]
  choices jsonb not null default '[]'::jsonb,
  image_svg text,                          -- optional inline SVG figure
  created_at timestamptz not null default now()
);

create index if not exists question_bank_items_test_id_idx on question_bank_items(test_id);

-- Freezes the shuffle result once a question_bank_test (or a combined НИШ
-- bundle of several) is actually assigned to a real exam date, so
-- re-downloading always returns the same 4 variants instead of a fresh
-- random shuffle each time.
create table if not exists question_bank_variant_sets (
  id uuid primary key default gen_random_uuid(),
  test_id uuid not null references question_bank_tests(id) on delete cascade,
  assigned_date date,
  -- mapping: { "1": [{"item_id":"...","letters":["A","B","C","D"]}, ...], "2": [...], "3": [...], "4": [...] }
  mapping jsonb not null,
  created_at timestamptz not null default now()
);

alter table question_bank_tests enable row level security;
alter table question_bank_reading_groups enable row level security;
alter table question_bank_items enable row level security;
alter table question_bank_variant_sets enable row level security;

create policy "Admins manage question bank tests" on question_bank_tests
  for all using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));
create policy "Admins manage reading groups" on question_bank_reading_groups
  for all using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));
create policy "Admins manage question bank items" on question_bank_items
  for all using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));
create policy "Admins manage variant sets" on question_bank_variant_sets
  for all using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));
