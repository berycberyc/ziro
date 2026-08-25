-- Migration: real schedule for the online test + an event log.
--
-- Until now the only switch was test_sessions.is_checking: flip it on and
-- ANYONE could enter at ANY time. That flag also drives the teachers'
-- pass-scanning screen, so turning it on at 08:20 to scan passes in the hall
-- would simultaneously open the online test an hour and a half early.
--
-- From here the two are separate:
--   is_checking       -> OFFLINE only (teachers scanning passes). Unchanged.
--   online_starts_at  -> ONLINE entry, purely by the clock.
--
-- The rules are the same for every session and are NOT configurable:
--   • from any time before the start the student sees one notice
--   • 10 minutes before the start it becomes a live countdown
--   • at the start the test opens by itself
--   • 30 minutes after the start entry closes for good — no exceptions
--   • each student gets the full test length counted from THEIR entry
--
-- Times are stored as timestamptz, i.e. an exact moment, so neither the
-- server's timezone nor a student changing their phone clock can shift them.
-- The admin types Almaty time; Postgres stores the instant.
-- Run in Supabase SQL Editor after 049_merge_bil.sql

begin;

-- ---------------------------------------------------------------
-- 1. Schedule column + per-attempt bookkeeping
-- ---------------------------------------------------------------
alter table test_sessions add column if not exists online_starts_at timestamptz;

comment on column test_sessions.online_starts_at is
  'Exact moment the online test opens. Entry closes 30 min later. Offline is unaffected (see is_checking).';

-- Backfill from the date + time already entered, interpreted as Almaty time.
update test_sessions
set online_starts_at = (session_date + coalesce(start_time, '10:00'::time)) at time zone 'Asia/Almaty'
where online_starts_at is null;

-- When the break before the CURRENT block began. The next block starts by
-- itself 5 minutes later, whether or not the student is at the screen —
-- so closing the laptop during a break cannot buy extra time.
alter table test_attempts add column if not exists break_started_at timestamptz;

-- Hard personal limit: entry + total test length. Computed once, at entry.
alter table test_attempts add column if not exists deadline_at timestamptz;

alter table test_attempts add column if not exists entered_at timestamptz;

-- Last time the student actually saved an answer. Used by the monitor to
-- spot someone who has gone quiet (10 minutes without a single answer).
alter table test_attempts add column if not exists last_answer_at timestamptz;

