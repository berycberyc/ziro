-- Migration: make the online test resumable, and stop scoring at submit time.
--
-- Two separate changes, both needed by the rewritten test screen.
--
-- 1) RESUMABLE TIMER. The countdown used to live only in React state, so a
--    page refresh restarted the block with its full time — effectively no
--    time limit at all. The clock now lives in the DB:
--      subject_started_at = null  ->  block not started, show the start screen
--      subject_started_at = <ts>  ->  block running, remaining time is
--                                     minutes - (now - subject_started_at)
--    advance_test_block therefore clears it instead of setting now(), and a
--    new start_subject_timer() sets it exactly once, when the student
--    actually presses the button. Refreshing never restarts the clock, and
--    the break between blocks no longer eats into the next block's time.
--    Every RPC also returns the SERVER time, so changing the device clock
--    cannot buy extra minutes.
--
-- 2) NO SCORING AT SUBMIT. Scoring is moving to one engine that runs over
--    online + offline answers together (НИШ weights depend on the whole
--    cohort, so nothing can be final at the moment one student finishes).
--    submit_test_attempt also looked up the answer key WITHOUT filtering by
--    variant, so with 4 variants live the scores it wrote were arbitrary.
--    It now only records the raw answers as submitted. Nothing is lost:
--    test_attempts.answers holds every answer.
-- Run in Supabase SQL Editor after 046_merge_tilder.sql

begin;

-- ---------------------------------------------------------------
-- 1. Blocks start with no clock; the student's button starts it.
-- ---------------------------------------------------------------
create or replace function advance_test_block(p_registration_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reg record;
  v_blocks text[];
  v_attempt record;
begin
  select r.*, tt.code as test_type_code into v_reg
  from registrations r join test_types tt on tt.id = r.test_type_id
  where r.id = p_registration_id;

  v_blocks := case v_reg.test_type_code
    when 'NIS' then array['math','sandyq','zharatylystanu','tilder']
    when 'BIL' then array['bil_math','bil_reading']
    when 'RFMS' then array['rfmsh']
    else array[]::text[]
  end;

  update test_attempts
  set current_subject_index = current_subject_index + 1,
      -- null = келесі блоктың уақыты әлі басталған жоқ (үзіліс уақыты
      -- блоктың уақытын жемеуі керек)
      subject_started_at = null
  where registration_id = p_registration_id and status = 'in_progress'
  returning * into v_attempt;

  return json_build_object(
    'current_subject_index', v_attempt.current_subject_index,
    'subject_started_at', v_attempt.subject_started_at,
    'is_finished', v_attempt.current_subject_index >= array_length(v_blocks, 1),
    'server_now', now()
  );
end;
$$;

grant execute on function advance_test_block(uuid) to anon, authenticated;

-- Starts the clock for the current block — but only once. A refresh calls
-- this again and gets the ORIGINAL timestamp back, so the countdown
-- continues instead of restarting.
create or replace function start_subject_timer(p_registration_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempt record;
begin
  update test_attempts
  set subject_started_at = now()
  where registration_id = p_registration_id
    and status = 'in_progress'
    and subject_started_at is null;

  select * into v_attempt from test_attempts where registration_id = p_registration_id;
  if not found then
    raise exception 'no_attempt';
  end if;

  return json_build_object(
    'subject_started_at', v_attempt.subject_started_at,
    'server_now', now()
  );
end;
$$;

grant execute on function start_subject_timer(uuid) to anon, authenticated;

-- Consent no longer starts a clock — the student presses "Бастау" for the
-- first block just like for every other one.
create or replace function confirm_test_consent(p_registration_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update test_attempts
  set consent_given_at = now()
  where registration_id = p_registration_id and consent_given_at is null;
$$;

grant execute on function confirm_test_consent(uuid) to anon, authenticated;

-- ---------------------------------------------------------------
-- 2. start_test_attempt also hands back the server clock.
-- ---------------------------------------------------------------
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
begin
  select r.*, tt.code as test_type_code into v_reg
  from registrations r
  join test_types tt on tt.id = r.test_type_id
  where r.id = p_registration_id and r.format = 'online' and r.payment_status = 'paid';

  if not found then
    raise exception 'invalid_registration';
  end if;

  v_blocks := case v_reg.test_type_code
    when 'NIS' then array['math','sandyq','zharatylystanu','tilder']
    when 'BIL' then array['bil_math','bil_reading']
    when 'RFMS' then array['rfmsh']
    else array[]::text[]
  end;

  select * into v_attempt from test_attempts where registration_id = p_registration_id;

  if not found then
    insert into test_attempts (registration_id, current_subject_index)
    values (p_registration_id, 0)
    returning * into v_attempt;
  end if;

  return json_build_object(
    'attempt_id', v_attempt.id,
    'status', v_attempt.status,
    'consent_given_at', v_attempt.consent_given_at,
    'blocks', v_blocks,
    'current_subject_index', v_attempt.current_subject_index,
    'subject_started_at', v_attempt.subject_started_at,
    'answers', v_attempt.answers,
    'session_id', v_reg.test_session_id,
    'variant_number', coalesce(nullif(regexp_replace(coalesce(v_reg.test_variant, ''), '\D', '', 'g'), ''), '1')::int,
    'server_now', now()
  );
end;
$$;

grant execute on function start_test_attempt(uuid) to anon, authenticated;

-- ---------------------------------------------------------------
-- 3. Submit records raw answers only — no scoring here any more.
-- ---------------------------------------------------------------
create or replace function submit_test_attempt(p_registration_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update test_attempts
  set status = 'submitted', submitted_at = now()
  where registration_id = p_registration_id and status = 'in_progress';
end;
$$;

grant execute on function submit_test_attempt(uuid) to anon, authenticated;

commit;
