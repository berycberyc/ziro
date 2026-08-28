-- Migration: storage for the print-ready PDFs.
--
-- How printing works, and why it is built this way:
--   1. The admin uploads a Word file with the [tags] — questions go into
--      the database as usual.
--   2. The same screen immediately offers two CLEAN Word files (kk and ru,
--      one file for Тілдер since it is monolingual) — same questions, no
--      tags, ready to print.
--   3. The admin fixes the page breaks by hand — this matters, because the
--      paper test has to look like the real exam — and saves as PDF.
--   4. That PDF is uploaded back here.
--   5. A separate screen glues per-room booklets: cover sheet with the
--      student's name, seat and variant, then the pages of THEIR variant.
--
-- Why per variant and not per student: one room repeats the same variant
-- a dozen times. Fixing the layout once per variant is thirty files;
-- per student it would be hundreds of pages of identical manual work.
--
-- The assembled per-room files are NOT stored — they are handed to the
-- browser and forgotten. Only these source PDFs are kept, and only until
-- the admin clears them after the test (free tier storage is shared with
-- student photos and payment receipts).
-- Run in Supabase SQL Editor after 053_test_attempts_rls.sql

begin;

create table if not exists print_files (
  id uuid primary key default gen_random_uuid(),
  test_session_id uuid not null references test_sessions(id) on delete cascade,
  subject text not null check (subject in (
    'math', 'sandyq', 'zharatylystanu', 'tilder', 'bil', 'rfmsh'
  )),
  variant_number int not null check (variant_number between 1 and 4),
  -- Тілдер is monolingual: one file serves everyone, stored as 'kk'.
  lang text not null check (lang in ('kk', 'ru')),
  file_url text not null,
  page_count int,
  uploaded_at timestamptz not null default now(),
  unique (test_session_id, subject, variant_number, lang)
);

create index if not exists print_files_session_idx on print_files(test_session_id);

alter table print_files enable row level security;

create policy "Admins manage print files" on print_files
  for all using (is_admin()) with check (is_admin());

insert into storage.buckets (id, name, public)
values ('print-files', 'print-files', true)
on conflict (id) do nothing;

create policy "Admins can upload print files" on storage.objects
  for insert with check (bucket_id = 'print-files' and is_admin());

create policy "Admins can update print files" on storage.objects
  for update using (bucket_id = 'print-files' and is_admin())
  with check (bucket_id = 'print-files' and is_admin());

create policy "Admins can delete print files" on storage.objects
  for delete using (bucket_id = 'print-files' and is_admin());

create policy "Anyone can read print files" on storage.objects
  for select using (bucket_id = 'print-files');

commit;
