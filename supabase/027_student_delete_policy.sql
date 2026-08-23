-- Migration: parents need to be able to delete their own students
-- (only view/insert/update policies existed before — delete was missing).
-- Run in Supabase SQL Editor after 026_student_gender.sql

create policy "Parents can delete own students" on students
  for delete using (parent_id = auth.uid());
