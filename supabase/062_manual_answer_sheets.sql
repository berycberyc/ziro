-- Migration: РФМШ жауаптарын қолмен енгізуге рұқсат.
--
-- Не үшін. РФМШ-те жауап — сан, көпіршік жоқ, сондықтан ZipGrade оның
-- парағын оқи алмайды. Бүгінге дейін бұл жауаптарды жүйеге кіргізудің
-- бір ғана жолы бар еді: ZipGrade экспортының дәл құрылымын Excel-де
-- қолмен қайталау. Отыз санды бір оқушыға қолмен теру — жол не бағанды
-- жылжытып алуға ең қолайлы жер, ал қатені кейін көру мүмкін емес.
--
-- Енді бөлек экран бар (сессия → «РФМШ жауаптары»), ол жазбаны тікелей
-- жасайды. Бірақ ондай жазбаның көзі 'zipgrade' емес: ZipGrade оны
-- көрген жоқ. Шындықты бұрмаламау үшін үшінші мән қосылады.
--
-- Бұл тек белгі: есептеу үш көзді де бірдей санайды, айырмасы жоқ.
-- Run in Supabase SQL Editor after 061_answer_key_templates.sql

begin;

alter table answer_sheets drop constraint if exists answer_sheets_source_check;
alter table answer_sheets add constraint answer_sheets_source_check
  check (source in ('online', 'zipgrade', 'manual'));

comment on column answer_sheets.source is
  'online — браузерде тапсырған; zipgrade — сканерден; manual — қолмен енгізілген (РФМШ).';

commit;
