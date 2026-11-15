-- Migration: НЗМ/БИЛ олимпиадасының 1-туры (/olimpiad).
--
-- БӘРІ БӨЛЕК: олимпиада сайттың әдеттегі жұмысына (брондау, төлем,
-- онлайн тест, нәтижелер, есептер) мүлде тимейді.
--   * өз кестелері: olympiad, olympiad_questions, olympiad_key,
--     olympiad_participants;
--   * өз функциялары: olympiad_*;
--   * өз рөлі: 'olimp_teacher' (бұрынғы 'teacher' рөліне қатысы жоқ);
--   * өз суреттер қоймасы: 'olympiad-images'.
-- Әдеттегі деректерден тек ата-ана аккаунты (profiles) мен оқушы
-- (students) ортақ — олимпиадаға тіркелген ата-ана сайттың қалыпты
-- ата-анасы болады.
--
-- Run in Supabase SQL Editor after 067_photo_answer_sheets.sql.
--
-- Ұйымдастырушы аккаунтын ашу (бір рет):
--   1) Supabase → Authentication → Users → Add user → Create new user:
--      email: olimp_teacher@teacher.com, құпиясөз, «Auto Confirm User» белгісі.
--   2) SQL Editor:
--      update profiles set role = 'olimp_teacher'
--      where id = (select id from auth.users where email = 'olimp_teacher@teacher.com');
--   Өшіру: role-ді 'parent' етіп қайтару немесе Authentication-та «Ban user».

begin;

-- ---------------------------------------------------------------
-- 1. Рөл: 'olimp_teacher'. (064 сияқты: ескі шектеуді тауып, жаңасын қоямыз.)
-- ---------------------------------------------------------------
do $$
declare
  c record;
begin
  for c in
    select conname
    from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%role%parent%'
  loop
    execute format('alter table public.profiles drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('parent', 'teacher', 'admin', 'accountant', 'olimp_teacher'));

-- Олимпиаданы басқара алатындар: ұйымдастырушы және біздің әкімші.
create or replace function is_olimp_staff()
returns boolean as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('olimp_teacher', 'admin')
  );
$$ language sql security definer stable set search_path = public;

-- ---------------------------------------------------------------
-- 2. Олимпиада баптаулары. Олимпиада біреу ғана — бір жол (id = 1).
--    Уақыттың бәрі timestamptz; сайт Астана уақытымен (+05:00) жібереді.
-- ---------------------------------------------------------------
create table if not exists olympiad (
  id int primary key default 1 check (id = 1),
  text1_kk text not null default '',
  text1_ru text not null default '',
  text2_kk text not null default '',
  text2_ru text not null default '',
  registration_open boolean not null default false,
  registration_closes_at timestamptz,
  starts_at timestamptz,
  ends_at timestamptz,
  -- Беттен N рет шыққанда тест өзі аяқталады. null — өшірулі.
  max_leaves int check (max_leaves is null or max_leaves > 0),
  results_published_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint olympiad_window_check
    check (starts_at is null or ends_at is null or ends_at > starts_at)
);

insert into olympiad (id) values (1) on conflict (id) do nothing;

alter table olympiad enable row level security;

drop policy if exists "Olimp staff view olympiad" on olympiad;
create policy "Olimp staff view olympiad" on olympiad
  for select using (is_olimp_staff());

drop policy if exists "Olimp staff update olympiad" on olympiad;
create policy "Olimp staff update olympiad" on olympiad
  for update using (is_olimp_staff()) with check (is_olimp_staff());

-- Олимпиада басталғаннан кейін уақытын өзгертуге болмайды.
-- Нәтиже жарияланған уақытты тек olympiad_publish() қояды.
create or replace function guard_olympiad()
returns trigger as $$
begin
  if old.starts_at is not null and old.starts_at <= now()
     and (new.starts_at is distinct from old.starts_at
          or new.ends_at is distinct from old.ends_at) then
    raise exception 'olympiad_time_locked';
  end if;

  if new.results_published_at is distinct from old.results_published_at
     and coalesce(current_setting('ziro.olympiad_publish', true), '') <> 'on' then
    new.results_published_at := old.results_published_at;
  end if;

  new.updated_at := now();
  return new;
