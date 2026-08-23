-- Fix: submit_test_attempt was writing the raw internal subject key
-- (e.g. "math", "tilder_kk") into results.subject_label, but a manually
-- uploaded offline results file would naturally use a human label like
-- "Математика" — these wouldn't group together in the ranking. This maps
-- each key to a clean label before writing.
-- Run in Supabase SQL Editor after 033_online_test_taking.sql

create or replace function subject_key_to_label(p_key text)
returns text
language sql
immutable
as $$
  select case p_key
    when 'math' then 'Математика'
    when 'sandyq' then 'Сандық сипаттамалар'
    when 'zharatylystanu' then 'Жаратылыстану'
    when 'tilder_kk' then 'Тілдер (қазақ)'
    when 'tilder_ru' then 'Тілдер (орыс)'
    when 'tilder_en' then 'Тілдер (ағылшын)'
    when 'bil_math' then 'БИЛ — математика'
    when 'bil_reading' then 'БИЛ — оқылым'
    when 'rfmsh' then 'РФМШ'
    else p_key
  end;
$$;

create or replace function submit_test_attempt(p_registration_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempt record;
  v_student_zipgrade text;
  v_session_id uuid;
  v_subject text;
  v_qnum text;
  v_given text;
  v_q record;
  v_correct boolean;
  v_total int;
  v_correct_count int;
begin
  select * into v_attempt from test_attempts where registration_id = p_registration_id;
  if not found then
    raise exception 'no_attempt';
  end if;

  select s.zipgrade_id, r.test_session_id into v_student_zipgrade, v_session_id
  from registrations r join students s on s.id = r.student_id
  where r.id = p_registration_id;

  for v_subject in select jsonb_object_keys(v_attempt.answers) loop
    v_total := 0;
    v_correct_count := 0;

    for v_qnum in select jsonb_object_keys(v_attempt.answers->v_subject) loop
      v_given := v_attempt.answers->v_subject->>v_qnum;
      v_total := v_total + 1;

      select * into v_q from questions
      where session_id = v_session_id and subject = v_subject
        and question_number = v_qnum::int
      limit 1;

      if not found then
        continue;
      end if;

      v_correct := false;
      if v_q.answer_format = 'numeric' then
        v_correct := (v_given is not null and v_given = v_q.correct_answer);
      elsif v_q.answer_format = 'quantity' then
        v_correct := (v_given is not null and v_given = v_q.correct_answer);
      else
        if v_given in ('A','B','C','D') then
          v_correct := coalesce(
            (v_q.choices -> (ascii(v_given) - ascii('A')) ->> 'correct')::boolean,
            false
          );
        end if;
      end if;

      if v_correct then
        v_correct_count := v_correct_count + 1;
      end if;
    end loop;

    if v_total > 0 and v_student_zipgrade is not null then
      insert into results (test_session_id, zipgrade_id, subject_label, score)
      values (v_session_id, v_student_zipgrade, subject_key_to_label(v_subject), round(100.0 * v_correct_count / v_total, 1))
      on conflict (test_session_id, zipgrade_id, subject_label)
      do update set score = excluded.score;
    end if;
  end loop;

  update test_attempts set status = 'submitted', submitted_at = now()
  where registration_id = p_registration_id;
end;
$$;
