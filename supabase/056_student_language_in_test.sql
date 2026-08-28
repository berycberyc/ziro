-- Migration: the online test screen must speak the STUDENT's language.
--
-- Why: every visible word on /test — buttons, notices, countdown captions,
-- the consent screen, error messages — plus the language the question text
-- itself is shown in, currently follows the site's language toggle. That
-- toggle lives in the browser's local storage, defaults to Kazakh, and has
-- no switch anywhere on the test screen. Students enter by booking number
-- without logging in, usually on a device that has never opened the site,
-- so a Russian-group child would sit down to Kazakh questions with no way
-- to change it.
--
-- The right source was always in the database: students.language ('kk'/'ru'),
-- filled in when the child is added and already used for printing paper
-- booklets. The test screen simply never asked for it. It cannot ask
-- directly either — students take the test as the anon role, which may not
-- read the students table. This function is security definer, so it hands
-- the value over itself, exactly as it already does for session_id.
--
-- Nothing else changes: same phases, same timings, same checks. One extra
-- field in the returned JSON, present in all three exits (waiting,
-- entry_closed, running/finished) because the screen shows text in every
-- one of them.
-- Run in Supabase SQL Editor after 055_online_starts_at_trigger.sql

begin;

create or replace function start_test_attempt(p_registration_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reg record;
  v_blocks text[];
  v_attempt record;
  v_starts_at timestamptz;
  v_entry_closes timestamptz;
  v_now timestamptz := now();
  v_phase text;
  v_auto_started boolean := false;
  v_lang text;
begin
  select r.*, tt.code as test_type_code, ts.online_starts_at,
         s.language as student_language
  into v_reg
  from registrations r
  join test_types tt on tt.id = r.test_type_id
  join test_sessions ts on ts.id = r.test_session_id
  join students s on s.id = r.student_id
  where r.id = p_registration_id and r.format = 'online' and r.payment_status = 'paid';

  if not found then
    raise exception 'invalid_registration';
  end if;

  -- The column is nullable and predates the check constraint, so anything
  -- unexpected falls back to Kazakh rather than leaving the screen blank.
  v_lang := case when v_reg.student_language = 'ru' then 'ru' else 'kk' end;

  v_blocks := online_blocks(v_reg.test_type_code);
  v_starts_at := v_reg.online_starts_at;
  v_entry_closes := v_starts_at + interval '30 minutes';

  select * into v_attempt from test_attempts where registration_id = p_registration_id;

  -- Not started yet: no attempt is created, nothing is committed.
  if v_starts_at is null or v_now < v_starts_at then
    return json_build_object(
      'phase', 'waiting',
      'starts_at', v_starts_at,
      'entry_closes_at', v_entry_closes,
      'server_now', v_now,
      'blocks', v_blocks,
      'student_language', v_lang
    );
  end if;

  -- Entry window closed and this student never came in.
  if v_attempt.id is null and v_now > v_entry_closes then
    return json_build_object(
      'phase', 'entry_closed',
      'starts_at', v_starts_at,
      'entry_closes_at', v_entry_closes,
      'server_now', v_now,
      'student_language', v_lang
    );
  end if;

  -- First arrival inside the window: create the attempt and fix the
  -- personal deadline from THIS moment.
  if v_attempt.id is null then
    insert into test_attempts (registration_id, current_subject_index, entered_at, deadline_at)
    values (
      p_registration_id, 0, v_now,
      v_now + make_interval(mins => online_total_minutes(v_reg.test_type_code))
    )
    returning * into v_attempt;

    perform log_test_event(p_registration_id, v_reg.test_session_id, 'entered', null,
      jsonb_build_object('deadline_at', v_attempt.deadline_at));
  end if;

  -- Older attempts (created before migration 050) have no deadline yet.
  if v_attempt.deadline_at is null then
    update test_attempts
    set deadline_at = coalesce(entered_at, created_at)
      + make_interval(mins => online_total_minutes(v_reg.test_type_code)),
        entered_at = coalesce(entered_at, created_at)
    where id = v_attempt.id
    returning * into v_attempt;
  end if;

  -- Break expired while the student was away: the block is already running.
  if v_attempt.status = 'in_progress'
     and v_attempt.subject_started_at is null
     and v_attempt.break_started_at is not null
     and v_now >= v_attempt.break_started_at + interval '5 minutes'
  then
    update test_attempts
    set subject_started_at = v_attempt.break_started_at + interval '5 minutes'
    where id = v_attempt.id
    returning * into v_attempt;
    v_auto_started := true;

    perform log_test_event(p_registration_id, v_reg.test_session_id, 'block_auto_started',
      v_blocks[v_attempt.current_subject_index + 1], '{}'::jsonb);
  end if;

  -- Past the personal deadline: close whatever is open, keep the answers.
  if v_attempt.status = 'in_progress' and v_now > v_attempt.deadline_at then
    update test_attempts
    set status = 'submitted', submitted_at = v_now
    where id = v_attempt.id
    returning * into v_attempt;

    perform log_test_event(p_registration_id, v_reg.test_session_id, 'force_closed', null,
      jsonb_build_object('deadline_at', v_attempt.deadline_at));
  end if;

  v_phase := case when v_attempt.status = 'submitted' then 'finished' else 'running' end;

  return json_build_object(
    'phase', v_phase,
    'attempt_id', v_attempt.id,
    'status', v_attempt.status,
    'consent_given_at', v_attempt.consent_given_at,
    'blocks', v_blocks,
    'current_subject_index', v_attempt.current_subject_index,
    'subject_started_at', v_attempt.subject_started_at,
    'break_started_at', v_attempt.break_started_at,
    'break_ends_at', v_attempt.break_started_at + interval '5 minutes',
    'deadline_at', v_attempt.deadline_at,
    'starts_at', v_starts_at,
    'entry_closes_at', v_entry_closes,
    'answers', v_attempt.answers,
    'session_id', v_reg.test_session_id,
    'variant_number', coalesce(nullif(regexp_replace(coalesce(v_reg.test_variant, ''), '\D', '', 'g'), ''), '1')::int,
    'server_now', v_now,
    'auto_started', v_auto_started,
    'student_language', v_lang
  );
end;
$$;

grant execute on function start_test_attempt(uuid) to anon, authenticated;

commit;

-- ---------------------------------------------------------------
-- Тексеру. Тілі толтырылмаған оқушылар бар ма — солар қазақша көреді:
--
--   select s.full_name, s.zipgrade_id, s.language
--   from registrations r
--   join students s on s.id = r.student_id
--   where r.format = 'online' and r.payment_status = 'paid'
--     and (s.language is null or s.language not in ('kk','ru'))
--   order by s.full_name;
--
-- Тізім бос болуы керек. Бос болмаса — тест алдында тілін көрсетіңіз.
-- ---------------------------------------------------------------