end;
$$ language plpgsql set search_path = public;

drop trigger if exists trg_guard_olympiad on olympiad;
create trigger trg_guard_olympiad
  before update on olympiad
  for each row execute function guard_olympiad();

create or replace function olympiad_not_started()
returns boolean as $$
  select coalesce((select starts_at is null or starts_at > now() from olympiad where id = 1), true);
$$ language sql security definer stable set search_path = public;

create or replace function olympiad_ended()
returns boolean as $$
  select coalesce((select ends_at is not null and ends_at <= now() from olympiad where id = 1), false);
$$ language sql security definer stable set search_path = public;

-- ---------------------------------------------------------------
-- 3. Тапсырмалар (кілтсіз). Браузерден оқушыға ТІКЕЛЕЙ ашылмайды —
--    тек olympiad_start() арқылы, олимпиада уақытында.
--    Олимпиада басталғаннан кейін өзгертуге болмайды.
-- ---------------------------------------------------------------
create table if not exists olympiad_questions (
  number int primary key check (number between 1 and 200),
  kind text not null check (kind in ('abcd', 'open')),
  text_kk text not null default '',
  text_ru text not null default '',
  image_url text,
  image_url_ru text,
  -- [{ "kk": "...", "ru": "..." }, ...] — Word-тағы ретімен (A, B, C, D).
  choices jsonb not null default '[]'::jsonb
);

alter table olympiad_questions enable row level security;

drop policy if exists "Olimp staff view questions" on olympiad_questions;
create policy "Olimp staff view questions" on olympiad_questions
  for select using (is_olimp_staff());

drop policy if exists "Olimp staff insert questions" on olympiad_questions;
create policy "Olimp staff insert questions" on olympiad_questions
  for insert with check (is_olimp_staff() and olympiad_not_started());

drop policy if exists "Olimp staff update questions" on olympiad_questions;
create policy "Olimp staff update questions" on olympiad_questions
  for update using (is_olimp_staff() and olympiad_not_started())
  with check (is_olimp_staff() and olympiad_not_started());

drop policy if exists "Olimp staff delete questions" on olympiad_questions;
create policy "Olimp staff delete questions" on olympiad_questions
  for delete using (is_olimp_staff() and olympiad_not_started());

-- ---------------------------------------------------------------
-- 4. Кілт. Тек олимпиада АЯҚТАЛҒАННАН кейін жүктеледі — олимпиада
--    кезінде серверде кілт мүлде болмайды.
-- ---------------------------------------------------------------
create table if not exists olympiad_key (
  number int primary key,
  answers text[] not null default '{}',
  points numeric not null default 1 check (points >= 0),
  voided boolean not null default false
);

alter table olympiad_key enable row level security;

drop policy if exists "Olimp staff view key" on olympiad_key;
create policy "Olimp staff view key" on olympiad_key
  for select using (is_olimp_staff());

drop policy if exists "Olimp staff insert key" on olympiad_key;
create policy "Olimp staff insert key" on olympiad_key
  for insert with check (is_olimp_staff() and olympiad_ended());

drop policy if exists "Olimp staff update key" on olympiad_key;
create policy "Olimp staff update key" on olympiad_key
  for update using (is_olimp_staff() and olympiad_ended())
  with check (is_olimp_staff() and olympiad_ended());

drop policy if exists "Olimp staff delete key" on olympiad_key;
create policy "Olimp staff delete key" on olympiad_key
  for delete using (is_olimp_staff() and olympiad_ended());

