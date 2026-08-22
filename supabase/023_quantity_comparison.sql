-- Migration: fields needed for Сандық сипаттамалар (quantity-comparison
-- questions): an optional general condition + two compared columns, with a
-- fixed 4-choice answer (reuses correct_answer, storing 'A'/'B'/'C'/'D').
-- Run in Supabase SQL Editor after 022_bilingual_topics.sql

alter table questions add column if not exists column_a_kk text;
alter table questions add column if not exists column_a_ru text;
alter table questions add column if not exists column_b_kk text;
alter table questions add column if not exists column_b_ru text;

-- text_kk/text_ru are reused as the optional general condition for this
-- subject (nullable is fine — they're already just text columns).
alter table questions alter column text_kk drop not null;
alter table questions alter column text_ru drop not null;

alter table questions drop constraint if exists questions_answer_format_check;
alter table questions add constraint questions_answer_format_check
  check (answer_format in ('abcd', 'numeric', 'quantity'));
