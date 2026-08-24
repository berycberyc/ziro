-- Migration: merge tilder_kk / tilder_ru / tilder_en into ONE subject
-- `tilder` with 60 questions.
--
-- Why: Тілдер is one 60-question paper in reality (and one ZipGrade sheet,
-- Key numbering 1–60). Keeping three separate 20-question subjects forced
-- the test screen to stitch them together and to translate "question 25"
-- into "русский, вопрос 5" — an extra layer that can only introduce bugs.
-- After this migration the numbering is straight 1–60 everywhere, and the
-- split into three 200-point scores happens ONLY at scoring time, by range:
--   1–20 қазақ тілі, 21–40 орыс тілі, 41–60 ағылшын тілі.
--
-- Тілдер is also monolingual from now on: each language section is written
-- in its own language, so there is nothing to translate. text_kk / the kk
-- passage field hold the single text; the _ru fields are kept in sync so
-- nothing breaks for readers that still look at them.
--
-- EXISTING DATA IS PRESERVED: question numbers are shifted, not deleted.
-- Run in Supabase SQL Editor after 045_fix_online_test_start.sql

begin;

-- ---------------------------------------------------------------
-- 1. Allow the new key in every CHECK constraint (old keys stay
--    allowed until the data has moved).
-- ---------------------------------------------------------------
alter table topics drop constraint if exists topics_subject_check;
alter table topics add constraint topics_subject_check check (subject in (
  'math', 'sandyq', 'zharatylystanu',
  'tilder', 'tilder_kk', 'tilder_ru', 'tilder_en',
  'bil_math', 'bil_reading', 'rfmsh'
));

alter table passages drop constraint if exists passages_subject_check;
alter table passages add constraint passages_subject_check check (subject in (
  'tilder', 'tilder_kk', 'tilder_ru', 'tilder_en', 'bil_reading'
));

alter table questions drop constraint if exists questions_subject_check;
alter table questions add constraint questions_subject_check check (subject in (
  'math', 'sandyq', 'zharatylystanu',
  'tilder', 'tilder_kk', 'tilder_ru', 'tilder_en',
  'bil_math', 'bil_reading', 'rfmsh'
));

-- ---------------------------------------------------------------
-- 2. Shift question numbers BEFORE renaming the subject, otherwise
--    three questions numbered 1 would collide on the unique index
--    (session_id, subject, variant_number, question_number).
--    Order: en first, then ru — so the +20 shift never lands on a
--    number the other group is about to vacate.
-- ---------------------------------------------------------------
update questions set question_number = question_number + 40 where subject = 'tilder_en';
update questions set question_number = question_number + 20 where subject = 'tilder_ru';

-- Passages have no question_number, only order_number (display order).
-- Same idea: keep kk first, then ru, then en.
update passages set order_number = order_number + 200 where subject = 'tilder_en';
update passages set order_number = order_number + 100 where subject = 'tilder_ru';

-- ---------------------------------------------------------------
-- 3. Merge topics. `topics` has unique (subject, name), so the same
--    topic name under two language keys would collide. Re-point the
--    questions at one surviving topic first, then drop the duplicates.
-- ---------------------------------------------------------------
with survivors as (
  select distinct on (name) id, name
  from topics
  where subject in ('tilder_kk', 'tilder_ru', 'tilder_en')
  order by name, subject   -- deterministic: _en < _kk < _ru alphabetically
),
dupes as (
  select t.id as dupe_id, s.id as keep_id
  from topics t
  join survivors s on s.name = t.name
  where t.subject in ('tilder_kk', 'tilder_ru', 'tilder_en')
    and t.id <> s.id
)
update questions q
set topic_id = d.keep_id
from dupes d
where q.topic_id = d.dupe_id;

delete from topics t
using (
  select distinct on (name) id, name
  from topics
  where subject in ('tilder_kk', 'tilder_ru', 'tilder_en')
  order by name, subject
) s
where t.name = s.name
  and t.subject in ('tilder_kk', 'tilder_ru', 'tilder_en')
  and t.id <> s.id;

update topics set subject = 'tilder'
where subject in ('tilder_kk', 'tilder_ru', 'tilder_en');

-- ---------------------------------------------------------------
-- 4. Move the questions and passages themselves.
-- ---------------------------------------------------------------
update questions set subject = 'tilder'
where subject in ('tilder_kk', 'tilder_ru', 'tilder_en');

update passages set subject = 'tilder'
where subject in ('tilder_kk', 'tilder_ru', 'tilder_en');

-- Monolingual from here on: keep the _ru copy identical to the _kk one so
-- nothing shows an empty box, whichever field a screen happens to read.
update questions set text_ru = text_kk
where subject = 'tilder' and (text_ru is null or text_ru = '' or text_ru <> text_kk);

update passages set passage_text_ru = passage_text_kk
where subject = 'tilder'
  and (passage_text_ru is null or passage_text_ru = '' or passage_text_ru <> passage_text_kk);

-- ---------------------------------------------------------------
-- 5. Drop the old keys from the CHECK constraints now the data is clean.
-- ---------------------------------------------------------------
alter table topics drop constraint topics_subject_check;
alter table topics add constraint topics_subject_check check (subject in (
  'math', 'sandyq', 'zharatylystanu', 'tilder',
  'bil_math', 'bil_reading', 'rfmsh'
));

alter table passages drop constraint passages_subject_check;
alter table passages add constraint passages_subject_check check (subject in (
  'tilder', 'bil_reading'
));

alter table questions drop constraint questions_subject_check;
alter table questions add constraint questions_subject_check check (subject in (
  'math', 'sandyq', 'zharatylystanu', 'tilder',
  'bil_math', 'bil_reading', 'rfmsh'
));

-- ---------------------------------------------------------------
-- 6. НИШ is now 4 blocks instead of 6.
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
    'variant_number', coalesce(nullif(regexp_replace(coalesce(v_reg.test_variant, ''), '\D', '', 'g'), ''), '1')::int
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
    when 'BIL' then array['bil_math','bil_reading']
    when 'RFMS' then array['rfmsh']
    else array[]::text[]
  end;

  update test_attempts
  set current_subject_index = current_subject_index + 1,
      subject_started_at = now()
  where registration_id = p_registration_id and status = 'in_progress'
  returning * into v_attempt;

  return json_build_object(
    'current_subject_index', v_attempt.current_subject_index,
    'subject_started_at', v_attempt.subject_started_at,
    'is_finished', v_attempt.current_subject_index >= array_length(v_blocks, 1)
  );
end;
$$;

grant execute on function advance_test_block(uuid) to anon, authenticated;

-- ---------------------------------------------------------------
-- 7. Label used when a score is written into `results`.
-- ---------------------------------------------------------------
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
    when 'tilder_kk' then 'Тілдер (қазақ)'
    when 'tilder_ru' then 'Тілдер (орыс)'
    when 'tilder_en' then 'Тілдер (ағылшын)'
    when 'bil_math' then 'БИЛ — математика'
    when 'bil_reading' then 'БИЛ — оқылым'
    when 'rfmsh' then 'РФМШ'
    else p_key
  end;
$$;

commit;

-- ---------------------------------------------------------------
-- Check afterwards — expect one row per variant with 60 questions
-- numbered 1..60 and no gaps:
--
--   select variant_number, count(*), min(question_number), max(question_number)
--   from questions
--   where subject = 'tilder'
--   group by variant_number order by variant_number;
-- ---------------------------------------------------------------
