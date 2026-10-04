-- Migration: «Қадамдар» экраны — қолмен қойылатын белгілер.
--
-- Экранның көп қадамы базадан өздігінен көрінеді (сұрақтар жүктелді ме,
-- PDF салынды ма, нәтиже жарияланды ма). Бірақ «басып шығардым»,
-- «партаға тараттым», «бланкілерді жинап алдым» деген қадамдарды база
-- білмейді — соларды осы кестеге жазамыз.
--
-- Run in Supabase SQL Editor after 058_math_topics.sql
-- (егер 059 нөмірі бос болмаса, файлды келесі бос нөмірге атаңыз —
--  мазмұны өзгермейді).

begin;

create table if not exists session_steps (
  test_session_id uuid not null references test_sessions(id) on delete cascade,
  step_key        text not null,
  done            boolean not null default false,
  done_at         timestamptz,
  primary key (test_session_id, step_key)
);

create index if not exists session_steps_session_idx on session_steps(test_session_id);

comment on table session_steps is
  'Қадамдар экранындағы қолмен қойылған белгілер. step_key — app/admin/steps/page.tsx тізіміндегі кілт.';

alter table session_steps enable row level security;

drop policy if exists "Admins manage session steps" on session_steps;
create policy "Admins manage session steps" on session_steps
  for all using (is_admin()) with check (is_admin());

commit;
