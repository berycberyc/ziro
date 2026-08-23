-- Migration: online test-taking flow (public, no parent login — access is
-- validated via registration_id which the student obtained through /kiru).
-- Run in Supabase SQL Editor after 032_online_entry_lookup.sql

-- 1. Attempt state
create table if not exists test_attempts (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null unique references registrations(id) on delete cascade,
  status text not null default 'in_progress' check (status in ('in_progress', 'submitted')),
  consent_given_at timestamptz,
  current_subject_index int not null default 0,
  subject_started_at timestamptz,
  answers jsonb not null default '{}'::jsonb, -- { "math": {"1": "A", "2": ""}, ... }
  created_at timestamptz not null default now(),
  submitted_at timestamptz
);

alter table test_attempts enable row level security;
-- No direct table policies for anon — all access goes through the
-- security-definer RPC functions below, which validate against
-- registration_id instead of auth.uid() (there is no parent login here).

-- 2. Public-safe question view — strips correct_answer and the `correct`
-- flag from each choice, so the browser never receives the answer key.
create or replace view questions_public as
select
  q.id, q.session_id, q.subject, q.variant_number, q.question_number,
  q.topic_id, q.passage_id, q.text_kk, q.text_ru, q.image_url, q.answer_format,
  (
    select jsonb_agg(jsonb_build_object('text_kk', c->>'text_kk', 'text_ru', c->>'text_ru') order by ord)
    from jsonb_array_elements(q.choices) with ordinality as arr(c, ord)
  ) as choices,
  q.column_a_kk, q.column_a_ru, q.column_b_kk, q.column_b_ru
from questions q;

grant select on questions_public to anon, authenticated;

-- Passages have no secret answer data, so a direct public read policy is fine.
drop policy if exists "Admins manage passages" on passages;
create policy "Admins manage passages" on passages
  for all using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));
create policy "Anyone can view passages" on passages
  for select using (true);

-- 3. Start or resume an attempt. Validates the registration is a paid
-- online booking. Returns the ordered subject block list + current state.
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
    'answers', v_attempt.answers
  );
end;
$$;

grant execute on function start_test_attempt(uuid) to anon, authenticated;

-- 4. Record consent + mark the first subject as started.
create or replace function confirm_test_consent(p_registration_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update test_attempts
  set consent_given_at = now(), subject_started_at = now()
  where registration_id = p_registration_id and consent_given_at is null;
$$;

grant execute on function confirm_test_consent(uuid) to anon, authenticated;

-- 5. Save a single answer (or blank, from the anti-cheat leave-rule).
create or replace function save_test_answer(
  p_registration_id uuid, p_subject text, p_question_number int, p_answer text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update test_attempts
  set answers = jsonb_set(
    jsonb_set(answers, array[p_subject], coalesce(answers->p_subject, '{}'::jsonb), true),
    array[p_subject, p_question_number::text],
    to_jsonb(coalesce(p_answer, '')),
    true
  )
  where registration_id = p_registration_id and status = 'in_progress';
end;
$$;

grant execute on function save_test_answer(uuid, text, int, text) to anon, authenticated;

-- 6. Move to the next subject block (or finish, if that was the last one).
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
    when 'NIS' then array['math','sandyq','zharatylystanu','tilder_kk','tilder_ru','tilder_en']
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

-- 7. Final submit — scores every answered question against the real
-- answer key (server-side only, never sent to the browser), writes a
-- per-subject score into `results` (feeding the existing ranking screen),
-- and marks the attempt submitted.
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
        -- abcd: v_given is a letter A/B/C/D — map to index and check choices[i].correct
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
      values (v_session_id, v_student_zipgrade, v_subject, round(100.0 * v_correct_count / v_total, 1))
      on conflict (test_session_id, zipgrade_id, subject_label)
      do update set score = excluded.score;
    end if;
  end loop;

  update test_attempts set status = 'submitted', submitted_at = now()
  where registration_id = p_registration_id;
end;
$$;

grant execute on function submit_test_attempt(uuid) to anon, authenticated;
