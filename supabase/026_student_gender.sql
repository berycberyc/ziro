-- Migration: student gender field (мальчик/девочка)
-- Run in Supabase SQL Editor after 025_split_parent_name.sql

alter table students add column if not exists gender text check (gender in ('male', 'female'));
