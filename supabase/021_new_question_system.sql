-- Migration: new admin-authored question system, replacing the old
-- question_bank_* tables (those stay in place for now but are no longer
-- used by new screens — will be dropped in a later cleanup pass).
-- Run in Supabase SQL Editor.

-- Predefined topic list, managed by admin (add/edit/delete), scoped per subject.
create table if not exists topics (
  id uuid primary key default gen_random_uuid(),
  subject text not null check (subject in (
    'math', 'sandyq', 'zharatylystanu',
    'tilder_kk', 'tilder_ru', 'tilder_en',
    'bil_math', 'bil_reading', 'rfmsh'
  )),
  name text not null,
  created_at timestamptz not null default now(),
  unique (subject, name)
);

-- Reading passages for Тілдер and БИЛ-грамотность чтения — a question can
-- reference one of these; several questions can share the same passage.
create table if not exists passages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references test_sessions(id) on delete cascade,
  subject text not null check (subject in ('tilder_kk', 'tilder_ru', 'tilder_en', 'bil_reading')),
  variant_number int not null check (variant_number between 1 and 4),
  passage_text text not null,
  order_number int not null default 1,
  created_at timestamptz not null default now()
);

-- Questions are now entered directly against a specific trial test (session)
-- rather than a separate reusable "bank" — matches the new admin flow.
create table if not exists questions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references test_sessions(id) on delete cascade,
  subject text not null check (subject in (
    'math', 'sandyq', 'zharatylystanu',
    'tilder_kk', 'tilder_ru', 'tilder_en',
    'bil_math', 'bil_reading', 'rfmsh'
  )),
  variant_number int not null check (variant_number between 1 and 4),
  question_number int not null,
  topic_id uuid references topics(id),
  passage_id uuid references passages(id) on delete set null,
  text_kk text not null,
  text_ru text not null,
  image_url text,
  answer_format text not null default 'abcd' check (answer_format in ('abcd', 'numeric')),
  -- choices: [{"text_kk":"...","text_ru":"...","correct":true}, ...] — always
  -- 4 entries for abcd; empty array for numeric (see correct_answer instead)
  choices jsonb not null default '[]'::jsonb,
  correct_answer text, -- used only when answer_format = 'numeric'
  created_at timestamptz not null default now(),
  unique (session_id, subject, variant_number, question_number)
);

create index if not exists questions_session_idx on questions(session_id);

alter table topics enable row level security;
alter table passages enable row level security;
alter table questions enable row level security;

create policy "Admins manage topics" on topics
  for all using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));
create policy "Anyone can view topics" on topics for select using (true);

create policy "Admins manage passages" on passages
  for all using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));

create policy "Admins manage questions" on questions
  for all using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));

-- Storage bucket for question images (public read, admin-only upload)
insert into storage.buckets (id, name, public)
values ('question-images', 'question-images', true)
on conflict (id) do nothing;

create policy "Admins upload question images"
  on storage.objects for insert
  with check (
    bucket_id = 'question-images'
    and exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

create policy "Admins update question images"
  on storage.objects for update
  using (
    bucket_id = 'question-images'
    and exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

create policy "Anyone can view question images"
  on storage.objects for select
  using (bucket_id = 'question-images');
