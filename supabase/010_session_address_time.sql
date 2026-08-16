-- Migration: add address and start_time to test_sessions
-- Run this in Supabase SQL Editor

alter table test_sessions add column if not exists address text;
alter table test_sessions add column if not exists start_time time;
