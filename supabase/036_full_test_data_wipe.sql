-- Full test-data wipe. Keeps ONLY profiles with role admin/teacher (and
-- their auth.users rows). Everything else — parents, students, bookings,
-- trial tests, questions, topics, passages — is deleted.
-- Cascade foreign keys already in the schema clean up the rest for us:
--   deleting the wrong auth.users rows -> cascades profiles -> students
--     -> registrations -> test_attempts
--   deleting test_sessions -> cascades registrations, results,
--     session_test_types (if any)
-- Run this in Supabase SQL Editor. Irreversible — make sure you actually
-- want to wipe everything before running.

-- 1) Remove every non-admin/non-teacher user. Cascades away their
--    profiles, students, registrations, and test_attempts automatically.
delete from auth.users
where id in (
  select id from profiles where role not in ('admin', 'teacher')
);

-- 2) Remove all trial tests. Cascades away any remaining registrations
--    and all results tied to them.
delete from test_sessions;

-- 3) Remove all questions and their reading passages.
delete from questions;
delete from passages;

-- 4) Remove all topics (тақырыптар).
delete from topics;

-- Sanity check: run this after to confirm what's left.
select 'profiles' as table_name, count(*) from profiles
union all select 'students', count(*) from students
union all select 'registrations', count(*) from registrations
union all select 'test_sessions', count(*) from test_sessions
union all select 'questions', count(*) from questions
union all select 'passages', count(*) from passages
union all select 'topics', count(*) from topics
union all select 'results', count(*) from results
union all select 'test_attempts', count(*) from test_attempts;
