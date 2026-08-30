-- Migration: a question can now carry a different picture per language.
--
-- Why: the drawings are labelled — «А бағаны», «12 см», «Ұзындығы» — so a
-- Kazakh diagram cannot serve a Russian-language student. The Word files
-- already hold both versions: one picture inside the [kk] block, another
-- inside [ru]. The importer, however, kept only the first one it met and
-- gave it to both languages, warning that the rest were dropped.
--
-- One column could not express this, so the Russian picture gets its own.
-- image_url keeps its meaning — the Kazakh one — so every existing question
-- and every screen that reads it goes on working untouched.
--
-- When a question has only one picture it stays in image_url alone and the
-- test screen falls back to it for both languages. That is the common case
-- (a purely geometric drawing with no words on it) and it must not require
-- the author to paste the same file twice.
-- Run in Supabase SQL Editor after 058_math_topics.sql

begin;

alter table questions add column if not exists image_url_ru text;

comment on column questions.image_url is
  'Picture for the Kazakh version. Also used for Russian when image_url_ru is empty.';
comment on column questions.image_url_ru is
  'Picture for the Russian version. Empty means: use image_url for both.';

-- Оқушы сұрақтарды questions_public көрінісі арқылы оқиды — оған да жаңа
-- баған қосылуы керек, әйтпесе тест экраны орысша суретті көрмейді.
--
-- МАҢЫЗДЫ: жаңа баған тізімнің ЕҢ СОҢЫНА қосылады. Postgres «create or
-- replace view» кезінде бағанды ортаға қоюға рұқсат бермейді — тек соңына.
-- Әйтпесе көріністі өшіріп қайта жасауға тура келер еді, ал оған басқа
-- нәрселер сүйеніп тұруы мүмкін. Бағандардың реті кодқа әсер етпейді:
-- бәрі атымен оқылады.
create or replace view questions_public as
select
  q.id, q.session_id, q.subject, q.variant_number, q.question_number,
  q.topic_id, q.passage_id, q.text_kk, q.text_ru, q.image_url, q.answer_format,
  (
    select jsonb_agg(jsonb_build_object('text_kk', c->>'text_kk', 'text_ru', c->>'text_ru') order by ord)
    from jsonb_array_elements(q.choices) with ordinality as arr(c, ord)
  ) as choices,
  q.column_a_kk, q.column_a_ru, q.column_b_kk, q.column_b_ru,
  q.image_url_ru
from questions q;

grant select on questions_public to anon, authenticated;

commit;

-- ---------------------------------------------------------------
-- Тексеру:
--
--   select question_number, image_url is not null as kk_суреті,
--          image_url_ru is not null as ru_суреті
--   from questions
--   where image_url is not null
--   order by question_number;
--
-- Бір ғана суреті бар сұрақтарда ru_суреті = false болады — бұл дұрыс,
-- ондай жағдайда екі тілге де image_url қолданылады.
-- ---------------------------------------------------------------
