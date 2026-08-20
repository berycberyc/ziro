-- Migration: simplify question bank — each variant (1-4) is now its own
-- independent, fully-authored set of questions (different numbers, own
-- correct answer) rather than a shuffled reordering of one shared set.
-- Removes the now-unnecessary shuffle-mapping machinery.
-- Run in Supabase SQL Editor after 019_fix_stage_test_fk.sql

-- Delete the existing math tests — they used the old shuffled-order model
-- and had known content errors anyway.
delete from question_bank_tests where code in (
  'test_math_generated_01',
  'test_math_generated_02',
  'test_math_generated_03'
);

-- Each question_bank_items row now belongs to one specific variant (1-4).
alter table question_bank_items add column if not exists variant_number int not null default 1;

-- The shuffle-mapping table is no longer needed — variants are now stored
-- directly as separate rows instead of being computed from a shared set.
drop table if exists question_bank_variant_sets;

-- online_attempts no longer needs to store a computed shuffle order either —
-- it just needs to know which variant (1-4) the student is taking, and
-- looks up that variant's questions directly.
alter table online_attempts drop column if exists block_orders;
alter table online_attempts add column if not exists variant_number int not null default 1;