-- ---------------------------------------------------------------
-- 5. Қатысушылар және олардың жауаптары. Ешкімге тікелей ашылмайды
--    (ереже жоқ) — бәрі төмендегі функциялар арқылы.
-- ---------------------------------------------------------------
create table if not exists olympiad_participants (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null unique references students(id) on delete cascade,
  parent_id uuid not null,
  -- Олимпиадаға кіру коды (6 сан). Оқушы ID-мен бірге енгізіледі.
  code text not null unique,
  -- Тест бетінің құпия кілті: кодпен кіргенде беріледі.
  token uuid not null unique default gen_random_uuid(),
  lang text not null default 'kk' check (lang in ('kk', 'ru')),
  consent_given_at timestamptz not null default now(),
  consent_text_kk text not null,
  consent_text_ru text not null,
  created_at timestamptz not null default now(),

  started_at timestamptz,
  finished_at timestamptz,
  finish_reason text,                    -- 'student' | 'leaves'
  question_order int[],                  -- әр оқушыға өз реті
  choice_order jsonb,                    -- { "5": [2,0,3,1], ... }
  answers jsonb not null default '{}'::jsonb,  -- { "5": "B", "6": "12,5" } — Word-тағы әріппен

  leave_count int not null default 0,
  leave_seconds int not null default 0,
  offline_count int not null default 0,
  offline_seconds int not null default 0,
  events jsonb not null default '[]'::jsonb,

  passed boolean not null default false
);

create index if not exists olympiad_participants_parent_idx on olympiad_participants(parent_id);

alter table olympiad_participants enable row level security;

create or replace function olympiad_new_code()
returns text as $$
declare
  result text;
  attempt int := 0;
begin
  loop
    result := lpad(floor(random() * 1000000)::text, 6, '0');
    exit when not exists (select 1 from olympiad_participants where code = result);
    attempt := attempt + 1;
    if attempt > 50 then
      raise exception 'code_generation_failed';
    end if;
  end loop;
  return result;
end;
$$ language plpgsql set search_path = public;

-- ---------------------------------------------------------------
-- 6. Бәріне ашық ақпарат (/olimpiad беті).
-- ---------------------------------------------------------------
create or replace function olympiad_public_info()
returns jsonb as $$
  select jsonb_build_object(
    'text1_kk', o.text1_kk,
    'text1_ru', o.text1_ru,
    'registration_open',
      o.registration_open
      and (o.registration_closes_at is null or now() < o.registration_closes_at)
      and (o.starts_at is null or now() < o.starts_at),
    'registration_closes_at', o.registration_closes_at,
    'starts_at', o.starts_at,
    'ends_at', o.ends_at,
    'results_published', o.results_published_at is not null,
    'server_now', now()
  )
  from olympiad o
  where o.id = 1;
$$ language sql security definer stable set search_path = public;

grant execute on function olympiad_public_info() to anon, authenticated;

-- ---------------------------------------------------------------
-- 7. Ата-ана: оқушыны тіркеу және өз тіркеулерін көру.
-- ---------------------------------------------------------------
create or replace function olympiad_register(
  p_student_id uuid,
  p_lang text,
  p_confirm_grade6 boolean,
  p_consent_kk text,
  p_consent_ru text
)
returns text as $$
declare
  v_uid uuid := auth.uid();
  v_o olympiad%rowtype;
  v_s students%rowtype;
  v_code text;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  select * into v_o from olympiad where id = 1;
  if not (v_o.registration_open
          and (v_o.registration_closes_at is null or now() < v_o.registration_closes_at)
          and (v_o.starts_at is null or now() < v_o.starts_at)) then
    raise exception 'registration_closed';
  end if;

  select * into v_s from students where id = p_student_id;
  if not found or v_s.parent_id is distinct from v_uid then
    raise exception 'not_your_student';
  end if;

  select code into v_code from olympiad_participants where student_id = p_student_id;
  if v_code is not null then
    return v_code;
  end if;

  if coalesce(trim(v_s.grade), '') <> '6' then
    if coalesce(p_confirm_grade6, false) then
      -- Ата-ана баласының қазір 6-сыныпта екенін растады (карточкадағы
      -- сынып өткен жылдан қалған болуы мүмкін).
      update students set grade = '6' where id = p_student_id;
    else
      raise exception 'grade_not_6';
    end if;
  end if;

  if coalesce(trim(p_consent_kk), '') = '' or coalesce(trim(p_consent_ru), '') = '' then
    raise exception 'consent_required';
  end if;

  v_code := olympiad_new_code();

  insert into olympiad_participants (
    student_id, parent_id, code, lang, consent_text_kk, consent_text_ru
  ) values (
    p_student_id, v_uid, v_code,
    case when p_lang = 'ru' then 'ru' else 'kk' end,
    p_consent_kk, p_consent_ru
  );

  return v_code;
