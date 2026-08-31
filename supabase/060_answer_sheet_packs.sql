-- Migration: ZipGrade жауап парақтарының пачкасы.
--
-- Не үшін. Бұрын әр пәннің алдында жүйе салған титул беті тұратын, ал
-- жауап парағын мұғалім бөлек таратуы керек еді. Енді титулдың орнына
-- сол оқушының өз жауап парағы басылады: үстінде аты, нұсқасы, орны,
-- ал «Нұсқа» шеңберінің керектісі алдын ала боялған. Бала қате шеңберді
-- бояса, жұмыс басқа кілтпен тексерілер еді — мұны ешкім байқамайды,
-- сондықтан оны адамға қалдырмаймыз.
--
-- Пачка ZipGrade сайтында қолмен жасалады да, осында жүктеледі. Жүктеу
-- кезінде әр бет БІР РЕТ талданады: ZipGrade ID, беттің нөмірі, төрт
-- шеңбердің координаталары. Басып шығарғанда талдау қайталанбайды —
-- дайын сандар алынады.
--
-- Бір пәнге бір пачка: ZipGrade-те бір пән — бір тест, ішінде барлық
-- оқушы. РФМШ бұған кірмейді: оның парағын ZipGrade оқи алмайды,
-- жүйе оны өзі салады (public/rfmsh-sheet.png).
--
-- Run in Supabase SQL Editor after 059_question_image_ru.sql

begin;

create table if not exists answer_sheet_packs (
  id uuid primary key default gen_random_uuid(),
  test_session_id uuid not null references test_sessions(id) on delete cascade,
  subject text not null check (subject in (
    'math', 'sandyq', 'zharatylystanu', 'tilder', 'bil'
  )),
  file_url text not null,
  -- Пачкадағы бет саны = ондағы оқушы саны.
  page_count int not null,
  -- Парақтағы сұрақ саны. Пәнмен сәйкес келмесе — пачка басқа пәннен.
  question_count int not null,
  -- Беттердің көрсеткіші:
  --   [{ "id": "71052", "page": 0, "r": 6.0,
  --      "bubbles": [[297.8, 206.5], [312.8, 206.5], ...] }, ...]
  -- Координаталар — PDF нүктесімен, бастауы беттің сол ТӨМЕНГІ бұрышы.
  pages jsonb not null default '[]'::jsonb,
  uploaded_at timestamptz not null default now(),
  unique (test_session_id, subject)
);

create index if not exists answer_sheet_packs_session_idx
  on answer_sheet_packs(test_session_id);

alter table answer_sheet_packs enable row level security;

create policy "Admins manage answer sheet packs" on answer_sheet_packs
  for all using (is_admin()) with check (is_admin());

-- Қойма. print-files-пен бірдей ереже: жазуды тек әкімші, оқуды бәрі
-- (басып шығару файлы браузерде жиналады, сол жерден оқылады).
insert into storage.buckets (id, name, public)
values ('answer-sheets', 'answer-sheets', true)
on conflict (id) do nothing;

create policy "Admins can upload answer sheets" on storage.objects
  for insert with check (bucket_id = 'answer-sheets' and is_admin());

create policy "Admins can update answer sheets" on storage.objects
  for update using (bucket_id = 'answer-sheets' and is_admin())
  with check (bucket_id = 'answer-sheets' and is_admin());

create policy "Admins can delete answer sheets" on storage.objects
  for delete using (bucket_id = 'answer-sheets' and is_admin());

create policy "Anyone can read answer sheets" on storage.objects
  for select using (bucket_id = 'answer-sheets');

commit;
