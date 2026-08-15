-- Migration: link test_sessions to multiple test_types (many-to-many)
-- Run this in Supabase SQL Editor, after schema.sql

create table if not exists session_test_types (
  id uuid primary key default gen_random_uuid(),
  test_session_id uuid not null references test_sessions(id) on delete cascade,
  test_type_id uuid not null references test_types(id) on delete cascade,
  price numeric(10,2), -- optional: override the session price per test type
  unique (test_session_id, test_type_id)
);