end;
$$ language plpgsql security definer set search_path = public;

grant execute on function olympiad_register(uuid, text, boolean, text, text) to authenticated;

create or replace function olympiad_my_registrations()
returns table (
  student_id uuid,
  full_name text,
  zipgrade_id text,
  code text,
  lang text,
  result text            -- null: әлі жарияланбаған; 'passed' / 'not_passed'
) as $$
  select
    p.student_id,
    coalesce(nullif(trim(s.full_name), ''), trim(concat(s.first_name, ' ', s.last_name))),
    s.zipgrade_id,
    p.code,
    p.lang,
    case
      when (select results_published_at from olympiad where id = 1) is null then null
      when p.passed then 'passed'
      else 'not_passed'
    end
  from olympiad_participants p
  join students s on s.id = p.student_id
  where p.parent_id = auth.uid()
  order by p.created_at;
$$ language sql security definer stable set search_path = public;

grant execute on function olympiad_my_registrations() to authenticated;

-- 2-мәтін (олимпиада күні не істеу керек) — тек оқушысын тіркеген ата-анаға.
create or replace function olympiad_my_text2()
returns jsonb as $$
  select case
    when exists (select 1 from olympiad_participants where parent_id = auth.uid())
    then (select jsonb_build_object('kk', text2_kk, 'ru', text2_ru) from olympiad where id = 1)
    else null
  end;
$$ language sql security definer stable set search_path = public;

grant execute on function olympiad_my_text2() to authenticated;

-- ---------------------------------------------------------------
-- 8. Оқушы: кіру және тест.
-- ---------------------------------------------------------------
create or replace function olympiad_enter(p_zipgrade_id text, p_code text)
returns uuid as $$
  select p.token
  from olympiad_participants p
  join students s on s.id = p.student_id
  where s.zipgrade_id = trim(p_zipgrade_id)
    and p.code = trim(p_code)
  limit 1;
$$ language sql security definer stable set search_path = public;

grant execute on function olympiad_enter(text, text) to anon, authenticated;

create or replace function olympiad_state(p_token uuid)
returns jsonb as $$
declare
  v_p olympiad_participants%rowtype;
  v_o olympiad%rowtype;
  v_name text;
begin
  select * into v_p from olympiad_participants where token = p_token;
  if not found then
    raise exception 'not_found';
  end if;
  select * into v_o from olympiad where id = 1;
  select coalesce(nullif(trim(full_name), ''), trim(concat(first_name, ' ', last_name)))
    into v_name from students where id = v_p.student_id;

  return jsonb_build_object(
    'server_now', now(),
    'starts_at', v_o.starts_at,
    'ends_at', v_o.ends_at,
    'lang', v_p.lang,
    'student_name', v_name,
    'question_count', (select count(*) from olympiad_questions),
    'started', v_p.started_at is not null,
    'finished', v_p.finished_at is not null,
    'finish_reason', v_p.finish_reason,
    'leave_count', v_p.leave_count,
    'max_leaves', v_o.max_leaves
  );
end;
$$ language plpgsql security definer stable set search_path = public;

grant execute on function olympiad_state(uuid) to anon, authenticated;

-- Тестті бастау / жалғастыру. Сұрақтар мен жауап нұсқаларының реті
-- бірінші кіргенде араластырылып сақталады — қайта кірсе, реті сол.
-- Оқушыға жауап нұсқасының Word-тағы әрпі көрсетілмейді: ол экрандағы
-- әріппен жауап береді, сервер оны Word-тағы әріпке аударып сақтайды.
create or replace function olympiad_start(p_token uuid)
returns jsonb as $$
declare
  v_p olympiad_participants%rowtype;
  v_o olympiad%rowtype;
  v_order int[];
  v_choice jsonb;
  r record;
  v_questions jsonb;
  v_answers jsonb;
