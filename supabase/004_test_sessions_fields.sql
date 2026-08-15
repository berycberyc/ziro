-- Migration: add registration window and status flags to test_sessions
-- Run this in Supabase SQL Editor

alter table test_sessions add column if not exists registration_opens_at date;
alter table test_sessions add column if not exists registration_closes_at date;
alter table test_sessions add column if not exists is_checking boolean not null default false;
alter table test_sessions add column if not exists has_results boolean not null default false;
alter table test_sessions add column if not exists is_active boolean not null default true;
