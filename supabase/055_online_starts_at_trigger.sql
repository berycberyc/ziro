-- Migration: online_starts_at is derived automatically from the session's
-- date + start time. One source of truth, maintained by the database.
--
-- Why: the column was added by 050 and backfilled once, but only the session
-- EDIT screen writes it. The session CREATE form saves session_date and
-- start_time and nothing else, so every session created after 050 has
-- online_starts_at = null. start_test_attempt treats null exactly like
-- "not started yet" and returns phase 'waiting' forever — the online test
-- for that session can never open, and nothing anywhere reports an error.
--
-- Fixing the create form would close this one hole; a trigger closes it for
-- every current and future writer, including manual SQL edits. From here on
-- date + time are the input, online_starts_at is the output, and they cannot
-- drift apart.
--
-- Time zone: Astana is UTC+5. The offset is written explicitly rather than
-- via 'Asia/Almaty' so the result never depends on the server's timezone or
-- on how up to date its timezone database is. This matches what the session
-- edit screen already sends ("...T10:00+05:00").
--
-- If start_time is empty the result is null — the online test stays shut for
-- that session. That is deliberate: a test must not open at a time nobody
-- entered. Fill in the time and it starts working.
-- Run in Supabase SQL Editor after 054.

begin;

-- ---------------------------------------------------------------
-- 1. The rule, in one place.
-- ---------------------------------------------------------------
create or replace function session_online_start(p_date date, p_time time)
returns timestamptz
language sql
immutable
as $$
  select case
    when p_date is null or p_time is null then null
    -- "This wall clock, read as UTC" minus 5 hours = the Astana instant.
    else ((p_date + p_time)::timestamp at time zone 'UTC') - interval '5 hours'
  end;
$$;

comment on function session_online_start(date, time) is
  'Exact moment an online test opens: session date + start time, Astana (UTC+5).';

-- ---------------------------------------------------------------
-- 2. Keep the column in step with its two inputs, always.
-- ---------------------------------------------------------------
create or replace function set_session_online_start()
returns trigger
language plpgsql
as $$
begin
  new.online_starts_at := session_online_start(new.session_date, new.start_time);
  return new;
end;
$$;

drop trigger if exists trg_set_session_online_start on test_sessions;
create trigger trg_set_session_online_start
  before insert or update of session_date, start_time on test_sessions
  for each row execute function set_session_online_start();

-- ---------------------------------------------------------------
-- 3. Repair everything created since 050 (and anything that drifted).
--    Sessions with no start time are left null on purpose — see above.
-- ---------------------------------------------------------------
update test_sessions
set online_starts_at = session_online_start(session_date, start_time)
where online_starts_at is distinct from session_online_start(session_date, start_time)
  and start_time is not null;

commit;

-- ---------------------------------------------------------------
-- Тексеру. Осы сұрауды миграциядан кейін орындаңыз:
--
--   select title_ru, session_date, start_time,
--          online_starts_at at time zone 'UTC' + interval '5 hours' as astana
--   from test_sessions
--   order by session_date desc;
--
-- "astana" бағаны session_date + start_time-пен дәл сәйкес келуі керек.
-- Уақыты толтырылмаған сессияларда online_starts_at бос болады — онлайн
-- тест ашылмайды, алдымен басталу уақытын енгізу керек.
-- ---------------------------------------------------------------
