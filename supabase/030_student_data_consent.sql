-- Migration: personal-data-processing consent for a student, given by the
-- parent when adding them. Stores WHEN consent was given AND a snapshot of
-- the exact text agreed to (so later text edits don't affect old proof).
-- Run in Supabase SQL Editor after 029_student_region.sql

alter table students add column if not exists data_consent_given_at timestamptz;
alter table students add column if not exists data_consent_text_kk text;
alter table students add column if not exists data_consent_text_ru text;
