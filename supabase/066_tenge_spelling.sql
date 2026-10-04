-- 066_tenge_spelling.sql
--
-- «тенге» -> «теңге» базадағы бар мәтіндерде.
--
-- 2026 жылғы 1 шілдеден бастап Конституцияда валюта «теңге» деп жазылады,
-- Тіл саясаты комитеті бұл жазылым Қазақстандағы барлық мәтінге қатысты
-- деп түсіндірді — орыс тіліндегі мәтінді қоса.
--
-- Бұл миграция тек дайын сұрақтардың мәтінін түзейді. Жаңа сұрақтар
-- Word файлынан қалай жазылса, солай түседі — ол жерде дұрыс жазу керек.
--
-- Supabase SQL Editor-де 065_ad_links_and_telegram.sql-дан кейін іске қосыңыз.
-- Қайта іске қосу қауіпсіз: түзетілген жол екінші рет өзгермейді.

begin;

-- ---------------------------------------------------------------------------
-- 1. Негізгі сұрақтар кестесі
-- ---------------------------------------------------------------------------
update questions set
  text_kk      = replace(replace(text_kk,      'тенге', 'теңге'), 'Тенге', 'Теңге'),
  text_ru      = replace(replace(text_ru,      'тенге', 'теңге'), 'Тенге', 'Теңге'),
  column_a_kk  = replace(replace(column_a_kk,  'тенге', 'теңге'), 'Тенге', 'Теңге'),
  column_a_ru  = replace(replace(column_a_ru,  'тенге', 'теңге'), 'Тенге', 'Теңге'),
  column_b_kk  = replace(replace(column_b_kk,  'тенге', 'теңге'), 'Тенге', 'Теңге'),
  column_b_ru  = replace(replace(column_b_ru,  'тенге', 'теңге'), 'Тенге', 'Теңге'),
  choices      = replace(replace(choices::text, 'тенге', 'теңге'), 'Тенге', 'Теңге')::jsonb
where
  coalesce(text_kk, '')     like '%тенге%' or coalesce(text_kk, '')     like '%Тенге%' or
  coalesce(text_ru, '')     like '%тенге%' or coalesce(text_ru, '')     like '%Тенге%' or
  coalesce(column_a_kk, '') like '%тенге%' or coalesce(column_a_kk, '') like '%Тенге%' or
  coalesce(column_a_ru, '') like '%тенге%' or coalesce(column_a_ru, '') like '%Тенге%' or
  coalesce(column_b_kk, '') like '%тенге%' or coalesce(column_b_kk, '') like '%Тенге%' or
  coalesce(column_b_ru, '') like '%тенге%' or coalesce(column_b_ru, '') like '%Тенге%' or
  choices::text             like '%тенге%' or choices::text             like '%Тенге%';

-- ---------------------------------------------------------------------------
-- 2. Оқылым мәтіндері
-- ---------------------------------------------------------------------------
update passages set
  passage_text = replace(replace(passage_text, 'тенге', 'теңге'), 'Тенге', 'Теңге')
where passage_text like '%тенге%' or passage_text like '%Тенге%';

-- ---------------------------------------------------------------------------
-- 3. Ескі сұрақтар қоймасы.
--    Жаңа экрандар оны қолданбайды, бірақ /dashboard/online-test әлі содан
--    оқиды — сондықтан бұл да түзетіледі.
-- ---------------------------------------------------------------------------
update question_bank_items set
  text_kk = replace(replace(text_kk, 'тенге', 'теңге'), 'Тенге', 'Теңге'),
  text_ru = replace(replace(text_ru, 'тенге', 'теңге'), 'Тенге', 'Теңге'),
  choices = replace(replace(choices::text, 'тенге', 'теңге'), 'Тенге', 'Теңге')::jsonb
where
  coalesce(text_kk, '') like '%тенге%' or coalesce(text_kk, '') like '%Тенге%' or
  coalesce(text_ru, '') like '%тенге%' or coalesce(text_ru, '') like '%Тенге%' or
  choices::text         like '%тенге%' or choices::text         like '%Тенге%';

update question_bank_reading_groups set
  passage_kk = replace(replace(passage_kk, 'тенге', 'теңге'), 'Тенге', 'Теңге'),
  passage_ru = replace(replace(passage_ru, 'тенге', 'теңге'), 'Тенге', 'Теңге')
where
  coalesce(passage_kk, '') like '%тенге%' or coalesce(passage_kk, '') like '%Тенге%' or
  coalesce(passage_ru, '') like '%тенге%' or coalesce(passage_ru, '') like '%Тенге%';

commit;


-- ---------------------------------------------------------------------------
-- Тексеру. Осыны бөлек іске қосыңыз — бәрі нөл болуы керек.
-- ---------------------------------------------------------------------------
-- select
--   (select count(*) from questions
--      where coalesce(text_kk,'') like '%тенге%' or coalesce(text_ru,'') like '%тенге%'
--         or coalesce(column_a_kk,'') like '%тенге%' or coalesce(column_a_ru,'') like '%тенге%'
--         or coalesce(column_b_kk,'') like '%тенге%' or coalesce(column_b_ru,'') like '%тенге%'
--         or choices::text like '%тенге%')                       as questions_left,
--   (select count(*) from passages where passage_text like '%тенге%') as passages_left,
--   (select count(*) from question_bank_items
--      where coalesce(text_kk,'') like '%тенге%' or coalesce(text_ru,'') like '%тенге%'
--         or choices::text like '%тенге%')                       as bank_items_left;
