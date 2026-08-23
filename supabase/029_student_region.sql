-- Migration: separate region field (used for the область→город cascading
-- dropdown) alongside the existing city text field.
-- Run in Supabase SQL Editor after 028_student_name_and_city.sql

alter table students add column if not exists region text;
