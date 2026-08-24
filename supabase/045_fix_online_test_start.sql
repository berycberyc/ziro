-- Migration: fix the online test screen for students.
--
-- Bug: app/test/[registrationId] read test_session_id and test_variant with a
-- plain `select ... from registrations`. Students take the test WITHOUT
-- logging in (anon role), and registrations RLS only allows the owning parent
-- or an admin to select — so that query silently returned nothing, sessionId
-- stayed null, and the "Бастау" button did nothing at all (its handler bails
-- out early when sessionId is missing). Nothing was broken on the DB side;
-- the page was simply asking for data the anon role may not read.
--
-- Fix: start_test_attempt is already security definer, so it can hand those
-- two values back itself. Only the returned JSON changes — no behaviour,
-- no table, no policy is touched.
-- Run in Supabase SQL Editor after 044_app_settings.sql

create or replace function start_test_attempt(p_registration_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reg record;
  v_test_type_code text;
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

  v_test_type_code := v_reg.test_type_code;

  v_blocks := case v_test_type_code
    when 'NIS' then array['math','sandyq','zharatylystanu','tilder_kk','tilder_ru','tilder_en']
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
    -- NEW: the page can no longer read these from registrations directly.
    'session_id', v_reg.test_session_id,
    'variant_number', coalesce(nullif(regexp_replace(coalesce(v_reg.test_variant, ''), '\D', '', 'g'), ''), '1')::int
  );
end;
$$;

grant execute on function start_test_attempt(uuid) to anon, authenticated;
