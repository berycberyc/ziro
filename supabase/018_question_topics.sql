-- Migration: topic tag on question_bank_items, for the planned
-- "which topics to study" parent-facing feedback feature.
-- Run in Supabase SQL Editor after 017_online_tests.sql

alter table question_bank_items add column if not exists topic text;
