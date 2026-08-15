-- Ziro: initial database schema
-- Run this once in Supabase SQL Editor (Project > SQL Editor > New query)

-- Profiles: extends Supabase auth.users with role info
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  role text not null default 'parent' check (role in ('parent', 'teacher', 'admin')),
  created_at timestamptz not null default now()
);

-- Students: children added by a parent
create table if not exists students (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references profiles(id) on delete cascade,
  full_name text not null,
  grade text,
  photo_url text,
  iin text,
  language text check (language in ('kk', 'ru')),
  school text,
  created_at timestamptz not null default now()
);

-- Test types: НЗМ/НИШ, БИЛ, РФММ/РФМШ, configurable later via admin constructor
create table if not exists test_types (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,        -- e.g. 'NISH', 'BIL', 'RFMSH'
  name_kk text not null,
  name_ru text not null,
  stages jsonb not null default '[]', -- [{subject, questions, minutes, answer_format}]
  scoring_scheme text not null default 'simple', -- simple / penalty / difficulty / adaptive
  created_at timestamptz not null default now()
);

-- Test sessions: a bookable event, e.g. "Қазан айы байқау тесті"
create table if not exists test_sessions (
  id uuid primary key default gen_random_uuid(),
  title_kk text not null,
  title_ru text not null,
  session_date date not null,
  registration_opens_at date,
  registration_closes_at date,
  price numeric(10,2) not null,
  is_checking boolean not null default false,
  has_results boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Registrations: a booking of one student into one test session + type + format
create table if not exists registrations (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references profiles(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  test_session_id uuid not null references test_sessions(id) on delete cascade,
  test_type_id uuid not null references test_types(id),
  format text not null check (format in ('online', 'offline')),
  payment_status text not null default 'pending' check (payment_status in ('pending', 'paid')),
  classroom text,
  test_variant text,
  created_at timestamptz not null default now()
);

-- Row Level Security: parents only see their own data
alter table profiles enable row level security;
alter table students enable row level security;
alter table registrations enable row level security;

create policy "Users can view own profile" on profiles
  for select using (auth.uid() = id);
create policy "Users can update own profile" on profiles
  for update using (auth.uid() = id);

create policy "Parents can view own students" on students
  for select using (auth.uid() = parent_id);
create policy "Parents can insert own students" on students
  for insert with check (auth.uid() = parent_id);
create policy "Parents can update own students" on students
  for update using (auth.uid() = parent_id);

create policy "Parents can view own registrations" on registrations
  for select using (auth.uid() = parent_id);
create policy "Parents can insert own registrations" on registrations
  for insert with check (auth.uid() = parent_id);

-- Seed the 3 current test types
insert into test_types (code, name_kk, name_ru, stages, scoring_scheme) values
  ('NISH', 'НЗМ', 'НИШ',
   '[{"subject":"Математика","questions":40,"minutes":60,"format":"abcd"},
     {"subject":"Сандық сипаттама","questions":60,"minutes":30,"format":"abcd"},
     {"subject":"Жаратылыстану","questions":20,"minutes":30,"format":"abcd"},
     {"subject":"Тілдер","questions":60,"minutes":120,"format":"abcd"}]',
   'simple'),
  ('BIL', 'БИЛ', 'БИЛ',
   '[{"subject":"Математика","questions":50,"minutes":90,"format":"abcd"},
     {"subject":"Оқу сауаттылығы","questions":10,"minutes":20,"format":"abcd"}]',
   'simple'),
  ('RFMSH', 'РФММ', 'РФМШ',
   '[{"subject":"Математика","questions":30,"minutes":120,"format":"number"}]',
   'simple')
on conflict (code) do nothing;