begin
  select * into v_p from olympiad_participants where token = p_token for update;
  if not found then
    raise exception 'not_found';
  end if;
  select * into v_o from olympiad where id = 1;

  if v_p.finished_at is not null then
    return jsonb_build_object('finished', true, 'finish_reason', v_p.finish_reason);
  end if;
  if v_o.starts_at is null or now() < v_o.starts_at then
    raise exception 'not_started';
  end if;
  if now() >= v_o.ends_at then
    return jsonb_build_object('finished', true, 'finish_reason', 'time');
  end if;

  if v_p.question_order is null then
    select array_agg(number order by random()) into v_order from olympiad_questions;
    v_choice := '{}'::jsonb;
    for r in select number, jsonb_array_length(choices) as n
             from olympiad_questions where kind = 'abcd' loop
      v_choice := v_choice || jsonb_build_object(
        r.number::text,
        (select jsonb_agg(i order by random()) from generate_series(0, r.n - 1) as i)
      );
    end loop;

    update olympiad_participants
      set question_order = coalesce(v_order, '{}'),
          choice_order = v_choice,
          started_at = now()
      where id = v_p.id;

    v_p.question_order := coalesce(v_order, '{}');
    v_p.choice_order := v_choice;
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'n', q.number,
      'kind', q.kind,
      'text', case when v_p.lang = 'ru' and q.text_ru <> '' then q.text_ru else q.text_kk end,
      'image', case when v_p.lang = 'ru' then coalesce(q.image_url_ru, q.image_url) else q.image_url end,
      'choices', case when q.kind = 'abcd' then (
        select coalesce(jsonb_agg(
          case when v_p.lang = 'ru' and coalesce(q.choices -> (ord.idx::int) ->> 'ru', '') <> ''
               then q.choices -> (ord.idx::int) ->> 'ru'
               else q.choices -> (ord.idx::int) ->> 'kk' end
          order by ord.pos), '[]'::jsonb)
        from jsonb_array_elements_text(v_p.choice_order -> (q.number::text)) with ordinality as ord(idx, pos)
      ) else '[]'::jsonb end
    )
    order by array_position(v_p.question_order, q.number)
  ), '[]'::jsonb)
  into v_questions
  from olympiad_questions q;

  -- Сақталған жауаптарды экрандағы әріпке аударамыз.
  select coalesce(jsonb_object_agg(a.key,
    case when q.kind = 'abcd' then (
      select chr(64 + ord.pos::int)
      from jsonb_array_elements_text(v_p.choice_order -> a.key) with ordinality as ord(idx, pos)
      where ord.idx::int = ascii(a.value) - 65
    ) else a.value end
  ), '{}'::jsonb)
  into v_answers
  from jsonb_each_text(v_p.answers) a
  join olympiad_questions q on q.number::text = a.key;

  return jsonb_build_object(
    'finished', false,
    'server_now', now(),
    'ends_at', v_o.ends_at,
    'questions', v_questions,
    'answers', v_answers,
    'leave_count', v_p.leave_count,
    'max_leaves', v_o.max_leaves
  );
end;
$$ language plpgsql security definer set search_path = public;

grant execute on function olympiad_start(uuid) to anon, authenticated;

-- Жауапты сақтау. Оқушы әр басқанда шақырылады.
-- Аяқталу уақытынан кейін қабылданбайды (желі кідірісіне 15 секунд:
-- оқушының экраны дәл уақытында жабылады, бұл тек жолдағы сұраулар үшін).
create or replace function olympiad_save_answer(p_token uuid, p_number int, p_value text)
returns void as $$
declare
  v_p olympiad_participants%rowtype;
  v_o olympiad%rowtype;
  v_kind text;
  v_pos int;
  v_orig int;
  v_value text := trim(coalesce(p_value, ''));
