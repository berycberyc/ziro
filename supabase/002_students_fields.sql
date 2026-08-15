-- Migration: add photo, IIN, language, school to existing students table
-- Run this in Supabase SQL Editor

alter table students add column if not exists photo_url text;
alter table students add column if not exists iin text;
alter table students add column if not exists language text check (language in ('kk', 'ru'));
alter table students add column if not exists school text;
