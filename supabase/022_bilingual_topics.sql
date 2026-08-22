-- Migration: topics need separate kk/ru names (not one shared field)
-- Run in Supabase SQL Editor after 021_new_question_system.sql

alter table topics add column if not exists name_kk text;
alter table topics add column if not exists name_ru text;

-- Backfill: copy the old single name into both, for any topics already entered.
update topics set name_kk = name, name_ru = name where name_kk is null and name is not null;

alter table topics alter column name_kk set not null;
alter table topics alter column name_ru set not null;

alter table topics drop constraint if exists topics_subject_name_key;
alter table topics drop column if exists name;

alter table topics add constraint topics_subject_name_kk_key unique (subject, name_kk);