begin
  select * into v_p from olympiad_participants where token = p_token for update;
  if not found then
    raise exception 'not_found';
  end if;
  select * into v_o from olympiad where id = 1;

  if v_p.started_at is null then
    raise exception 'not_started';
  end if;
  if v_p.finished_at is not null then
    raise exception 'attempt_closed';
  end if;
  if now() > v_o.ends_at + interval '15 seconds' then
    raise exception 'deadline_passed';
  end if;

  select kind into v_kind from olympiad_questions where number = p_number;
  if v_kind is null then
    raise exception 'bad_question';
  end if;

  if v_value = '' then
    update olympiad_participants set answers = answers - p_number::text where id = v_p.id;
    return;
  end if;

  if v_kind = 'abcd' then
    if v_value !~ '^[A-D]$' then
      raise exception 'bad_answer';
    end if;
    v_pos := ascii(v_value) - 65;
    v_orig := (v_p.choice_order -> (p_number::text) ->> v_pos)::int;
    if v_orig is null then
      raise exception 'bad_answer';
    end if;
    v_value := chr(65 + v_orig);
  else
    v_value := left(v_value, 200);
  end if;

  update olympiad_participants
    set answers = answers || jsonb_build_object(p_number::text, v_value)
    where id = v_p.id;
end;
$$ language plpgsql security definer set search_path = public;

grant execute on function olympiad_save_answer(uuid, int, text) to anon, authenticated;

-- Беттен шығу / интернет үзілуі.
--   'leave'   — беттен шықты (қай сұрақта тұрғаны);
--   'return'  — қайта оралды, p_seconds — қанша уақыт болмады;
--   'offline' — интернет болмады, p_seconds — қанша уақыт.
create or replace function olympiad_log_event(
  p_token uuid,
  p_kind text,
  p_number int,
  p_seconds int
)
returns jsonb as $$
declare
  v_p olympiad_participants%rowtype;
  v_o olympiad%rowtype;
  v_secs int := least(greatest(coalesce(p_seconds, 0), 0), 7200);
  v_event jsonb;
begin
  select * into v_p from olympiad_participants where token = p_token for update;
  if not found then
    raise exception 'not_found';
  end if;
  select * into v_o from olympiad where id = 1;

  if v_p.started_at is null or v_p.finished_at is not null
     or now() > v_o.ends_at + interval '15 seconds' then
    return jsonb_build_object('finished', v_p.finished_at is not null, 'leave_count', v_p.leave_count);
  end if;

  v_event := jsonb_build_object('k', p_kind, 'at', now(), 'q', p_number, 's', v_secs);

  if p_kind = 'leave' then
    v_p.leave_count := v_p.leave_count + 1;
  elsif p_kind = 'return' then
    v_p.leave_seconds := v_p.leave_seconds + v_secs;
  elsif p_kind = 'offline' then
    v_p.offline_count := v_p.offline_count + 1;
    v_p.offline_seconds := v_p.offline_seconds + v_secs;
  else
    raise exception 'bad_kind';
  end if;

  if p_kind = 'leave' and v_o.max_leaves is not null and v_p.leave_count >= v_o.max_leaves then
    v_p.finished_at := now();
    v_p.finish_reason := 'leaves';
  end if;

  update olympiad_participants
    set leave_count = v_p.leave_count,
        leave_seconds = v_p.leave_seconds,
        offline_count = v_p.offline_count,
        offline_seconds = v_p.offline_seconds,
        finished_at = v_p.finished_at,
        finish_reason = v_p.finish_reason,
        events = case when jsonb_array_length(events) < 500 then events || v_event else events end
    where id = v_p.id;

  return jsonb_build_object('finished', v_p.finished_at is not null, 'leave_count', v_p.leave_count);
end;
$$ language plpgsql security definer set search_path = public;

grant execute on function olympiad_log_event(uuid, text, int, int) to anon, authenticated;

create or replace function olympiad_finish(p_token uuid)
returns void as $$
  update olympiad_participants
    set finished_at = now(), finish_reason = 'student'
    where token = p_token and started_at is not null and finished_at is null;
$$ language sql security definer set search_path = public;

grant execute on function olympiad_finish(uuid) to anon, authenticated;

-- ---------------------------------------------------------------
-- 9. Ұйымдастырушы: шолу, жүктеу, жариялау.
-- ---------------------------------------------------------------
create or replace function olympiad_teacher_overview()
returns jsonb as $$
begin
  if not is_olimp_staff() then
    raise exception 'forbidden';
  end if;
  return jsonb_build_object(
    'registered', (select count(*) from olympiad_participants),
    'started', (select count(*) from olympiad_participants where started_at is not null),
    'finished', (select count(*) from olympiad_participants where finished_at is not null),
    'questions', (select count(*) from olympiad_questions),
    'key', (select count(*) from olympiad_key),
    'server_now', now()
  );
