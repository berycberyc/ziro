-- Migration: a student can only book once per trial test (test_session) —
-- can't register for both НИШ and БИЛ under the same event, for example.
-- Run in Supabase SQL Editor after 023_quantity_comparison.sql

-- If this fails with a duplicate-key error, it means some student already
-- has more than one registration for the same test_session_id — those
-- need to be resolved by hand (decide which booking to keep/cancel)
-- before this constraint can be added.
alter table registrations
  add constraint registrations_one_per_student_per_session
  unique (student_id, test_session_id);
