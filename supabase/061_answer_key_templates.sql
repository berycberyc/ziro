-- Migration: кілт үлгісі — ZipGrade-тің БОС парағы.
--
-- Не үшін. Кілтті ZipGrade-ке қолмен енгізу дегеніміз — бір пәнде 60
-- сұрақ, төрт нұсқа, бес пән. Мыңнан аса түрту, ал бір қате жеткілікті:
-- сол сұрақ бойынша бүкіл ағын қате тексеріледі, және мұны нәтижелерден
-- байқау мүмкін емес. Жүйе дұрыс жауаптарды базадан алады да, парақта
-- өзі бояп береді — сіз тек басып шығарып, сканерлейсіз.
--
-- Неге бөлек файл, пачканың бетін алмаймыз. Пачканың әр бетінде нақты
-- оқушының аты жазулы, ID-і боялған. Ондай бетке дұрыс жауаптарды бояп
-- сканерлесек, ZipGrade оны сол баланың жүз пайыздық жұмысы деп жазып
-- алар еді. Сондықтан ZipGrade-те тізімсіз бос бланк жасалады.
--
-- РФМШ мұнда жоқ: онда жауап — сан, шеңбер жоқ, кілт қолмен қалады.
-- Run in Supabase SQL Editor after 060_answer_sheet_packs.sql

begin;

create table if not exists answer_key_templates (
  id uuid primary key default gen_random_uuid(),
  test_session_id uuid not null references test_sessions(id) on delete cascade,
  subject text not null check (subject in (
    'math', 'sandyq', 'zharatylystanu', 'tilder', 'bil'
  )),
  file_url text not null,
  question_count int not null,
  -- Шеңберлердің координаталары:
  --   { "questionCount": 40, "variantR": 6, "r": 5.96,
  --     "variantBubbles": [[297.8, 206.5], ...],
  --     "rows": [{ "n": 1, "bubbles": [[199.7, 555.6], ...] }, ...] }
  -- Бастауы — беттің сол ТӨМЕНГІ бұрышы, PDF нүктесімен.
  index jsonb not null default '{}'::jsonb,
  uploaded_at timestamptz not null default now(),
  unique (test_session_id, subject)
);

create index if not exists answer_key_templates_session_idx
  on answer_key_templates(test_session_id);

alter table answer_key_templates enable row level security;

create policy "Admins manage answer key templates" on answer_key_templates
  for all using (is_admin()) with check (is_admin());

-- Үлгілер жауап парақтарымен бір қоймада жатады: тағдыры бір, байқаудан
-- кейін екеуі де бір батырмамен өшіріледі.

commit;