end;
$$ language plpgsql security definer stable set search_path = public;

grant execute on function olympiad_teacher_overview() to authenticated;

create or replace function olympiad_teacher_export()
returns table (
  code text,
  zipgrade_id text,
  full_name text,
  grade text,
  school text,
  city text,
  region text,
  lang text,
  registered_at timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  finish_reason text,
  answers jsonb,
  leave_count int,
  leave_seconds int,
  offline_count int,
  offline_seconds int,
  passed boolean
) as $$
begin
  if not is_olimp_staff() then
    raise exception 'forbidden';
  end if;
  return query
    select
      p.code,
      s.zipgrade_id,
      coalesce(nullif(trim(s.full_name), ''), trim(concat(s.first_name, ' ', s.last_name))),
      s.grade::text,
      s.school::text,
      s.city::text,
      s.region::text,
      p.lang,
      p.created_at,
      p.started_at,
      p.finished_at,
      p.finish_reason,
      p.answers,
      p.leave_count,
      p.leave_seconds,
      p.offline_count,
      p.offline_seconds,
      p.passed
    from olympiad_participants p
    join students s on s.id = p.student_id
    order by s.last_name, s.first_name;
end;
$$ language plpgsql security definer stable set search_path = public;

grant execute on function olympiad_teacher_export() to authenticated;

-- Нәтижені жариялау: «Өтті» деп белгіленгендердің коды. Қалғаны — өтпеді.
-- Қайта жариялауға болады (соңғысы күшінде).
create or replace function olympiad_publish(p_passed_codes text[])
returns int as $$
declare
  v_unknown text;
  v_count int;
begin
  if not is_olimp_staff() then
    raise exception 'forbidden';
  end if;
  if not olympiad_ended() then
    raise exception 'not_ended';
  end if;

  select string_agg(c, ', ') into v_unknown
  from unnest(coalesce(p_passed_codes, '{}')) as c
  where not exists (select 1 from olympiad_participants where code = c);
  if v_unknown is not null then
    raise exception 'unknown_codes: %', v_unknown;
  end if;

  update olympiad_participants
    set passed = (code = any(coalesce(p_passed_codes, '{}')))
    where id is not null;

  select count(*) into v_count from olympiad_participants where passed;

  perform set_config('ziro.olympiad_publish', 'on', true);
  update olympiad set results_published_at = now() where id = 1;
  perform set_config('ziro.olympiad_publish', 'off', true);

  return v_count;
end;
$$ language plpgsql security definer set search_path = public;

grant execute on function olympiad_publish(text[]) to authenticated;

-- ---------------------------------------------------------------
-- 10. Тапсырмалардың суреттері. Қойма ашық (public URL жұмыс істейді),
--     бірақ тізімін ешкім көре алмайды: оқушыға сілтеме тек
--     олимпиада уақытында беріледі, ал файл аттары кездейсоқ.
-- ---------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('olympiad-images', 'olympiad-images', true)
on conflict (id) do nothing;

drop policy if exists "Olimp staff upload olympiad images" on storage.objects;
create policy "Olimp staff upload olympiad images" on storage.objects
  for insert with check (bucket_id = 'olympiad-images' and is_olimp_staff());

drop policy if exists "Olimp staff view olympiad images" on storage.objects;
create policy "Olimp staff view olympiad images" on storage.objects
  for select using (bucket_id = 'olympiad-images' and is_olimp_staff());

drop policy if exists "Olimp staff delete olympiad images" on storage.objects;
create policy "Olimp staff delete olympiad images" on storage.objects
  for delete using (bucket_id = 'olympiad-images' and is_olimp_staff());

commit;

-- ---------------------------------------------------------------
-- Тексеру:
--   select * from olympiad;                         -- бір жол, id = 1
--   select olympiad_public_info();                  -- json
--   select conname, pg_get_constraintdef(oid) from pg_constraint
--   where conrelid = 'public.profiles'::regclass and contype = 'c';
--                                                   -- тізімде 'olimp_teacher'
-- ---------------------------------------------------------------
