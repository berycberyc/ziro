-- Migration: merge bil_math + bil_reading into ONE subject `bil`
-- with 60 questions — the same move already made for Тілдер.
--
-- Why: БИЛ is one paper of 60 questions (and one ZipGrade sheet). Questions
-- 1–50 are математика-логика, 51–60 оқу сауаттылығы. The student writes it
-- as a single 110-minute block and may move freely between the two parts;
-- only the RESULTS are reported separately.
--
-- Scoring (confirmed against the official БИЛ ranking table):
--   correct +4, wrong −1, blank 0 — applied per part and in total.
--   e.g. 41 correct / 7 wrong in математика = 41×4 − 7 = 157.
--
-- EXISTING DATA IS PRESERVED: оқылым question numbers shift 1–10 → 51–60.
-- Run in Supabase SQL Editor after 048_answer_sheets.sql

begin;

-- ---------------------------------------------------------------
-- 1. Allow the new key everywhere (old keys still allowed for now).
-- ---------------------------------------------------------------
alter table topics drop constraint if exists topics_subject_check;
alter table topics add constraint topics_subject_check check (subject in (
  'math', 'sandyq', 'zharatylystanu', 'tilder',
  'bil', 'bil_math', 'bil_reading', 'rfmsh'
));

alter table passages drop constraint if exists passages_subject_check;
alter table passages add constraint passages_subject_check check (subject in (
  'tilder', 'bil', 'bil_reading'
));

alter table questions drop constraint if exists questions_subject_check;
alter table questions add constraint questions_subject_check check (subject in (
  'math', 'sandyq', 'zharatylystanu', 'tilder',
  'bil', 'bil_math', 'bil_reading', 'rfmsh'
));

alter table answer_sheets drop constraint if exists answer_sheets_subject_check;
alter table answer_sheets add constraint answer_sheets_subject_check check (subject in (
  'math', 'sandyq', 'zharatylystanu', 'tilder',
  'bil', 'bil_math', 'bil_reading', 'rfmsh'
));

-- ---------------------------------------------------------------
-- 2. Shift оқылым numbers BEFORE renaming, or 1–10 would collide
--    with математика's own 1–10 on the unique index.
-- ---------------------------------------------------------------
update questions set question_number = question_number + 50 where subject = 'bil_reading';

-- ---------------------------------------------------------------
-- 3. Merge topics (unique is on (subject, name_kk), so same-named
--    topics under both keys would collide).
-- ---------------------------------------------------------------
with survivors as (
  select distinct on (name_kk) id, name_kk
  from topics
  where subject in ('bil_math', 'bil_reading')
  order by name_kk, subject
),
dupes as (
  select t.id as dupe_id, s.id as keep_id
  from topics t
  join survivors s on s.name_kk = t.name_kk
  where t.subject in ('bil_math', 'bil_reading') and t.id <> s.id
)
update questions q
set topic_id = d.keep_id
from dupes d
where q.topic_id = d.dupe_id;

delete from topics t
using (
  select distinct on (name_kk) id, name_kk
  from topics
  where subject in ('bil_math', 'bil_reading')
  order by name_kk, subject
) s
where t.name_kk = s.name_kk
  and t.subject in ('bil_math', 'bil_reading')
  and t.id <> s.id;

update topics set subject = 'bil' where subject in ('bil_math', 'bil_reading');

-- ---------------------------------------------------------------
-- 4. Move questions, passages and any collected answer sheets.
-- ---------------------------------------------------------------
update questions     set subject = 'bil' where subject in ('bil_math', 'bil_reading');
update passages      set subject = 'bil' where subject = 'bil_reading';
update answer_sheets set subject = 'bil' where subject in ('bil_math', 'bil_reading');

-- ---------------------------------------------------------------
-- 5. Drop the old keys now the data has moved.
-- ---------------------------------------------------------------
alter table topics drop constraint if exists topics_subject_check;
alter table topics add constraint topics_subject_check check (subject in (
  'math', 'sandyq', 'zharatylystanu', 'tilder', 'bil', 'rfmsh'
));

alter table passages drop constraint if exists passages_subject_check;
alter table passages add constraint passages_subject_check check (subject in ('tilder', 'bil'));

alter table questions drop constraint if exists questions_subject_check;
alter table questions add constraint questions_subject_check check (subject in (
  'math', 'sandyq', 'zharatylystanu', 'tilder', 'bil', 'rfmsh'
));

alter table answer_sheets drop constraint if exists answer_sheets_subject_check;
alter table answer_sheets add constraint answer_sheets_subject_check check (subject in (
  'math', 'sandyq', 'zharatylystanu', 'tilder', 'bil', 'rfmsh'
));

-- ---------------------------------------------------------------
-- 6. БИЛ is now a single block.
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
    when 'BIL' then array['bil']
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
    when 'BIL' then array['bil']
    when 'RFMS' then array['rfmsh']
    else array[]::text[]
  end;

  update test_attempts
  set current_subject_index = current_subject_index + 1,
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

create or replace function subject_key_to_label(p_key text)
returns text
language sql
immutable
as $$
  select case p_key
    when 'math' then 'Математика'
    when 'sandyq' then 'Сандық сипаттамалар'
    when 'zharatylystanu' then 'Жаратылыстану'
    when 'tilder' then 'Тілдер'
    when 'bil' then 'БИЛ'
    when 'rfmsh' then 'РФМШ'
    else p_key
  end;
$$;

commit;

-- Проверка — ждём по 60 вопросов на вариант, номера 1..60:
--
--   select variant_number, count(*), min(question_number), max(question_number)
--   from questions where subject = 'bil'
--   group by variant_number order by variant_number;