-- ---------------------------------------------------------------
-- 2. Event log — one row per meaningful step, not per keystroke.
--    ~10 rows per student for a whole test.
-- ---------------------------------------------------------------
create table if not exists test_events (
  id bigserial primary key,
  registration_id uuid not null references registrations(id) on delete cascade,
  test_session_id uuid references test_sessions(id) on delete cascade,
  event text not null check (event in (
    'entered',           -- opened the test, attempt created
    'consent',           -- accepted the rules
    'block_started',     -- pressed Бастау (or the break ran out)
    'block_auto_started',-- the 5-minute break expired on its own
    'block_finished',    -- pressed "finish block"
    'block_timeout',     -- the block's own clock ran out
    'submitted',         -- finished the last block
    'force_closed'       -- closed by the personal deadline
  )),
  subject text,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists test_events_reg_idx on test_events(registration_id, created_at);
create index if not exists test_events_session_idx on test_events(test_session_id, created_at);

alter table test_events enable row level security;

-- Students never touch this table directly; the RPCs below write it.
create policy "Admins can view test events" on test_events
  for select using (is_admin());

-- ---------------------------------------------------------------
-- 3. Shared helpers
-- ---------------------------------------------------------------

-- The block list for a test type. One place, used everywhere.
create or replace function online_blocks(p_test_type_code text)
returns text[]
language sql
immutable
as $$
  select case p_test_type_code
    when 'NIS' then array['math','sandyq','zharatylystanu','tilder']
    when 'BIL' then array['bil']
    when 'RFMS' then array['rfmsh']
    else array[]::text[]
  end;
$$;

create or replace function online_subject_minutes(p_subject text)
returns int
language sql
immutable
as $$
  select case p_subject
    when 'math' then 60
    when 'sandyq' then 30
    when 'zharatylystanu' then 30
    when 'tilder' then 120
    when 'bil' then 110
    when 'rfmsh' then 120
    else 0
  end;
$$;

-- Total wall-clock a student may occupy: every block + every break + one
-- minute of slack for network hiccups.
-- НИШ: 60+30+30+120 = 240, three breaks = 15, +1 → 256 minutes (4h16m).
create or replace function online_total_minutes(p_test_type_code text)
returns int
language sql
immutable
as $$
  select coalesce(
    (select sum(online_subject_minutes(b)) from unnest(online_blocks(p_test_type_code)) as b),
    0
  )::int
  + greatest(coalesce(array_length(online_blocks(p_test_type_code), 1), 1) - 1, 0) * 5
  + 1;
$$;

create or replace function log_test_event(
  p_registration_id uuid, p_session_id uuid, p_event text,
  p_subject text default null, p_meta jsonb default '{}'::jsonb
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into test_events (registration_id, test_session_id, event, subject, meta)
  values (p_registration_id, p_session_id, p_event, p_subject, p_meta);
$$;

-- ---------------------------------------------------------------
-- 4. Entry + resume, now schedule-aware.
--
-- Returns a `phase` the screen can act on directly:
--   waiting       — before the start (show the notice / countdown)
--   entry_closed  — more than 30 min after the start and never entered
--   running       — in the test
--   finished      — submitted, or past the personal deadline
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
  v_starts_at timestamptz;
  v_entry_closes timestamptz;
  v_now timestamptz := now();
  v_phase text;
  v_auto_started boolean := false;
begin
  select r.*, tt.code as test_type_code, ts.online_starts_at
  into v_reg
  from registrations r
  join test_types tt on tt.id = r.test_type_id
  join test_sessions ts on ts.id = r.test_session_id
  where r.id = p_registration_id and r.format = 'online' and r.payment_status = 'paid';

  if not found then
    raise exception 'invalid_registration';
  end if;

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
      'blocks', v_blocks
    );
  end if;

  -- Entry window closed and this student never came in.
  if v_attempt.id is null and v_now > v_entry_closes then
    return json_build_object(
      'phase', 'entry_closed',
      'starts_at', v_starts_at,
      'entry_closes_at', v_entry_closes,
      'server_now', v_now
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

  -- Older attempts (created before this migration) have no deadline yet.
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
    'auto_started', v_auto_started
  );
end;
$$;

grant execute on function start_test_attempt(uuid) to anon, authenticated;

-- ---------------------------------------------------------------
-- 5. Consent
-- ---------------------------------------------------------------
create or replace function confirm_test_consent(p_registration_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session uuid;
begin
  update test_attempts
  set consent_given_at = now()
  where registration_id = p_registration_id and consent_given_at is null;

  select test_session_id into v_session from registrations where id = p_registration_id;
  perform log_test_event(p_registration_id, v_session, 'consent');
end;
$$;

grant execute on function confirm_test_consent(uuid) to anon, authenticated;

-- ---------------------------------------------------------------
-- 6. Start the clock for the current block.
--    If the break already ran out, the block is backdated to when it
--    SHOULD have started — pressing the button late gains nothing.
-- ---------------------------------------------------------------
create or replace function start_subject_timer(p_registration_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempt record;
  v_reg record;
  v_start timestamptz;
begin
  select r.*, tt.code as test_type_code into v_reg
  from registrations r join test_types tt on tt.id = r.test_type_id
  where r.id = p_registration_id;

  select * into v_attempt from test_attempts where registration_id = p_registration_id;
  if not found then
    raise exception 'no_attempt';
  end if;

  if v_attempt.subject_started_at is null and v_attempt.status = 'in_progress' then
    v_start := case
      when v_attempt.break_started_at is null then now()
      else least(now(), v_attempt.break_started_at + interval '5 minutes')
    end;

    update test_attempts
    set subject_started_at = v_start
    where id = v_attempt.id
    returning * into v_attempt;

    perform log_test_event(p_registration_id, v_reg.test_session_id, 'block_started',
      (online_blocks(v_reg.test_type_code))[v_attempt.current_subject_index + 1], '{}'::jsonb);
  end if;

  return json_build_object(
    'subject_started_at', v_attempt.subject_started_at,
    'deadline_at', v_attempt.deadline_at,
    'server_now', now()
  );
end;
$$;

grant execute on function start_subject_timer(uuid) to anon, authenticated;

-- ---------------------------------------------------------------
-- 7. Finish a block → 5-minute break → next block.
-- ---------------------------------------------------------------
create or replace function advance_test_block(p_registration_id uuid, p_reason text default 'finished')
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reg record;
  v_blocks text[];
  v_attempt record;
  v_prev text;
begin
  select r.*, tt.code as test_type_code into v_reg
  from registrations r join test_types tt on tt.id = r.test_type_id
  where r.id = p_registration_id;

  v_blocks := online_blocks(v_reg.test_type_code);

  select * into v_attempt from test_attempts where registration_id = p_registration_id;
  v_prev := v_blocks[v_attempt.current_subject_index + 1];

  update test_attempts
  set current_subject_index = current_subject_index + 1,
      subject_started_at = null,
      break_started_at = now()
  where registration_id = p_registration_id and status = 'in_progress'
  returning * into v_attempt;

  perform log_test_event(p_registration_id, v_reg.test_session_id,
    case when p_reason = 'timeout' then 'block_timeout' else 'block_finished' end,
    v_prev, '{}'::jsonb);

  return json_build_object(
    'current_subject_index', v_attempt.current_subject_index,
    'subject_started_at', v_attempt.subject_started_at,
    'break_started_at', v_attempt.break_started_at,
    'break_ends_at', v_attempt.break_started_at + interval '5 minutes',
    'deadline_at', v_attempt.deadline_at,
    'is_finished', v_attempt.current_subject_index >= array_length(v_blocks, 1),
    'server_now', now()
  );
end;
$$;

grant execute on function advance_test_block(uuid, text) to anon, authenticated;

-- ---------------------------------------------------------------
-- 8. Saving an answer is refused once the clock has run out.
--    The browser timer alone is not a limit — closing the laptop and
--    reopening it an hour later would sail straight past it.
-- ---------------------------------------------------------------
create or replace function save_test_answer(
  p_registration_id uuid, p_subject text, p_question_number int, p_answer text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempt record;
  v_reg record;
  v_blocks text[];
  v_current text;
  v_block_ends timestamptz;
begin
  select r.*, tt.code as test_type_code into v_reg
  from registrations r join test_types tt on tt.id = r.test_type_id
  where r.id = p_registration_id;

  select * into v_attempt from test_attempts where registration_id = p_registration_id;

  if not found or v_attempt.status <> 'in_progress' then
    raise exception 'attempt_closed';
  end if;

  if v_attempt.deadline_at is not null and now() > v_attempt.deadline_at then
    raise exception 'deadline_passed';
  end if;

  v_blocks := online_blocks(v_reg.test_type_code);
  v_current := v_blocks[v_attempt.current_subject_index + 1];

  if p_subject is distinct from v_current then
    raise exception 'wrong_block';
  end if;

  if v_attempt.subject_started_at is not null then
    v_block_ends := v_attempt.subject_started_at
      + make_interval(mins => online_subject_minutes(v_current));
    if now() > v_block_ends + interval '30 seconds' then
      raise exception 'block_time_over';
    end if;
  end if;

  update test_attempts
  set answers = jsonb_set(
    jsonb_set(answers, array[p_subject], coalesce(answers->p_subject, '{}'::jsonb), true),
    array[p_subject, p_question_number::text],
    to_jsonb(coalesce(p_answer, '')),
    true
  ),
  last_answer_at = now()
  where registration_id = p_registration_id and status = 'in_progress';
end;
$$;

grant execute on function save_test_answer(uuid, text, int, text) to anon, authenticated;

-- ---------------------------------------------------------------
-- 9. Submit
-- ---------------------------------------------------------------
create or replace function submit_test_attempt(p_registration_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session uuid;
begin
  update test_attempts
  set status = 'submitted', submitted_at = now()
  where registration_id = p_registration_id and status = 'in_progress';

  select test_session_id into v_session from registrations where id = p_registration_id;
  perform log_test_event(p_registration_id, v_session, 'submitted');
end;
$$;

grant execute on function submit_test_attempt(uuid) to anon, authenticated;

-- ---------------------------------------------------------------
-- 10. Monitoring: one row per online participant, admin only.
--     "silent" = no answer saved for 10 minutes while a block is running.
-- ---------------------------------------------------------------
create or replace function online_monitor(p_session_id uuid)
returns table (
  registration_id uuid,
  student_name text,
  zipgrade_id text,
  status text,
  current_subject text,
  answered int,
  entered_at timestamptz,
  subject_started_at timestamptz,
  block_ends_at timestamptz,
  break_ends_at timestamptz,
  deadline_at timestamptz,
  last_event_at timestamptz,
  silent_minutes int
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin() then
    raise exception 'not_authorized';
  end if;

  return query
  select
    r.id,
    s.full_name,
    s.zipgrade_id,
    case
      when a.id is null then 'not_entered'
      when a.status = 'submitted' then 'finished'
      when a.subject_started_at is null then 'break'
      else 'writing'
    end,
    (online_blocks(tt.code))[a.current_subject_index + 1],
    coalesce(
      (select count(*)::int
       from jsonb_each_text(coalesce(a.answers->((online_blocks(tt.code))[a.current_subject_index + 1]), '{}'::jsonb))
       where value <> ''),
      0
    ),
    a.entered_at,
    a.subject_started_at,
    a.subject_started_at + make_interval(
      mins => online_subject_minutes((online_blocks(tt.code))[a.current_subject_index + 1])
    ),
    a.break_started_at + interval '5 minutes',
    a.deadline_at,
    greatest(
      coalesce(a.last_answer_at, a.entered_at),
      (select max(e.created_at) from test_events e where e.registration_id = r.id)
    ),
    case
      when a.id is null or a.status = 'submitted' or a.subject_started_at is null then null
      else (extract(epoch from (
             now() - greatest(a.subject_started_at, coalesce(a.last_answer_at, a.subject_started_at))
           )) / 60)::int
    end
  from registrations r
  join students s on s.id = r.student_id
  join test_types tt on tt.id = r.test_type_id
  left join test_attempts a on a.registration_id = r.id
  where r.test_session_id = p_session_id
    and r.format = 'online'
    and r.payment_status = 'paid'
  order by s.full_name;
end;
$$;

grant execute on function online_monitor(uuid) to authenticated;

commit;
