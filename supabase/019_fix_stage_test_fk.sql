-- Migration: allow question_bank_tests to be deleted/regenerated even when
-- a session currently has it assigned via session_stage_tests. The stale
-- assignment is removed automatically (admin re-assigns the new version on
-- the session's "Онлайн тест блоктарын баптау" page).
-- Run in Supabase SQL Editor after 018_question_topics.sql

alter table session_stage_tests
  drop constraint if exists session_stage_tests_question_bank_test_id_fkey;

alter table session_stage_tests
  add constraint session_stage_tests_question_bank_test_id_fkey
  foreign key (question_bank_test_id)
  references question_bank_tests(id)
  on delete cascade;
